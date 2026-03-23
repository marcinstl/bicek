-- Introduce explicit exercise kind and distance-based sets.
alter table exercises
  add column if not exists kind text;

-- Backfill kind from the old unit/metric_type model.
update exercises
set kind = case
  when metric_type = 'reps' and unit is not null then 'weighted_reps'
  when metric_type = 'reps' then 'bodyweight_reps'
  when metric_type in ('time', 'time_sec', 'time_min') then 'time_based'
  when unit = 'km' then 'distance_per_time'
  else 'bodyweight_reps'
end
where kind is null;

alter table exercises
  alter column kind set default 'bodyweight_reps';

update exercises
set kind = 'bodyweight_reps'
where kind is null;

alter table exercises
  alter column kind set not null;

alter table exercises
  drop constraint if exists exercises_kind_check;

alter table exercises
  add constraint exercises_kind_check
  check (kind in ('weighted_reps', 'bodyweight_reps', 'time_based', 'distance_per_time'));

alter table sets
  add column if not exists distance_km numeric;
