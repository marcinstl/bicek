-- Legacy constraint no longer matches current model (exercise kind-based config).
alter table exercises
  drop constraint if exists at_least_one_config;
