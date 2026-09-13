import { createClient } from "@supabase/supabase-js";

// Uses the Supabase service role key, which bypasses Row Level Security
// entirely. This is intentional and necessary for the site-wide
// scoreboard, which has to read every family member's leagues, not just
// the signed-in user's own rows.
//
// SAFETY RULES for this client:
// 1. Only ever import this from server-side code (API routes). Never
//    from a "use client" component — that would ship the service role
//    key to the browser.
// 2. Only ever return aggregated/derived fields from routes that use
//    it (team name, points, etc.) — never the raw row, which contains
//    encrypted ESPN credentials.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
