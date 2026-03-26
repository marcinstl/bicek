# RPG XP formulas (proposed)

## Final 4 formulas

1. `weighted_reps`
  - `XP = floor((kg * reps) / 10)`
2. `bodyweight_reps`
  - `XP = floor(35 * sqrt(reps))`
3. `time_based`
  - `XP = floor(60 * sqrt(minutes))`
  - where `minutes = duration_seconds / 60`
4. `distance_per_time` (adjusted)
  - `XP = floor(10 * sqrt(distance_km * avgSpeedKmh))`
  - where `avgSpeedKmh = distance_km / (duration_seconds / 3600)`

## Why this distance formula

- Previous `distance * avgSpeed` over-rewarded long bike sessions and under-rewarded shorter hard cardio.
- `sqrt(distance * speed)` keeps distance and pace important, but compresses extreme values.
- This gives a more fair spread between short hard runs and long bike rides.

## Examples

### Weighted reps

- `40kg x 10` -> `floor(400/10)` = `40 XP`
- `60kg x 10` -> `60 XP`
- `80kg x 8` -> `64 XP`

### Bodyweight reps

- `5 reps` -> `floor(35 * sqrt(5))` = `78 XP`
- `10 reps` -> `110 XP`
- `20 reps` -> `156 XP`
- `30 reps` -> `191 XP`

### Time based

- `45s` (0.75 min) -> `floor(60 * sqrt(0.75))` = `51 XP`
- `1 min` -> `60 XP`
- `5 min` -> `134 XP`
- `20 min` -> `268 XP`

### Distance per time (adjusted)

- `2.00 km in 16:00` (7.5 km/h) -> `floor(10 * sqrt(15))` = `38 XP`
- `2.27 km in 16:00` (8.5 km/h) -> `floor(10 * sqrt(19.295))` = `43 XP`
- `30 km in 2:00` (15.0 km/h) -> `floor(10 * sqrt(450))` = `212 XP`
- `40 km in 2:20` (~17.14 km/h) -> `floor(10 * sqrt(685.71))` = `261 XP`

## Notes for implementation

- Always clamp invalid inputs to `0 XP` (null, NaN, negative values).
- Keep `floor()` at set level, then sum per exercise and workout.

