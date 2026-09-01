"use client";

import { useState } from "react";
import { Trash2, TriangleAlert, RefreshCw } from "lucide-react";
import type { TeamResult } from "@/utils/types";
import RosterBreakdown from "./RosterBreakdown";
import ConfirmModal from "./ConfirmModal";

export default function LeagueCard({
  result,
  onDelete,
}: {
  result: TeamResult;
  onDelete: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const platformLabel = result.platform === "sleeper" ? "Sleeper" : "ESPN";
  const badgeClass =
    result.platform === "sleeper"
      ? "bg-sleeper/15 text-sleeper border-sleeper/30"
      : "bg-espn/15 text-red-400 border-espn/30";

  function handleConfirmDelete() {
    setConfirmOpen(false);
    onDelete(result.id);
  }

  const confirmModal = confirmOpen && (
    <ConfirmModal
      title="Remove this league?"
      message={
        result.status === "ok"
          ? `This will unlink "${result.leagueName}" from your dashboard. You can always add it back later.`
          : "This will unlink the league from your dashboard. You can always add it back later."
      }
      confirmLabel="Remove"
      onConfirm={handleConfirmDelete}
      onCancel={() => setConfirmOpen(false)}
    />
  );

  if (result.status === "error") {
    return (
      <div className="group relative rounded-card border border-field-700 bg-field-900/60 p-5">
        <div className="flex items-start justify-between">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
          >
            {platformLabel}
          </span>
          <button
            onClick={() => setConfirmOpen(true)}
            className="focus-ring rounded-md p-1 text-chalk-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
            aria-label="Remove league"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 text-amber-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm leading-snug text-chalk-300">
            {result.errorMessage}
          </p>
        </div>
        <p className="mt-3 text-xs text-chalk-500">
          League ID: {result.leagueId}
        </p>

        {confirmModal}
      </div>
    );
  }

  const record = `${result.wins}-${result.losses}${
    result.ties ? `-${result.ties}` : ""
  }`;

  return (
    <div className="group relative rounded-card border border-field-700 bg-field-900/80 p-5 transition-colors hover:border-field-600">
      <div className="flex items-start justify-between">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
        >
          {platformLabel}
        </span>
        <button
          onClick={() => setConfirmOpen(true)}
          className="focus-ring rounded-md p-1 text-chalk-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
          aria-label="Remove league"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-4 truncate font-display text-2xl tracking-wide text-chalk-100">
        {result.leagueName}
      </p>
      <span className="mt-1 inline-block rounded-full bg-field-700/60 px-2 py-0.5 text-xs text-chalk-300">
        {result.scoringFormat}
      </span>

      <div className="mt-5 flex items-end justify-between border-t border-field-700 pt-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-chalk-500">
            Record
          </p>
          <p className="font-display text-3xl text-chalk-100">{record}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-chalk-500">
            Points
          </p>
          <p className="font-display text-3xl text-lights-500">
            {result.pointsFor.toFixed(1)}
          </p>
        </div>
      </div>

      <RosterBreakdown leagueRowId={result.id} />

      {confirmModal}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-card border border-field-700 bg-field-900/60 p-5">
      <div className="h-5 w-16 animate-pulse rounded-full bg-field-700/70" />
      <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-field-700/70" />
      <div className="mt-2 h-4 w-20 animate-pulse rounded-full bg-field-700/50" />
      <div className="mt-5 flex items-end justify-between border-t border-field-700 pt-4">
        <div className="h-8 w-12 animate-pulse rounded bg-field-700/70" />
        <div className="h-8 w-16 animate-pulse rounded bg-field-700/70" />
      </div>
    </div>
  );
}

export function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
  );
}
