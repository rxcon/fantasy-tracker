import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { decryptSecret } from "@/utils/crypto";

export const dynamic = "force-dynamic";

type LeagueRow = {
  id: string;
  platform: "sleeper" | "espn";
  league_id: string;
  sleeper_username: string | null;
  sleeper_user_id: string | null;
  espn_swid: string | null;
  espn_s2: string | null;
  season: string;
};

type TeamResult =
  | {
      id: string;
      platform: "sleeper" | "espn";
      status: "ok";
      leagueId: string;
      leagueName: string;
      scoringFormat: string;
      wins: number;
      losses: number;
      ties: number;
      pointsFor: number;
    }
  | {
      id: string;
      platform: "sleeper" | "espn";
      status: "error";
      leagueId: string;
      errorMessage: string;
    };

function errorResult(
  row: LeagueRow,
  message: string
): TeamResult {
  return {
    id: row.id,
    platform: row.platform,
    status: "error",
    leagueId: row.league_id,
    errorMessage: message,
  };
}

async function fetchSleeperTeam(row: LeagueRow): Promise<TeamResult> {
  try {
    if (!row.sleeper_username) {
      return errorResult(row, "No Sleeper username saved for this league.");
    }

    // Resolve the username to Sleeper's internal user id.
    const userRes = await fetch(
      `https://api.sleeper.app/v1/user/${encodeURIComponent(
        row.sleeper_username
      )}`
    );
    if (!userRes.ok) {
      return errorResult(row, `Sleeper username "${row.sleeper_username}" was not found.`);
    }
    const userData = await userRes.json();
    const sleeperUserId = userData?.user_id;
    if (!sleeperUserId) {
      return errorResult(row, `Could not resolve Sleeper user "${row.sleeper_username}".`);
    }

    const [leagueRes, rostersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${row.league_id}`),
      fetch(`https://api.sleeper.app/v1/league/${row.league_id}/rosters`),
    ]);

    if (!leagueRes.ok) {
      return errorResult(row, "Sleeper league not found. Check the League ID.");
    }
    if (!rostersRes.ok) {
      return errorResult(row, "Could not load rosters for this Sleeper league.");
    }

    const league = await leagueRes.json();
    const rosters = await rostersRes.json();

    const myRoster = Array.isArray(rosters)
      ? rosters.find((r: any) => r.owner_id === sleeperUserId)
      : null;

    if (!myRoster) {
      return errorResult(
        row,
        `"${row.sleeper_username}" doesn't own a team in this league.`
      );
    }

    const recValue = league?.scoring_settings?.rec ?? 0;
    const scoringFormat =
      recValue >= 1 ? "PPR" : recValue > 0 ? "Half-PPR" : "Standard";

    const fpts = myRoster.settings?.fpts ?? 0;
    const fptsDecimal = myRoster.settings?.fpts_decimal ?? 0;

    return {
      id: row.id,
      platform: "sleeper",
      status: "ok",
      leagueId: row.league_id,
      leagueName: league?.name ?? "Sleeper League",
      scoringFormat,
      wins: myRoster.settings?.wins ?? 0,
      losses: myRoster.settings?.losses ?? 0,
      ties: myRoster.settings?.ties ?? 0,
      pointsFor: Number((fpts + fptsDecimal / 100).toFixed(2)),
    };
  } catch (err) {
    return errorResult(row, "Unexpected error reaching Sleeper.");
  }
}

async function fetchEspnTeam(row: LeagueRow): Promise<TeamResult> {
  try {
    const headers: Record<string, string> = {};
    let normalizedSwid: string | null = null;

    if (row.espn_s2 && row.espn_swid) {
      const s2 = decryptSecret(row.espn_s2);
      const rawSwid = decryptSecret(row.espn_swid);
      normalizedSwid = rawSwid.replace(/[{}]/g, "").toUpperCase();
      headers["Cookie"] = `espn_s2=${s2}; SWID={${normalizedSwid}};`;
    }

    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${row.season}/segments/0/leagues/${row.league_id}?view=mRoster&view=mSettings&view=mTeam`;

    const res = await fetch(url, { headers });

    if (res.status === 401 || res.status === 403) {
      return errorResult(
        row,
        "ESPN session expired or league is private. Reconnect with a fresh SWID/espn_s2."
      );
    }
    if (!res.ok) {
      return errorResult(row, "ESPN league not found. Check the League ID and season.");
    }

    const data = await res.json();

    const scoringType = data?.settings?.scoringSettings?.scoringType ?? "Custom";

    const teams = Array.isArray(data?.teams) ? data.teams : [];
    let myTeam = teams[0] ?? null;

    if (normalizedSwid) {
      const owned = teams.find((t: any) =>
        Array.isArray(t.owners) &&
        t.owners.some(
          (o: string) => o.replace(/[{}]/g, "").toUpperCase() === normalizedSwid
        )
      );
      if (owned) myTeam = owned;
      else if (teams.length > 0) {
        return errorResult(row, "Couldn't match your SWID to a team in this league.");
      }
    }

    if (!myTeam) {
      return errorResult(row, "No teams found for this ESPN league.");
    }

    const leagueName = data?.settings?.name ?? "ESPN League";
    const wins = myTeam?.record?.overall?.wins ?? 0;
    const losses = myTeam?.record?.overall?.losses ?? 0;
    const ties = myTeam?.record?.overall?.ties ?? 0;
    const pointsFor =
      myTeam?.record?.overall?.pointsFor ?? myTeam?.points ?? 0;

    return {
      id: row.id,
      platform: "espn",
      status: "ok",
      leagueId: row.league_id,
      leagueName,
      scoringFormat: String(scoringType).replace(/_/g, " "),
      wins,
      losses,
      ties,
      pointsFor: Number(Number(pointsFor).toFixed(2)),
    };
  } catch (err) {
    return errorResult(row, "Unexpected error reaching ESPN.");
  }
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: leagues, error } = await supabase
    .from("user_leagues")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (leagues ?? []) as LeagueRow[];

  // allSettled (not all) so one dead credential or typo'd league ID
  // never takes down the whole dashboard — each card reports its own
  // status independently.
  const settled = await Promise.allSettled(
    rows.map((row) =>
      row.platform === "sleeper" ? fetchSleeperTeam(row) : fetchEspnTeam(row)
    )
  );

  const results: TeamResult[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : errorResult(rows[i], "Unexpected error fetching this league.")
  );

  return NextResponse.json({ results });
}
