-- The feed interval belongs to the household, so every member's "Next feed" agrees and a change on one phone
-- shows on the others. Defaults match what each phone used before: every 3 hours, from the start of the last feed.
alter table public.households
  add column feed_interval_min integer not null default 180 check (feed_interval_min >= 0 and feed_interval_min <= 24 * 60),
  add column feed_interval_from text not null default 'start' check (feed_interval_from in ('start', 'end'));
