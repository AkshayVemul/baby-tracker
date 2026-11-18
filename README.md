# Baby Tracker

A shared baby log: sleep, feeds, diapers, pumping, growth, health and activities, with live timers and charts.
Data lives in Supabase (Postgres + Auth + Realtime). Each parent or carer signs in with their own account and joins
the baby's household with an invite code; entries sync live between phones.

## Supabase setup

1. In the Supabase dashboard, open **SQL Editor**, paste `supabase/migrations/0001_init.sql` and run it.
2. **Authentication → URL Configuration**: set the Site URL to where the app runs (e.g. `http://localhost:5190`
   for now, your GitHub Pages URL later) and add both under Redirect URLs. Confirmation and password-reset emails
   link there.
3. Copy `.env.example` to `.env.local` and fill in the project URL and **publishable** (or legacy anon) key from
   **Project Settings → API**. Never use the secret/service_role key in this app.
4. For GitHub Pages, add the same two values as repository **variables** (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`).

Row level security limits every table to members of the household, so the publishable key in the browser can't
read anyone else's data. Unit preferences (ml/oz etc.) stay per device in `localStorage`.

```bash
pnpm install
pnpm dev      # start the app (add --host to open it from your phone on the same Wi-Fi)
pnpm test     # unit tests for the daily stats
pnpm build    # type-check + production build
```

## What it does

- **Today** — "since last" strip (last feed, last diaper, awake/asleep for), one-tap timers for sleep,
  breastfeeding (left/right, switch sides, suggests the next side) and activities (tummy time, bath…),
  quick-log buttons for wet/dirty diapers and bottles, today's totals and today's log. Timers keep running
  across reloads because a running timer is just an entry without an end time.
- **Log anything** — the form handles every type, past entries, and edits; deleting or quick-logging shows an
  undo toast.
- **History** — full-text search (notes, food, medicine, "dirty", "left"…), type filters, a date range, and a
  per-type count of what matched.
- **Charts** — 7/14/30/90-day range on one page: a 24-hour daily rhythm view, sleep per day (night vs naps),
  feeds per day, time breastfeeding, bottle volume, diapers per day, and weight/length/head growth curves. Every
  chart has hover/tap tooltips and a table view.
- **Settings** — baby's name and birth date (shows age), ml/oz, kg/lb, cm/in, °C/°F, JSON backup/restore,
  CSV export, sample data, delete all.

## Offline

Logging works with no signal. Every change is shown at once, saved in this phone's `localStorage` outbox, and sent
to Supabase when the connection is back (immediately, when the app comes back online or to the foreground, and
every 30 seconds while anything is waiting). The header shows "Offline" or how many changes are waiting. The app
also keeps a copy of the household's entries, the household and the sign-in session, so it opens offline, and
`public/sw.js` caches the app files after the first visit. Restore, sample data and delete-all still need a
connection. Signing out clears this phone's copies (with a warning if changes haven't synced).

## How it fits together

- `src/types.ts` — the single flat `Entry` shape every log type uses (metric units, epoch ms).
- `src/lib/entries.ts` — per-type config (labels, emoji, sub-kinds) and timer rules.
- `src/lib/stats.ts` — pure per-day aggregation for the charts and tiles (sleep is split at midnight and at
  7am/7pm for night vs naps). Unit-tested.
- `supabase/migrations/0001_init.sql` — tables (`households`, `household_members`, `entries`), RLS policies,
  `create_household` / `join_household` functions, realtime publication.
- `src/lib/outbox.ts` + `src/hooks/useEntries.ts` — the offline queue (unit-tested) and the offline-first entries state with Realtime.
- `src/lib/db.ts` — Supabase queries and the `Entry` ↔ row mapping (unit-tested). `src/Root.tsx` routes between
  setup, sign-in, household setup and the app; `App.tsx` applies changes optimistically and subscribes to Realtime.
- `src/lib/storage.ts`, `transfer.ts`, `sample.ts`, `units.ts` — device preferences, backup/CSV, demo data, unit
  conversion.
- `src/components/charts/` — small hand-rolled SVG charts (no chart library). Series colours come from a
  colour-blind-checked categorical palette defined as CSS variables in `src/index.css`.

Pushing to `main` on GitHub deploys to GitHub Pages via `.github/workflows/deploy.yml`.
