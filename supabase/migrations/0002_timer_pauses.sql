-- Pause and break time for breastfeeding and pumping timers. Run once in the Supabase SQL editor
-- BEFORE deploying the app version that uses it: that version writes these columns on every save.

alter table public.entries
  -- Time not spent feeding or pumping (pauses, unlatching), subtracted from the duration. Milliseconds.
  add column paused_ms bigint check (paused_ms >= 0),
  -- Set while a running timer is paused: when the current pause began.
  add column paused_at timestamptz;

-- Pumping now runs as a timer, where "no end time" means "still running". Older pump logs never had an end
-- time, so give them one (equal to the start) to keep them showing as finished.
update public.entries set end_at = start_at where type = 'pump' and end_at is null;
