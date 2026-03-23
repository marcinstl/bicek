do $$
declare
  v_workout_id uuid := 'b09accd8-89fe-49b8-971f-eb99939ad913';
  v_user_id uuid := 'd6e1726f-6eaf-4d34-940a-254eb989ffcb';
  v_plan_id uuid := '169aec0b-2113-436b-a866-50d3dbbfe8c9';
  ex_lat uuid;
  ex_chest uuid;
  ex_biceps uuid;
  ex_row uuid;
  ex_abs uuid;
  ex_triceps uuid;
begin
  -- Idempotency guard: if this workout already has sets, skip.
  if exists (select 1 from sets where workout_id = v_workout_id) then
    return;
  end if;

  insert into workouts (id, user_id, plan_id, started_at, ended_at, created_at)
  values (
    v_workout_id,
    v_user_id,
    v_plan_id,
    '2026-03-16 21:20:00+01'::timestamptz,
    '2026-03-16 22:40:00+01'::timestamptz,
    '2026-03-16 22:40:00+01'::timestamptz
  )
  on conflict (id) do nothing;

  select id into ex_lat from exercises where plan_id = v_plan_id and name = 'Lat pulldown' order by created_at limit 1;
  if ex_lat is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Lat pulldown', 'weighted_reps') returning id into ex_lat;
  end if;

  select id into ex_chest from exercises where plan_id = v_plan_id and name = 'Chest press' order by created_at limit 1;
  if ex_chest is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Chest press', 'weighted_reps') returning id into ex_chest;
  end if;

  select id into ex_biceps from exercises where plan_id = v_plan_id and name = 'Biceps Curl' order by created_at limit 1;
  if ex_biceps is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Biceps Curl', 'weighted_reps') returning id into ex_biceps;
  end if;

  select id into ex_row from exercises where plan_id = v_plan_id and name = 'Seated Row' order by created_at limit 1;
  if ex_row is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Seated Row', 'weighted_reps') returning id into ex_row;
  end if;

  select id into ex_abs from exercises where plan_id = v_plan_id and name = 'Abdominal' order by created_at limit 1;
  if ex_abs is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Abdominal', 'weighted_reps') returning id into ex_abs;
  end if;

  select id into ex_triceps from exercises where plan_id = v_plan_id and name = 'Triceps pressdown' order by created_at limit 1;
  if ex_triceps is null then
    insert into exercises (plan_id, name, kind) values (v_plan_id, 'Triceps pressdown', 'weighted_reps') returning id into ex_triceps;
  end if;

  insert into sets (workout_id, exercise_id, value, reps, duration_seconds, distance_km, note)
  values
    -- Lat pulldown
    (v_workout_id, ex_lat, 32, 10, null, null, null),
    (v_workout_id, ex_lat, 39, 10, null, null, null),
    (v_workout_id, ex_lat, 45, 10, null, null, null),
    -- Chest press
    (v_workout_id, ex_chest, 36, 10, null, null, null),
    (v_workout_id, ex_chest, 36, 10, null, null, null),
    (v_workout_id, ex_chest, 36, 10, null, null, null),
    -- Biceps Curl
    (v_workout_id, ex_biceps, 23, 10, null, null, null),
    (v_workout_id, ex_biceps, 29, 10, null, null, null),
    (v_workout_id, ex_biceps, 29, 9, null, null, null),
    -- Seated Row
    (v_workout_id, ex_row, 29, 10, null, null, null),
    (v_workout_id, ex_row, 29, 10, null, null, null),
    (v_workout_id, ex_row, 29, 10, null, null, null),
    -- Abdominal
    (v_workout_id, ex_abs, 36, 10, null, null, null),
    (v_workout_id, ex_abs, 43, 10, null, null, null),
    (v_workout_id, ex_abs, 50, 10, null, null, null),
    -- Triceps pressdown
    (v_workout_id, ex_triceps, 14, 10, null, null, null),
    (v_workout_id, ex_triceps, 18, 10, null, null, null),
    (v_workout_id, ex_triceps, 18, 10, null, null, null);
end $$;
