"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { OpponentInfo, RosterPlayer, RosterResponse } from "@/utils/types";

// ESPN's live "possessionText" reads like "1st & 10 at NE 14" — pull just
// the trailing "team yard-line" part off the end for a compact badge.
function redZoneLabel(situationText?: string): string {
  const match = situationText?.match(/at\s+([A-Z]{2,3}\s?\d{1,2})\s*$/i);
  return match ? `Red Zone · ${match[1]}` : "Red Zone";
}

export default function RosterBreakdown({ leagueRowId }: { leagueRowId: string }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [week, setWeek] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [opponent, setOpponent] = useState<OpponentInfo>(null);
  const [error, setError] = useState<string | null>(null);
  const [headToHeadOpen, setHeadToHeadOpen] = useState(false);

  async function loadRoster() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fantasy/roster?id=${leagueRowId}`);
      const body: RosterResponse = await res.json();
      if (body.status === "ok") {
        setWeek(body.week);
        setMyPoints(body.myPoints);
        setPlayers(body.players);
        setOpponent(body.opponent);
        setLoaded(true);
      } else {
        setError(body.errorMessage);
      }
    } catch {
      setError("Couldn't load the player breakdown.");
    } finally {
      setLoading(false);
    }
  }

  // Expanded by default, so load the roster as soon as the card mounts
  // rather than waiting for a click.
  useEffect(() => {
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueRowId]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) {
      loadRoster();
    }
  }

  const starters = players.filter((p) => p.isStarter);
  const bench = players.filter((p) => !p.isStarter);
  const iAmWinning = opponent ? myPoints >= opponent.totalPoints : null;

  return (
    <div className="mt-4 border-t border-field-700 pt-3">
      <button
        onClick={handleToggle}
        className="focus-ring flex w-full items-center justify-between text-xs font-semibold text-chalk-500 transition-colors hover:text-chalk-100"
      >
        <span>Week {week ?? "..."} matchup</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-3">
          {loading && (
            <div className="flex items-center gap-2 py-4 text-sm text-chalk-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading roster...
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-espn/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {!loading && !error && loaded && (
            <div className="space-y-4">
              {opponent ? (
                <div>
                  <div className="flex items-center justify-between rounded-lg bg-field-950/60 px-3 py-2.5">
                    <div className="flex-1 text-center">
                      <p className="text-[11px] uppercase tracking-wide text-chalk-500">
                        You
                      </p>
                      <p
                        className={`font-display text-2xl ${
                          iAmWinning ? "text-lights-500" : "text-chalk-100"
                        }`}
                      >
                        {myPoints.toFixed(1)}
                      </p>
                    </div>
                    <span className="mx-2 shrink-0 text-[10px] font-bold text-chalk-500">
                      VS
                    </span>
                    <div className="flex-1 text-center">
                      <p className="truncate text-[11px] uppercase tracking-wide text-chalk-500">
                        {opponent.teamName}
                      </p>
                      <p
                        className={`font-display text-2xl ${
                          !iAmWinning ? "text-lights-500" : "text-chalk-100"
                        }`}
                      >
                        {opponent.totalPoints.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setHeadToHeadOpen((v) => !v)}
                    className="focus-ring mt-2 flex w-full items-center justify-between text-[11px] font-semibold text-chalk-500 transition-colors hover:text-chalk-100"
                  >
                    <span>Head-to-head lineups</span>
                    {headToHeadOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {headToHeadOpen && (
                    <HeadToHead
                      myStarters={starters}
                      oppStarters={opponent.players.filter((p) => p.isStarter)}
                    />
                  )}
                </div>
              ) : (
                <p className="rounded-lg bg-field-700/40 px-3 py-2 text-xs text-chalk-300">
                  No matchup found for this week (bye week, or the season hasn't started).
                </p>
              )}

              {starters.length > 0 && (
                <PlayerGroup label="Your Starters" players={starters} />
              )}
              {bench.length > 0 && <PlayerGroup label="Your Bench" players={bench} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HeadToHead({
  myStarters,
  oppStarters,
}: {
  myStarters: RosterPlayer[];
  oppStarters: RosterPlayer[];
}) {
  const rowCount = Math.max(myStarters.length, oppStarters.length);

  return (
    <div className="mt-2 space-y-1">
      {Array.from({ length: rowCount }).map((_, i) => {
        const mine = myStarters[i];
        const theirs = oppStarters[i];
        const slotLabel = mine?.slot ?? theirs?.slot ?? "-";
        const mineHigher = (mine?.points ?? 0) >= (theirs?.points ?? 0);
        const eitherInRedZone = Boolean(mine?.liveStatus?.isRedZone || theirs?.liveStatus?.isRedZone);

        return (
          <div
            key={i}
            className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md bg-field-950/60 px-2 py-1.5 ${
              eitherInRedZone ? "redzone-glow" : ""
            }`}
          >
            <div className="flex items-center justify-end gap-2 truncate text-right">
              {mine?.liveStatus?.isRedZone && <span className="shrink-0 text-xs">⚡</span>}
              <span className="truncate text-xs text-chalk-100">
                {mine?.name ?? "—"}
              </span>
              <span
                className={`font-display text-base shrink-0 ${
                  mineHigher ? "text-lights-500" : "text-chalk-500"
                }`}
              >
                {(mine?.points ?? 0).toFixed(1)}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-field-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-chalk-300">
              {slotLabel}
            </span>
            <div className="flex items-center gap-2 truncate">
              <span
                className={`font-display text-base shrink-0 ${
                  !mineHigher ? "text-lights-500" : "text-chalk-500"
                }`}
              >
                {(theirs?.points ?? 0).toFixed(1)}
              </span>
              <span className="truncate text-xs text-chalk-100">
                {theirs?.name ?? "—"}
              </span>
              {theirs?.liveStatus?.isRedZone && <span className="shrink-0 text-xs">⚡</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlayerGroup({ label, players }: { label: string; players: RosterPlayer[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-chalk-500/80">
        {label}
      </p>
      <div className="space-y-1">
        {players.map((p) => {
          const inRedZone = Boolean(p.liveStatus?.isRedZone);
          return (
            <div
              key={p.playerId}
              className={`flex items-center justify-between rounded-md bg-field-950/60 px-2.5 py-1.5 text-sm ${
                inRedZone ? "redzone-glow" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2 truncate">
                <span className="w-10 shrink-0 text-[11px] font-semibold text-chalk-500">
                  {p.slot}
                </span>
                <span className="truncate text-chalk-100">{p.name}</span>
                <span className="shrink-0 text-xs text-chalk-500">{p.proTeam}</span>
                {inRedZone && (
                  <span className="shrink-0 rounded-full bg-lights-500/15 px-1.5 py-0.5 text-[10px] font-bold text-lights-400">
                    ⚡ {redZoneLabel(p.liveStatus?.situationText)}
                  </span>
                )}
              </div>
              <span className="shrink-0 font-display text-lg text-lights-500">
                {p.points.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
