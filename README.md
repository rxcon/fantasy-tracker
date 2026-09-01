# The Standings — Family Fantasy League Tracker

A multi-platform (Sleeper + ESPN) fantasy football dashboard. Each family
member signs in with their own account and links their own leagues; nobody
sees anyone else's data.

## 1. Set up Supabase

1. Go to your Supabase project (or create one at supabase.com).
2. **SQL Editor > New query** — paste the contents of `supabase/migration.sql`
   and run it. This creates the `user_leagues` table with Row Level Security
   already turned on, so each user can only see/add/delete their own rows.
3. **Authentication > Providers** — Email should already be enabled by
   default. If you don't want the "confirm your email" step for a small
   family group, go to **Authentication > Settings** and turn off "Confirm
   email."
4. **Project Settings > API** — copy the **Project URL** and the
   **anon / public key**. You'll need these next.

## 2. Configure environment variables

Copy the template and fill it in:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
CREDENTIALS_ENCRYPTION_KEY=your-32-byte-base64-key
```

Generate the encryption key (used to encrypt ESPN's `espn_s2`/`SWID` cookies
before they're stored — these are live session cookies, so they're never
written to the database in plaintext):

```bash
openssl rand -base64 32
```

## 3. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, create an account, and start adding leagues.

## 4. Deploy to Vercel

```bash
npm install -g vercel   # if you don't have it
vercel login
vercel
```

When prompted, or afterward in the Vercel dashboard under
**Settings > Environment Variables**, add the same three variables from step
2 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`CREDENTIALS_ENCRYPTION_KEY`). Then redeploy:

```bash
vercel --prod
```

## Finding your Sleeper / ESPN details

**Sleeper**
- League ID: open your league on sleeper.com, the number in the URL
  (`sleeper.com/leagues/<league_id>/...`) is it.
- Username: your normal Sleeper login handle.

**ESPN**
- League ID: the `leagueId` query param in your league's URL on
  fantasy.espn.com.
- SWID / espn_s2 (only needed for **private** leagues): while logged into
  fantasy.espn.com, open your browser's dev tools → Application/Storage →
  Cookies → espn.com, and copy the values of `SWID` and `espn_s2`.
  These act like a login session for your ESPN account, so only add them to
  a tracker you trust — this app encrypts them before storing them, but
  treat them the same way you'd treat a password.

## How refresh works

Hitting **Refresh** calls one API route that fetches every linked league in
parallel. If one league fails (wrong ID, expired ESPN cookies, etc.), only
that card shows an error — the rest of your dashboard still loads normally.

## Notes / things worth knowing

- Each (platform, league ID, season) combination can only be linked once per
  user — adding the same league twice is blocked at the database level.
- If an ESPN card shows a session-expired error, remove it and re-add it with
  a fresh SWID/espn_s2 pulled from your browser.
- Public ESPN leagues don't need SWID/espn_s2 at all — leave those fields
  blank.
