do $$
declare
  v_workout_id uuid := 'f73e220c-e4dc-4cf9-81d6-10bbf50f1b7d';
  v_user_id uuid := 'd6e1726f-6eaf-4d34-940a-254eb989ffcb';
  v_plan_id uuid := '169aec0b-2113-436b-a866-50d3dbbfe8c9';
  ex_treadmill uuid;
  ex_lat uuid;
  ex_chest uuid;
  ex_triceps_press uuid;
  ex_biceps uuid;
  ex_triceps_pressdown uuid;
  ex_abs uuid;
  ex_row uuid;
  ex_leg_press uuid;
begin
  -- Skip on fresh local DB where the user doesn't exist yet.
  if not exists (select 1 from profiles where id = v_user_id) then
    return;
  end if;

  -- Idempotency guard.
  if exists (select 1 from sets where workout_id = v_workout_id) then
    return;
  end if;

  insert into workouts (id, user_id, plan_id, started_at, ended_at, created_at)
  values (
    v_workout_id,
    v_user_id,
    v_plan_id,
    '2026-03-20 21:20:00+01'::timestamptz,
    '2026-03-20 22:50:00+01'::timestamptz,
    '2026-03-20 22:50:00+01'::timestamptz
  )
  on conflict (id) do nothing;

  select id into ex_treadmill from exercises where plan_id = v_plan_id and name = 'Bieżnia' order by created_at limit 1;
  if ex_treadmill is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Bieżnia', 'distance_per_time') returning id into ex_treadmill;
  end if;

  select id into ex_lat from exercises where plan_id = v_plan_id and name = 'Lat pulldown' order by created_at limit 1;
  if ex_lat is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Lat pulldown', 'weighted_reps') returning id into ex_lat;
  end if;

  select id into ex_chest from exercises where plan_id = v_plan_id and name = 'Chest press' order by created_at limit 1;
  if ex_chest is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Chest press', 'weighted_reps') returning id into ex_chest;
  end if;

  select id into ex_triceps_press from exercises where plan_id = v_plan_id and name = 'Triceps press' order by created_at limit 1;
  if ex_triceps_press is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Triceps press', 'weighted_reps') returning id into ex_triceps_press;
  end if;

  select id into ex_biceps from exercises where plan_id = v_plan_id and name = 'Biceps Curl' order by created_at limit 1;
  if ex_biceps is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Biceps Curl', 'weighted_reps') returning id into ex_biceps;
  end if;

  select id into ex_triceps_pressdown from exercises where plan_id = v_plan_id and name = 'Triceps pressdown' order by created_at limit 1;
  if ex_triceps_pressdown is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Triceps pressdown', 'weighted_reps') returning id into ex_triceps_pressdown;
  end if;

  select id into ex_abs from exercises where plan_id = v_plan_id and name = 'Abdominal' order by created_at limit 1;
  if ex_abs is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Abdominal', 'weighted_reps') returning id into ex_abs;
  end if;

  select id into ex_row from exercises where plan_id = v_plan_id and name = 'Seated Row' order by created_at limit 1;
  if ex_row is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Seated Row', 'weighted_reps') returning id into ex_row;
  end if;

  select id into ex_leg_press from exercises where plan_id = v_plan_id and name = 'Suwnica' order by created_at limit 1;
  if ex_leg_press is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Suwnica', 'weighted_reps') returning id into ex_leg_press;
  end if;

  insert into sets (workout_id, exercise_id, value, reps, duration_seconds, distance_km, note)
  values
    -- Bieżnia: 2km / 16min
    (v_workout_id, ex_treadmill, null, null, 960, 2, null),

    -- Lat pulldown
    (v_workout_id, ex_lat, 39, 10, null, null, null),
    (v_workout_id, ex_lat, 45, 10, null, null, null),
    (v_workout_id, ex_lat, 45, 10, null, null, null),
    (v_workout_id, ex_lat, 52, 8, null, null, null),

    -- Chest press
    (v_workout_id, ex_chest, 36, 10, null, null, null),
    (v_workout_id, ex_chest, 36, 10, null, null, null),
    (v_workout_id, ex_chest, 36, 10, null, null, null),
    (v_workout_id, ex_chest, 36, 10, null, null, null),

    -- Triceps press
    (v_workout_id, ex_triceps_press, 50, 10, null, null, null),
    (v_workout_id, ex_triceps_press, 57, 10, null, null, null),
    (v_workout_id, ex_triceps_press, 57, 10, null, null, null),
    (v_workout_id, ex_triceps_press, 63, 8, null, null, null),

    -- Biceps Curl
    (v_workout_id, ex_biceps, 29, 10, null, null, null),
    (v_workout_id, ex_biceps, 29, 10, null, null, null),
    (v_workout_id, ex_biceps, 29, 10, null, null, null),
    (v_workout_id, ex_biceps, 36, 7, null, null, null),

    -- Triceps pressdown
    (v_workout_id, ex_triceps_pressdown, 16, 10, null, null, null),
    (v_workout_id, ex_triceps_pressdown, 16, 9, null, null, null),
    (v_workout_id, ex_triceps_pressdown, 12, 8, null, null, null),

    -- Abdominal
    (v_workout_id, ex_abs, 43, 10, null, null, null),
    (v_workout_id, ex_abs, 50, 10, null, null, null),
    (v_workout_id, ex_abs, 57, 10, null, null, 'ból w krzyżu przy powtórzeniach 6+'),

    -- Seated Row
    (v_workout_id, ex_row, 29, 10, null, null, null),
    (v_workout_id, ex_row, 29, 10, null, null, null),
    (v_workout_id, ex_row, 29, 10, null, null, null),

    -- Suwnica
    (v_workout_id, ex_leg_press, 40, 10, null, null, null),
    (v_workout_id, ex_leg_press, 55, 10, null, null, null),
    (v_workout_id, ex_leg_press, 70, 10, null, null, null);
end $$;
