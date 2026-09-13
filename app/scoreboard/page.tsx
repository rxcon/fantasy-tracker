"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Trophy } from "lucide-react";

type ScoreboardEntry = {
  teamName: string;
  ownerEmail: string;
  leagueName: string;
  platform: "sleeper" | "espn";
  points: number;
};

export default function ScoreboardPage() {
  const [entries, setEntries] = useState<ScoreboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fantasy/scoreboard");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't load the scoreboard.");
      }
      const body = await res.json();
      setEntries(body.entries ?? []);
    } catch (err: any) {
      setError(err.message ?? "Couldn't load the scoreboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen field-lines pb-16">
      <header className="border-b border-field-700 bg-field-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="focus-ring rounded-md p-1 text-chalk-500 hover:text-chalk-100"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="flex items-center gap-2 font-display text-3xl tracking-wide text-chalk-100">
                <Trophy className="h-6 w-6 text-lights-500" />
                Site Scoreboard
              </p>
              <p className="text-sm text-chalk-500">
                Every team, every league, ranked by total points.
              </p>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="focus-ring flex items-center gap-2 rounded-lg border border-field-700 px-3 py-2 text-sm font-semibold text-chalk-100 transition-colors hover:bg-field-800 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {error && (
          <div className="mb-6 rounded-card border border-espn/30 bg-espn/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-card border border-field-700 bg-field-900/60"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="rounded-card border border-dashed border-field-700 py-16 text-center text-chalk-500">
            No teams to rank yet — link a league from the dashboard first.
          </p>
        ) : (
          <div className="overflow-hidden rounded-card border border-field-700">
            {entries.map((entry, i) => (
              <div
                key={`${entry.ownerEmail}-${entry.leagueName}-${i}`}
                className={`flex items-center gap-4 px-4 py-3 ${
                  i % 2 === 0 ? "bg-field-900/60" : "bg-field-900/30"
                }`}
              >
                <span className="w-8 shrink-0 text-center font-display text-2xl text-chalk-500">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xl tracking-wide text-chalk-100">
                    {entry.teamName}
                  </p>
                  <p className="truncate text-xs text-chalk-500">
                    {entry.ownerEmail} · {entry.leagueName}
                  </p>
                </div>
                <span
                  className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:inline-block ${
                    entry.platform === "sleeper"
                      ? "bg-sleeper/15 text-sleeper border-sleeper/30"
                      : "bg-espn/15 text-red-400 border-espn/30"
                  }`}
                >
                  {entry.platform === "sleeper" ? "Sleeper" : "ESPN"}
                </span>
                <span className="w-20 shrink-0 text-right font-display text-2xl text-lights-500">
                  {entry.points.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
