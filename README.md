This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Jak działa XP (poziomy i mnożnik)

### Wzór na multiplier

- **Przy streak = 0:** `mult = 1`
- **Przy streak > 0:**
  - `rateNorm = (dailyRate - 0.002) / (0.015 - 0.002)` (zakres 0–1)
  - `streakNorm = 1 - 0.9^streak` (zakres 0–1)
  - `mult = clamp(1, 5, 1 + 4 × (0.5×rateNorm + 0.5×streakNorm))`
- Stałe: `MIN_RATE = 0.002`, `MAX_RATE = 0.015`

### Exp do zdobycia na dzisiaj (maks.)

`maxDailyXp = floor(target × baseExpPerRep(userLevel) × multiplier(dailyRate, streak))`

- `target` = cel na dziś = `floor(exercise.currentTarget)`
- `baseExpPerRep(level) = 1 + floor(level / 10)` (level z totalXp użytkownika)
- `multiplier` = jak wyżej z `exercise.dailyRate` i `exercise.streak`

### Exp do następnego poziomu

Krzywa leveli (styl Tibii):

- `totalXpForLevel(L) = 0` dla L ≤ 1, inaczej `50 × L²`
- `level = levelFromTotalXp(totalXp)` → dla totalXp < 200 level = 1, inaczej `floor(√(totalXp / 50))`
- **XP do następnego levelu:** `xpRemaining = totalXpForLevel(level + 1) - totalXp`
- Równoważnie: `xpToNextLevel(level) = 50 × (2×level + 1)`

### Czy da się to uzyskać z archiwalnych danych?

| Wartość | Skąd w archiwum |
|--------|------------------|
| **Multiplier** | `exercise.dailyRate`, `exercise.streak` (w `exercises[]`) |
| **Max exp na dziś** | `exercise.currentTarget`, `exercise.dailyRate`, `exercise.streak` + `user.totalXp` (level → baseExpPerRep) |
| **Exp do next level** | Tylko `user.totalXp` (level i xpRemaining z totalXpForLevel / levelFromTotalXp) |

Wszystkie trzy rzeczy da się policzyć z danych archiwalnych (backup/export): `user.totalXp` oraz w `exercises` pola `currentTarget`, `dailyRate`, `streak`. Nie trzeba nic dodatkowo zapisywać „pod exp” żeby te wzory działały.

**Opcjonalnie zapisane:** `user.totalXp` musi być zapisane (do levelu i „XP do next level”). `dailyLog.xpEarned` nie jest potrzebne do powyższych wzorów; służy do pokazania „ile dziś zdobyte” i do cofnięcia XP przy resecie dnia. `exercise.totalXpEarned` tylko do wyświetlania „zdobyte z tego ćwiczenia”.
