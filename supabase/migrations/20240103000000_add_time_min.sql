-- Extend metric_type to support time_sec and time_min
-- (time remains valid for backward compatibility with existing rows)
alter table exercises
  drop constraint if exists exercises_metric_type_check;

alter table exercises
  add constraint exercises_metric_type_check
  check (metric_type in ('reps', 'time', 'time_sec', 'time_min'));
