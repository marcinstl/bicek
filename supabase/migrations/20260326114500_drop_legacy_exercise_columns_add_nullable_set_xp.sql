-- Remove legacy exercise config columns and prepare nullable per-set XP storage.
alter table exercises
  drop constraint if exists exercises_metric_type_check;

alter table exercises
  drop column if exists unit,
  drop column if exists metric_type;

alter table sets
  add column if not exists xp integer;
