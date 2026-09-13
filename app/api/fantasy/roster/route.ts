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
import type { LiveTeamStatus, OpponentInfo, RosterPlayer, RosterResponse } from "@/utils/types";

export const dynamic = "force-dynamic";

function sumStarterPoints(players: RosterPlayer[]): number {
  return Number(
    players
      .filter((p) => p.isStarter)
      .reduce((total, p) => total + p.points, 0)
      .toFixed(2)
  );
}

function sumStarterProjected(players: RosterPlayer[]): number {
  return Number(
    players
      .filter((p) => p.isStarter)
      .reduce((total, p) => total + p.projectedPoints, 0)
      .toFixed(2)
  );
}

// ESPN's public scoreboard feed (separate from the fantasy API, no auth
// needed) carries live drive situation per game, including whether the
// team currently possessing the ball is inside the red zone. We fetch
// it once per request and key it by team abbreviation so every player
// on that team can be flagged, regardless of platform.
async function getLiveTeamStatus(): Promise<Record<string, LiveTeamStatus>> {
  const map: Record<string, LiveTeamStatus> = {};
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
      // Live data — cache briefly so simultaneous card loads share one
      // fetch, without going stale during an actively moving game.
      { next: { revalidate: 15 } }
    );
    if (!res.ok) return map;

    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];

    for (const event of events) {
      const comp = event?.competitions?.[0];
      if (!comp) continue;

      const state: LiveTeamStatus["state"] = comp?.status?.type?.state ?? "pre";
      const situation = comp?.situation;
      const possessionTeamId = situation?.possession;
      const isRedZone = Boolean(situation?.isRedZone);
      const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];

      for (const c of competitors) {
        const abbr = c?.team?.abbreviation;
        if (!abbr) continue;

        const hasPossession =
          possessionTeamId != null && String(c?.team?.id) === String(possessionTeamId);

        map[abbr] = {
          state,
          hasPossession,
          isRedZone: hasPossession && isRedZone,
          situationText: situation?.possessionText ?? undefined,
        };
      }
    }
  } catch {
    // Live status is a nice-to-have — if ESPN's scoreboard is unreachable,
    // just skip it rather than failing the whole roster response.
  }
  return map;
}

// Sleeper's projections endpoint is undocumented but stable and widely
// used by community tools. It returns per-player projected stats for a
// given season/week, either as an array of records or as a map keyed by
// player_id depending on which mirror answers — we handle both shapes
// and normalize into a simple player_id -> stats object map.
async function getSleeperProjections(
  season: string,
  week: number
): Promise<Record<string, any>> {
  const map: Record<string, any> = {};
  try {
    const res = await fetch(
      `https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return map;
    const raw = await res.json();

    if (Array.isArray(raw)) {
      for (const entry of raw) {
        const pid = entry?.player_id ?? entry?.playerId;
        if (pid) map[pid] = entry?.stats ?? entry;
      }
    } else if (raw && typeof raw === "object") {
      for (const [pid, entry] of Object.entries(raw)) {
        map[pid] = (entry as any)?.stats ?? entry;
      }
    }
  } catch {
    // Projections are a nice-to-have — skip silently on failure.
  }
  return map;
}

function sleeperProjectedPoints(proj: any, scoringFormat: string): number {
  if (!proj) return 0;
  const val =
    scoringFormat === "PPR"
      ? proj.pts_ppr ?? proj.pts_half_ppr ?? proj.pts_std
      : scoringFormat === "Half-PPR"
      ? proj.pts_half_ppr ?? proj.pts_ppr ?? proj.pts_std
      : proj.pts_std ?? proj.pts_half_ppr ?? proj.pts_ppr;
  return Number(val ?? 0);
}

function buildSleeperPlayers(
  playerIds: string[],
  starterIds: string[],
  pointsMap: Record<string, number>,
  playersMeta: any,
  liveMap: Record<string, LiveTeamStatus>,
  projMap: Record<string, any>,
  scoringFormat: string
): RosterPlayer[] {
  const starterSet = new Set(starterIds);
  const list: RosterPlayer[] = playerIds.map((id) => {
    const meta = playersMeta?.[id];
    const isStarter = starterSet.has(id);
    const name = meta
      ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim()
      : "";
    const proTeam = meta?.team ?? "FA";
    return {
      playerId: id,
      name: name || id,
      position: meta?.position ?? "-",
      proTeam,
      points: Number((pointsMap[id] ?? 0).toFixed(2)),
      projectedPoints: Number(sleeperProjectedPoints(projMap[id], scoringFormat).toFixed(2)),
      isStarter,
      slot: isStarter ? meta?.position ?? "-" : "Bench",
      liveStatus: liveMap[proTeam],
    };
  });

  list.sort((a, b) => {
    if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
    if (a.isStarter) {
      return sleeperPositionSortValue(a.position) - sleeperPositionSortValue(b.position);
    }
    return b.points - a.points;
  });

  return list;
}

async function getSleeperMatchup(
  leagueId: string,
  sleeperUsername: string | null,
  requestedWeek: number | null,
  liveMap: Record<string, LiveTeamStatus>
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

  const [rostersRes, matchupsRes, playersRes, usersRes, leagueRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`),
    // Sleeper's full player database rarely changes — cache it for a day
    // so we're not pulling several MB on every roster view.
    fetch("https://api.sleeper.app/v1/players/nfl", {
      next: { revalidate: 86400 },
    }),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}`),
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

  const league = leagueRes.ok ? await leagueRes.json() : null;
  const season = league?.season ?? String(new Date().getFullYear());
  const recValue = league?.scoring_settings?.rec ?? 0;
  const scoringFormat = recValue >= 1 ? "PPR" : recValue > 0 ? "Half-PPR" : "Standard";

  const projMap = await getSleeperProjections(season, week!);

  let matchups: any[] = [];
  if (matchupsRes.ok) {
    matchups = await matchupsRes.json();
  }

  const myMatchup = Array.isArray(matchups)
    ? matchups.find((m: any) => m.roster_id === myRoster.roster_id)
    : null;

  const myPlayers = buildSleeperPlayers(
    myRoster.players ?? [],
    myMatchup?.starters ?? myRoster.starters ?? [],
    myMatchup?.players_points ?? {},
    players,
    liveMap,
    projMap,
    scoringFormat
  );

  let opponent: OpponentInfo = null;

  if (myMatchup?.matchup_id != null) {
    const oppMatchup = matchups.find(
      (m: any) => m.matchup_id === myMatchup.matchup_id && m.roster_id !== myRoster.roster_id
    );
    if (oppMatchup) {
      const oppRoster = Array.isArray(rosters)
        ? rosters.find((r: any) => r.roster_id === oppMatchup.roster_id)
        : null;
      if (oppRoster) {
        const oppPlayers = buildSleeperPlayers(
          oppRoster.players ?? [],
          oppMatchup.starters ?? [],
          oppMatchup.players_points ?? {},
          players,
          liveMap,
          projMap,
          scoringFormat
        );

        let teamName = "Opponent";
        if (usersRes.ok) {
          const users = await usersRes.json();
          const oppUser = Array.isArray(users)
            ? users.find((u: any) => u.user_id === oppRoster.owner_id)
            : null;
          teamName = oppUser?.metadata?.team_name || oppUser?.display_name || "Opponent";
        }

        opponent = {
          teamName,
          totalPoints: sumStarterPoints(oppPlayers),
          projectedPoints: sumStarterProjected(oppPlayers),
          players: oppPlayers,
        };
      }
    }
  }

  return {
    status: "ok",
    week: week ?? 1,
    myPoints: sumStarterPoints(myPlayers),
    myProjectedPoints: sumStarterProjected(myPlayers),
    players: myPlayers,
    opponent,
  };
}

function buildEspnPlayers(
  entries: any[],
  week: number,
  liveMap: Record<string, LiveTeamStatus>
): RosterPlayer[] {
  const withSlot = entries.map((entry: any) => {
    const player = entry?.playerPoolEntry?.player;
    const slotId = entry?.lineupSlotId;
    const isStarter = slotId !== 20 && slotId !== 21;

    const statLine = Array.isArray(player?.stats)
      ? player.stats.find((s: any) => s.scoringPeriodId === week && s.statSourceId === 0)
      : null;
    // statSourceId 1 = ESPN's own projection for this player/week —
    // already sitting in the same stats array we use for actuals.
    const projStatLine = Array.isArray(player?.stats)
      ? player.stats.find((s: any) => s.scoringPeriodId === week && s.statSourceId === 1)
      : null;

    const proTeam = ESPN_PRO_TEAM[player?.proTeamId] ?? "FA";

    const rp: RosterPlayer = {
      playerId: String(player?.id ?? entry?.playerId ?? ""),
      name: player?.fullName ?? "Unknown player",
      position: ESPN_POSITION[player?.defaultPositionId] ?? "-",
      proTeam,
      points: Number((statLine?.appliedTotal ?? 0).toFixed(2)),
      projectedPoints: Number((projStatLine?.appliedTotal ?? 0).toFixed(2)),
      isStarter,
      slot: ESPN_LINEUP_SLOT[slotId] ?? (isStarter ? "FLEX" : "Bench"),
      liveStatus: liveMap[proTeam],
    };

    return { slotId, isStarter, rp };
  });

  withSlot.sort((a, b) => {
    if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
    if (a.isStarter) {
      return (ESPN_SLOT_SORT_ORDER[a.slotId] ?? 9) - (ESPN_SLOT_SORT_ORDER[b.slotId] ?? 9);
    }
    return b.rp.points - a.rp.points;
  });

  return withSlot.map((w) => w.rp);
}

async function getEspnMatchup(
  leagueId: string,
  season: string,
  espnSwid: string | null,
  espnS2: string | null,
  requestedWeek: number | null,
  liveMap: Record<string, LiveTeamStatus>
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
  // mMatchup adds the weekly schedule (data.schedule), which is how we
  // figure out who the opponent is for the requested week.
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mRoster&view=mMatchupScore&view=mMatchup&view=mTeam${periodParam}`;

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

  const myPlayers = buildEspnPlayers(myTeam?.roster?.entries ?? [], week, liveMap);

  let opponent: OpponentInfo = null;

  const schedule = Array.isArray(data?.schedule) ? data.schedule : [];
  const matchupEntry = schedule.find(
    (s: any) =>
      s.matchupPeriodId === week &&
      (s.home?.teamId === myTeam.id || s.away?.teamId === myTeam.id)
  );

  if (matchupEntry) {
    const oppTeamId =
      matchupEntry.home?.teamId === myTeam.id
        ? matchupEntry.away?.teamId
        : matchupEntry.home?.teamId;

    if (oppTeamId != null) {
      const oppTeam = teams.find((t: any) => t.id === oppTeamId);
      if (oppTeam) {
        const oppPlayers = buildEspnPlayers(oppTeam?.roster?.entries ?? [], week, liveMap);
        const teamName =
          oppTeam?.name ||
          `${oppTeam?.location ?? ""} ${oppTeam?.nickname ?? ""}`.trim() ||
          "Opponent";

        opponent = {
          teamName,
          totalPoints: sumStarterPoints(oppPlayers),
          projectedPoints: sumStarterProjected(oppPlayers),
          players: oppPlayers,
        };
      }
    }
  }

  return {
    status: "ok",
    week,
    myPoints: sumStarterPoints(myPlayers),
    myProjectedPoints: sumStarterProjected(myPlayers),
    players: myPlayers,
    opponent,
  };
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

  const liveMap = await getLiveTeamStatus();

  const result =
    row.platform === "sleeper"
      ? await getSleeperMatchup(row.league_id, row.sleeper_username, requestedWeek, liveMap)
      : await getEspnMatchup(
          row.league_id,
          row.season,
          row.espn_swid,
          row.espn_s2,
          requestedWeek,
          liveMap
        );

  return NextResponse.json(result);
}
