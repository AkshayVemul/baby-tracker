-- Bottle and solids feeds now have an end time (and can run as a paused/resumed timer), so "Next feed" can count
-- from when a bottle finished. Older ones were logged as a single moment; give them end = start so they show as
-- finished rather than as timers still running.
update public.entries
set end_at = start_at
where type = 'feed' and kind in ('bottle', 'solids') and end_at is null;
