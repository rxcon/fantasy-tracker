import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { decryptSecret } from "@/utils/crypto";
import {
  ESPN_LINEUP_SLOT,
  ESPN_POSITION,
  ESPN_PRO_TEAM,
  ESPN_SLOT_SORT_ORDER,
  sleeperPositionSortValue,
} from "@/utils/nflMappings";
import type { RosterPlayer, RosterResponse } from "@/utils/types";

export const dynamic = "force-dynamic";

async function getSleeperRoster(
  leagueId: string,
  sleeperUsername: string | null,
  requestedWeek: number | null
): Promise<RosterResponse> {
  if (!sleeperUsername) {
    return { status: "error", errorMessage: "No Sleeper username saved for this league." };
  }

  const userRes = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(sleeperUsername)}`
  );
  if (!userRes.ok) {
    return { status: "error", errorMessage: `Sleeper username "${sleeperUsername}" was not found.` };
  }
  const sleeperUserId = (await userRes.json())?.user_id;
  if (!sleeperUserId) {
    return { status: "error", errorMessage: "Could not resolve Sleeper user." };
  }

  let week = requestedWeek;
  if (!week) {
    const stateRes = await fetch("https://api.sleeper.app/v1/state/nfl");
    week = stateRes.ok ? (await stateRes.json())?.week ?? 1 : 1;
  }

  const [rostersRes, matchupsRes, playersRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`),
    // Sleeper's full player database rarely changes — cache it for a day
    // so we're not pulling several MB on every roster view.
    fetch("https://api.sleeper.app/v1/players/nfl", {
      next: { revalidate: 86400 },
    }),
  ]);

  if (!rostersRes.ok || !playersRes.ok) {
    return { status: "error", errorMessage: "Couldn't load Sleeper roster data." };
  }

  const rosters = await rostersRes.json();
  const players = await playersRes.json();
  const myRoster = Array.isArray(rosters)
    ? rosters.find((r: any) => r.owner_id === sleeperUserId)
    : null;

  if (!myRoster) {
    return { status: "error", errorMessage: "Couldn't find your roster in this league." };
  }

  let playersPoints: Record<string, number> = {};
  let starterIds: string[] = myRoster.starters ?? [];

  if (matchupsRes.ok) {
    const matchups = await matchupsRes.json();
    const myMatchup = Array.isArray(matchups)
      ? matchups.find((m: any) => m.roster_id === myRoster.roster_id)
      : null;
    if (myMatchup) {
      playersPoints = myMatchup.players_points ?? {};
      starterIds = myMatchup.starters ?? starterIds;
    }
  }

  const allPlayerIds: string[] = myRoster.players ?? [];
  const starterSet = new Set(starterIds);

  const roster: RosterPlayer[] = allPlayerIds.map((playerId) => {
    const meta = players?.[playerId];
    const isStarter = starterSet.has(playerId);
    return {
      playerId,
      name: meta ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim() : playerId,
      position: meta?.position ?? "-",
      proTeam: meta?.team ?? "FA",
      points: Number((playersPoints[playerId] ?? 0).toFixed(2)),
      isStarter,
      slot: isStarter ? meta?.position ?? "-" : "Bench",
    };
  });

  roster.sort((a, b) => {
    if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
    if (a.isStarter) {
      return sleeperPositionSortValue(a.position) - sleeperPositionSortValue(b.position);
    }
    return b.points - a.points;
  });

  return { status: "ok", week: week ?? 1, players: roster };
}

async function getEspnRoster(
  leagueId: string,
  season: string,
  espnSwid: string | null,
  espnS2: string | null,
  requestedWeek: number | null
): Promise<RosterResponse> {
  const headers: Record<string, string> = {};
  let normalizedSwid: string | null = null;

  if (espnS2 && espnSwid) {
    const s2 = decryptSecret(espnS2);
    const rawSwid = decryptSecret(espnSwid);
    normalizedSwid = rawSwid.replace(/[{}]/g, "").toUpperCase();
    headers["Cookie"] = `espn_s2=${s2}; SWID={${normalizedSwid}};`;
  }

  const periodParam = requestedWeek ? `&scoringPeriodId=${requestedWeek}` : "";
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mRoster&view=mMatchupScore&view=mTeam${periodParam}`;

  const res = await fetch(url, { headers });

  if (res.status === 401 || res.status === 403) {
    return {
      status: "error",
      errorMessage: "ESPN session expired or league is private. Reconnect with a fresh SWID/espn_s2.",
    };
  }
  if (!res.ok) {
    return { status: "error", errorMessage: "ESPN league not found." };
  }

  const data = await res.json();
  const week = requestedWeek ?? data?.scoringPeriodId ?? data?.status?.currentMatchupPeriod ?? 1;

  const teams = Array.isArray(data?.teams) ? data.teams : [];
  let myTeam = teams[0] ?? null;

  if (normalizedSwid) {
    const owned = teams.find(
      (t: any) =>
        Array.isArray(t.owners) &&
        t.owners.some((o: string) => o.replace(/[{}]/g, "").toUpperCase() === normalizedSwid)
    );
    if (owned) myTeam = owned;
  }

  if (!myTeam) {
    return { status: "error", errorMessage: "No teams found for this ESPN league." };
  }

  const entries = Array.isArray(myTeam?.roster?.entries) ? myTeam.roster.entries : [];

  const roster: RosterPlayer[] = entries.map((entry: any) => {
    const player = entry?.playerPoolEntry?.player;
    const slotId = entry?.lineupSlotId;
    const isStarter = slotId !== 20 && slotId !== 21;

    const statLine = Array.isArray(player?.stats)
      ? player.stats.find(
          (s: any) => s.scoringPeriodId === week && s.statSourceId === 0
        )
      : null;

    return {
      playerId: String(player?.id ?? entry?.playerId ?? ""),
      name: player?.fullName ?? "Unknown player",
      position: ESPN_POSITION[player?.defaultPositionId] ?? "-",
      proTeam: ESPN_PRO_TEAM[player?.proTeamId] ?? "FA",
      points: Number((statLine?.appliedTotal ?? 0).toFixed(2)),
      isStarter,
      slot: ESPN_LINEUP_SLOT[slotId] ?? (isStarter ? "FLEX" : "Bench"),
    };
  });

  roster.sort((a: RosterPlayer, b: RosterPlayer) => {
    if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
    return b.points - a.points;
  });

  return { status: "ok", week, players: roster };
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const weekParam = searchParams.get("week");
  const requestedWeek = weekParam ? parseInt(weekParam, 10) : null;

  if (!id) {
    return NextResponse.json({ error: "Missing league id." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("user_leagues")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const result =
    row.platform === "sleeper"
      ? await getSleeperRoster(row.league_id, row.sleeper_username, requestedWeek)
      : await getEspnRoster(
          row.league_id,
          row.season,
          row.espn_swid,
          row.espn_s2,
          requestedWeek
        );

  return NextResponse.json(result);
}
