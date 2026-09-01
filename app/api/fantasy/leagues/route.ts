import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { encryptSecret } from "@/utils/crypto";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const { platform, leagueId, sleeperUsername, espnSwid, espnS2, season } = body;

  if (!platform || !leagueId) {
    return NextResponse.json(
      { error: "Platform and League ID are required." },
      { status: 400 }
    );
  }
  if (platform !== "sleeper" && platform !== "espn") {
    return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
  }
  if (platform === "sleeper" && !sleeperUsername) {
    return NextResponse.json(
      { error: "Sleeper username is required." },
      { status: 400 }
    );
  }

  const row = {
    user_id: user.id,
    platform,
    league_id: String(leagueId).trim(),
    season: season ? String(season) : "2026",
    sleeper_username: platform === "sleeper" ? sleeperUsername.trim() : null,
    espn_swid:
      platform === "espn" && espnSwid ? encryptSecret(espnSwid.trim()) : null,
    espn_s2:
      platform === "espn" && espnS2 ? encryptSecret(espnS2.trim()) : null,
  };

  const { data, error } = await supabase
    .from("user_leagues")
    .insert(row)
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation — they already added this exact league.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That league is already linked." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ league: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing league id." }, { status: 400 });
  }

  // RLS also enforces this, but scoping the delete explicitly to the
  // caller keeps the intent obvious and gives a clean error either way.
  const { error } = await supabase
    .from("user_leagues")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
