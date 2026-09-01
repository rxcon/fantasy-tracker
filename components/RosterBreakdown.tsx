"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { RosterPlayer, RosterResponse } from "@/utils/types";

export default function RosterBreakdown({ leagueRowId }: { leagueRowId: string }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [week, setWeek] = useState<number | null>(null);
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadRoster() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fantasy/roster?id=${leagueRowId}`);
      const body: RosterResponse = await res.json();
      if (body.status === "ok") {
        setWeek(body.week);
        setPlayers(body.players);
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

  return (
    <div className="mt-4 border-t border-field-700 pt-3">
      <button
        onClick={handleToggle}
        className="focus-ring flex w-full items-center justify-between text-xs font-semibold text-chalk-500 transition-colors hover:text-chalk-100"
      >
        <span>
          Player breakdown{week ? ` — Week ${week}` : ""}
        </span>
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
            <div className="space-y-3">
              {starters.length > 0 && (
                <PlayerGroup label="Starters" players={starters} />
              )}
              {bench.length > 0 && <PlayerGroup label="Bench" players={bench} />}
            </div>
          )}
        </div>
      )}
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
        {players.map((p) => (
          <div
            key={p.playerId}
            className="flex items-center justify-between rounded-md bg-field-950/60 px-2.5 py-1.5 text-sm"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="w-10 shrink-0 text-[11px] font-semibold text-chalk-500">
                {p.slot}
              </span>
              <span className="truncate text-chalk-100">{p.name}</span>
              <span className="shrink-0 text-xs text-chalk-500">{p.proTeam}</span>
            </div>
            <span className="shrink-0 font-display text-lg text-lights-500">
              {p.points.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
