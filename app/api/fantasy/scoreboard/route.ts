import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { decryptSecret } from "@/utils/crypto";

export const dynamic = "force-dynamic";

type ScoreboardEntry = {
  teamName: string;
  ownerEmail: string;
  leagueName: string;
  platform: "sleeper" | "espn";
  points: number;
};

type TeamSummary = { teamName: string; leagueName: string; points: number };

async function getSleeperTeamSummary(row: any): Promise<TeamSummary | null> {
  try {
    if (!row.sleeper_username) return null;

    const userRes = await fetch(
      `https://api.sleeper.app/v1/user/${encodeURIComponent(row.sleeper_username)}`
    );
    if (!userRes.ok) return null;
    const sleeperUserId = (await userRes.json())?.user_id;
    if (!sleeperUserId) return null;

    const [leagueRes, rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${row.league_id}`),
      fetch(`https://api.sleeper.app/v1/league/${row.league_id}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${row.league_id}/users`),
    ]);
    if (!leagueRes.ok || !rostersRes.ok) return null;

    const league = await leagueRes.json();
    const rosters = await rostersRes.json();
    const myRoster = Array.isArray(rosters)
      ? rosters.find((r: any) => r.owner_id === sleeperUserId)
      : null;
    if (!myRoster) return null;

    let teamName = row.sleeper_username;
    if (usersRes.ok) {
      const users = await usersRes.json();
      const me = Array.isArray(users)
        ? users.find((u: any) => u.user_id === sleeperUserId)
        : null;
      teamName = me?.metadata?.team_name || me?.display_name || teamName;
    }

    const fpts = myRoster.settings?.fpts ?? 0;
    const fptsDecimal = myRoster.settings?.fpts_decimal ?? 0;

    return {
      teamName,
      leagueName: league?.name ?? "Sleeper League",
      points: Number((fpts + fptsDecimal / 100).toFixed(2)),
    };
  } catch {
    return null;
  }
}

async function getEspnTeamSummary(row: any): Promise<TeamSummary | null> {
  try {
    const headers: Record<string, string> = {};
    let normalizedSwid: string | null = null;

    if (row.espn_s2 && row.espn_swid) {
      const s2 = decryptSecret(row.espn_s2);
      const rawSwid = decryptSecret(row.espn_swid);
      normalizedSwid = rawSwid.replace(/[{}]/g, "").toUpperCase();
      headers["Cookie"] = `espn_s2=${s2}; SWID={${normalizedSwid}};`;
    }

    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${row.season}/segments/0/leagues/${row.league_id}?view=mTeam&view=mSettings`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const data = await res.json();
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
    if (!myTeam) return null;

    const teamName =
      myTeam?.name ||
      `${myTeam?.location ?? ""} ${myTeam?.nickname ?? ""}`.trim() ||
      "ESPN Team";
    const points = myTeam?.record?.overall?.pointsFor ?? myTeam?.points ?? 0;

    return {
      teamName,
      leagueName: data?.settings?.name ?? "ESPN League",
      points: Number(Number(points).toFixed(2)),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  // Any signed-in family member can view the site-wide board — this
  // check just confirms they're logged in at all, not that they own
  // any particular row (the whole point of this page is cross-user).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: rows, error } = await admin.from("user_leagues").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap: Record<string, string> = {};
  for (const u of userList?.users ?? []) {
    emailMap[u.id] = u.email ?? "Unknown";
  }

  const settled = await Promise.allSettled(
    (rows ?? []).map(async (row: any) => {
      const summary =
        row.platform === "sleeper"
          ? await getSleeperTeamSummary(row)
          : await getEspnTeamSummary(row);
      if (!summary) return null;

      const entry: ScoreboardEntry = {
        teamName: summary.teamName,
        ownerEmail: emailMap[row.user_id] ?? "Unknown",
        leagueName: summary.leagueName,
        platform: row.platform,
        points: summary.points,
      };
      return entry;
    })
  );

  const entries = settled
    .map((s) => (s.status === "fulfilled" ? s.value : null))
    .filter((e): e is ScoreboardEntry => e !== null)
    .sort((a, b) => b.points - a.points);

  return NextResponse.json({ entries });
}
