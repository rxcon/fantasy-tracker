"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Plus, LogOut, RefreshCw, ClipboardList, Trophy, LayoutGrid } from "lucide-react";
import LeagueCard, { SkeletonCard } from "./LeagueCard";
import AddLeagueModal from "./AddLeagueModal";
import type { TeamResult } from "@/utils/types";

const COLUMN_OPTIONS = [2, 3, 4, 5] as const;
type ColumnCount = (typeof COLUMN_OPTIONS)[number];

// Tailwind's compiler only picks up class names it can see literally in
// the source, so a dynamically built string like `grid-cols-${n}` won't
// work — each option needs its full class combination spelled out here.
const GRID_CLASSES: Record<ColumnCount, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
};

const WIDTH_CLASSES: Record<ColumnCount, string> = {
  2: "max-w-4xl",
  3: "max-w-6xl",
  4: "max-w-7xl",
  5: "max-w-[100rem]",
};

const COLUMNS_STORAGE_KEY = "standings-grid-columns";

export default function Dashboard({ email }: { email: string }) {
  const supabase = createClient();
  const [results, setResults] = useState<TeamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnCount>(3);

  // This is a per-device display preference, not account data, so it
  // lives in localStorage rather than Supabase — it won't follow a
  // family member to a different browser, but it also means everyone
  // can set their own density without affecting anyone else's view.
  useEffect(() => {
    const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
    const parsed = stored ? (Number(stored) as ColumnCount) : null;
    if (parsed && COLUMN_OPTIONS.includes(parsed)) {
      setColumns(parsed);
    }
  }, []);

  function handleColumnsChange(next: ColumnCount) {
    setColumns(next);
    localStorage.setItem(COLUMNS_STORAGE_KEY, String(next));
  }

  const loadLeagues = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const res = await fetch("/api/fantasy/fetch-all");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't load your leagues.");
      }
      const body = await res.json();
      setResults(body.results ?? []);
    } catch (err: any) {
      setLoadError(err.message ?? "Couldn't load your leagues.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLeagues();
  }, [loadLeagues]);

  async function handleDelete(id: string) {
    setResults((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/fantasy/leagues?id=${id}`, { method: "DELETE" });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen field-lines pb-16">
      <header className="border-b border-field-700 bg-field-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="font-display text-3xl tracking-wide text-chalk-100">
              The Standings
            </p>
            <p className="text-sm text-chalk-500">{email}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/scoreboard"
              className="focus-ring flex items-center gap-2 rounded-lg border border-field-700 px-3 py-2 text-sm font-semibold text-chalk-100 transition-colors hover:bg-field-800"
            >
              <Trophy className="h-4 w-4 text-lights-500" />
              Scoreboard
            </Link>
            <button
              onClick={() => loadLeagues(true)}
              disabled={refreshing}
              className="focus-ring flex items-center gap-2 rounded-lg border border-field-700 px-3 py-2 text-sm font-semibold text-chalk-100 transition-colors hover:bg-field-800 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="focus-ring flex items-center gap-2 rounded-lg bg-lights-500 px-3 py-2 text-sm font-bold text-field-950 transition-colors hover:bg-lights-400"
            >
              <Plus className="h-4 w-4" />
              Add league
            </button>
            <button
              onClick={handleSignOut}
              className="focus-ring flex items-center gap-2 rounded-lg border border-field-700 px-3 py-2 text-sm font-semibold text-chalk-500 transition-colors hover:bg-field-800 hover:text-chalk-100"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto px-6 py-10 ${WIDTH_CLASSES[columns]}`}>
        {loadError && (
          <div className="mb-6 rounded-card border border-espn/30 bg-espn/10 px-4 py-3 text-sm text-red-300">
            {loadError}
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="mb-4 flex items-center justify-end gap-2">
            <LayoutGrid className="h-3.5 w-3.5 text-chalk-500" />
            <span className="text-xs text-chalk-500">Per row:</span>
            <div className="flex rounded-lg bg-field-950 p-0.5">
              {COLUMN_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => handleColumnsChange(n)}
                  className={`focus-ring rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    columns === n
                      ? "bg-lights-500 text-field-950"
                      : "text-chalk-500 hover:text-chalk-100"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className={`grid gap-4 ${GRID_CLASSES[columns]}`}>
            {Array.from({ length: columns }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-field-700 py-24 text-center">
            <ClipboardList className="h-8 w-8 text-chalk-500" />
            <p className="mt-4 font-display text-2xl tracking-wide text-chalk-100">
              No leagues on the board yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-chalk-500">
              Link a Sleeper or ESPN league to start tracking records and
              points in one place.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="focus-ring mt-6 flex items-center gap-2 rounded-lg bg-lights-500 px-4 py-2.5 text-sm font-bold text-field-950 transition-colors hover:bg-lights-400"
            >
              <Plus className="h-4 w-4" />
              Add your first league
            </button>
          </div>
        ) : (
          <div className={`grid gap-4 ${GRID_CLASSES[columns]}`}>
            {results.map((result) => (
              <LeagueCard key={result.id} result={result} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      {modalOpen && (
        <AddLeagueModal
          onClose={() => setModalOpen(false)}
          onAdded={() => {
            setModalOpen(false);
            loadLeagues(true);
          }}
        />
      )}
    </div>
  );
}
