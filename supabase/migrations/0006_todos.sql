-- Daily to-dos for the baby and mom (vitamin D, take meds…), shared by the household. The list lives on the
-- household, like the feed interval; each tick is an entry of type 'todo', so ticking works offline and reaches
-- the other phones like any other log.
alter table public.households add column todos jsonb not null default '[]'::jsonb;

alter table public.entries drop constraint entries_type_check;
alter table public.entries add constraint entries_type_check
  check (type in ('sleep', 'feed', 'diaper', 'pump', 'growth', 'health', 'activity', 'note', 'todo'));
