# RPG XP formulas

## Final 4 formulas

1. `weighted_reps`
  - `XP = floor((kg * reps) / 10)`
2. `bodyweight_reps`
  - `XP = floor(35 * sqrt(reps))`
3. `time_based`
  - `XP = floor(60 * sqrt(minutes))`
  - where `minutes = duration_seconds / 60`
4. `distance_per_time`
  - `XP = floor(T * sqrt(minutes) + D * sqrt(distance_km))`
  - `minutes = duration_seconds / 60`
  - Stałe w kodzie: `T = DISTANCE_PER_TIME_TIME_WEIGHT` (72), `D = DISTANCE_PER_TIME_DISTANCE_WEIGHT` (12) — [`lib/rpg/xp.ts`](lib/rpg/xp.ts)

## Why this distance_per_time formula

- Starszy wzór `10 * sqrt(distance * avgSpeed)` karał długi, wolniejszy wysiłek (ten sam dystans w dłuższym czasie → mniejsza prędkość → mniej XP).
- Czas treningu jest główną bazą (`sqrt(minutes)`), dystans dodaje umiarkowany bonus; prędkość nie jest osobnym mnożnikiem — lepsze porównanie z sumarycznym XP z godziny na siłowni przy długich przejazdach / biegach.

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

### Distance per time (T=72, D=12)

- `2 km in 16:00` -> `floor(72 * sqrt(16) + 12 * sqrt(2))` ≈ `298 XP`
- `10 km in 60:00` -> `floor(72 * sqrt(60) + 12 * sqrt(10))` ≈ `595 XP`
- `60 km in 3:00` -> `floor(72 * sqrt(180) + 12 * sqrt(60))` ≈ `1032 XP`

## Notes for implementation

- Always clamp invalid inputs to `0 XP` (null, NaN, negative values).
- Keep `floor()` at set level, then sum per exercise and workout.

## Jednorazowe przeliczenie `sets.xp` w Supabase

Wzór jest tylko w aplikacji; po zmianie wzoru możesz zaktualizować istniejące wiersze jednym zapytaniem SQL (po liście `exercise_id` z `kind = 'distance_per_time'`). Query z szablonem wygenerujemy, gdy podasz ID ćwiczeń.
