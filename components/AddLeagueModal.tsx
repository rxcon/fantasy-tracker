"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

export default function AddLeagueModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [platform, setPlatform] = useState<"sleeper" | "espn">("sleeper");
  const [leagueId, setLeagueId] = useState("");
  const [sleeperUsername, setSleeperUsername] = useState("");
  const [espnSwid, setEspnSwid] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [season, setSeason] = useState("2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/fantasy/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        leagueId,
        sleeperUsername,
        espnSwid,
        espnS2,
        season,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong linking that league.");
      return;
    }

    onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-card border border-field-700 bg-field-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-display text-3xl tracking-wide text-chalk-100">
              Link a league
            </p>
            <p className="text-sm text-chalk-500">
              Connect a Sleeper or ESPN league to your dashboard.
            </p>
          </div>
          <button
            onClick={onClose}
            className="focus-ring rounded-md p-1 text-chalk-500 hover:text-chalk-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-chalk-500">
              Platform
            </label>
            <div className="flex rounded-lg bg-field-950 p-1">
              <button
                type="button"
                onClick={() => setPlatform("sleeper")}
                className={`focus-ring flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  platform === "sleeper"
                    ? "bg-sleeper text-white"
                    : "text-chalk-500 hover:text-chalk-100"
                }`}
              >
                Sleeper
              </button>
              <button
                type="button"
                onClick={() => setPlatform("espn")}
                className={`focus-ring flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  platform === "espn"
                    ? "bg-espn text-white"
                    : "text-chalk-500 hover:text-chalk-100"
                }`}
              >
                ESPN
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-chalk-500">
              League ID
            </label>
            <input
              required
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              placeholder="e.g. 1124567890123456789"
              className="focus-ring w-full rounded-lg border border-field-700 bg-field-950 px-3 py-2.5 text-sm text-chalk-100 placeholder:text-chalk-500/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-chalk-500">
              Season
            </label>
            <input
              required
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="focus-ring w-full rounded-lg border border-field-700 bg-field-950 px-3 py-2.5 text-sm text-chalk-100"
            />
          </div>

          {platform === "sleeper" ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-chalk-500">
                Sleeper username
              </label>
              <input
                required
                value={sleeperUsername}
                onChange={(e) => setSleeperUsername(e.target.value)}
                placeholder="your Sleeper handle"
                className="focus-ring w-full rounded-lg border border-field-700 bg-field-950 px-3 py-2.5 text-sm text-chalk-100 placeholder:text-chalk-500/60"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-chalk-500">
                  ESPN SWID{" "}
                  <span className="font-normal text-chalk-500/70">
                    (optional for public leagues)
                  </span>
                </label>
                <input
                  value={espnSwid}
                  onChange={(e) => setEspnSwid(e.target.value)}
                  placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
                  className="focus-ring w-full rounded-lg border border-field-700 bg-field-950 px-3 py-2.5 text-sm text-chalk-100 placeholder:text-chalk-500/60"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-chalk-500">
                  ESPN S2 Cookie{" "}
                  <span className="font-normal text-chalk-500/70">
                    (optional for public leagues)
                  </span>
                </label>
                <textarea
                  value={espnS2}
                  onChange={(e) => setEspnS2(e.target.value)}
                  rows={3}
                  placeholder="Paste the long espn_s2 cookie value"
                  className="focus-ring w-full resize-none rounded-lg border border-field-700 bg-field-950 px-3 py-2.5 text-sm text-chalk-100 placeholder:text-chalk-500/60"
                />
                <p className="mt-1 text-xs text-chalk-500/70">
                  Both are encrypted before they&apos;re stored.
                </p>
              </div>
            </>
          )}

          {error && (
            <p className="rounded-lg bg-espn/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-lights-500 py-2.5 text-sm font-bold text-field-950 transition-colors hover:bg-lights-400 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Link league
          </button>
        </form>
      </div>
    </div>
  );
}
