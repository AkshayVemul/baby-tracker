-- A breastfeed or pump session that switches sides is now one entry with a time per side ("segments"),
-- instead of one entry per side.
alter table public.entries add column segments jsonb;

-- Merge sessions the earlier app saved as separate entries: the side switch ended one entry and started the
-- next at the very same instant, on the other side. Each chain becomes its first entry, with a segment per part;
-- the other parts are deleted. Break time and pump amounts are added up; notes are joined.
with parts as (
  select
    e.*,
    lag(end_at) over w as prev_end,
    lag(side) over w as prev_side
  from public.entries e
  where ((type = 'feed' and kind = 'breast') or type = 'pump') and side in ('left', 'right')
  window w as (partition by household_id, type order by start_at, id)
),
numbered as (
  select
    *,
    sum(case when prev_end = start_at and prev_side <> side then 0 else 1 end)
      over (partition by household_id, type order by start_at, id) as session
  from parts
),
sessions as (
  select
    (array_agg(id order by start_at))[1] as keep_id,
    (array_agg(id order by start_at))[2:] as merged_ids,
    min(start_at) as start_at,
    (array_agg(end_at order by start_at desc))[1] as end_at,
    (array_agg(side order by start_at desc))[1] as side,
    (array_agg(paused_at order by start_at desc))[1] as paused_at,
    nullif(sum(coalesce(paused_ms, 0)), 0) as paused_ms,
    sum(amount_ml) as amount_ml,
    string_agg(notes, ' · ' order by start_at) as notes,
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'side', side,
        'start', (extract(epoch from start_at) * 1000)::bigint,
        'end', (extract(epoch from end_at) * 1000)::bigint,
        'pausedMs', nullif(coalesce(paused_ms, 0), 0)
      ))
      order by start_at
    ) as segments
  from numbered
  group by household_id, type, session
  having count(*) > 1
),
merged as (
  update public.entries e
  set start_at = s.start_at,
      end_at = s.end_at,
      side = s.side,
      paused_at = s.paused_at,
      paused_ms = s.paused_ms,
      amount_ml = s.amount_ml,
      notes = s.notes,
      segments = s.segments
  from sessions s
  where e.id = s.keep_id
  returning e.id
)
delete from public.entries
where id in (select unnest(merged_ids) from sessions);
