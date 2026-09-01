"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthForm() {
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setMessage(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 field-lines">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="font-display text-5xl tracking-wide text-chalk-100">
            The Standings
          </p>
          <p className="mt-2 text-sm text-chalk-500">
            Every league, every platform, one scoreboard.
          </p>
        </div>

        <div className="rounded-card border border-field-700 bg-field-900/80 p-6 shadow-xl backdrop-blur">
          <div className="mb-6 flex rounded-lg bg-field-950 p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`focus-ring flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                mode === "signin"
                  ? "bg-lights-500 text-field-950"
                  : "text-chalk-500 hover:text-chalk-100"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`focus-ring flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                mode === "signup"
                  ? "bg-lights-500 text-field-950"
                  : "text-chalk-500 hover:text-chalk-100"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-chalk-500">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-ring w-full rounded-lg border border-field-700 bg-field-950 px-3 py-2.5 text-sm text-chalk-100 placeholder:text-chalk-500/60"
                placeholder="you@family.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-chalk-500">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="focus-ring w-full rounded-lg border border-field-700 bg-field-950 px-3 py-2.5 text-sm text-chalk-100 placeholder:text-chalk-500/60"
                placeholder="••••••••"
              />
            </div>

            {errorMsg && (
              <p className="rounded-lg bg-espn/10 px-3 py-2 text-sm text-red-300">
                {errorMsg}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-field-700/50 px-3 py-2 text-sm text-chalk-100">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-lights-500 py-2.5 text-sm font-bold text-field-950 transition-colors hover:bg-lights-400 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
