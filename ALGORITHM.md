# Algorytm progresji - bicek

## Przegląd

Algorytm adaptacyjnie zwiększa cel powtórzeń na podstawie trzech czynników:
1. **dailyRate** -- tempo wzrostu, dostosowywane na bieżąco do performancu użytkownika
2. **daysPerWeek** -- częstotliwość treningów, wpływa na skok na sesję
3. **performance** -- stosunek wykonanych powtórzeń do celu

Użytkownik nie widzi `dailyRate` ani szczegółów algorytmu. Widzi tylko cel na dziś i forecast.

---

## Wzór na nowy cel

```
effectiveRate = dailyRate × √(7 / daysPerWeek)
nextTarget = currentTarget × (1 + effectiveRate)
displayTarget = Math.floor(nextTarget)
```

`currentTarget` jest przechowywany jako float. `Math.floor()` jest stosowany wyłącznie przy wyświetlaniu.

---

## Frequency multiplier

Mnożnik `√(7 / daysPerWeek)` powoduje, że mniej treningów w tygodniu = większy skok na sesję.

| Dni przerwy | Treningi/tydzień | Mnożnik | Efekt |
|:-----------:|:----------------:|:-------:|:------|
| 0 | 7 | 1.00 | Bazowy wzrost |
| 1 | 6 | 1.08 | +8% na sesję |
| 2 | 5 | 1.18 | +18% na sesję |
| 3 | 4 | 1.32 | +32% na sesję |
| 4 | 3 | 1.53 | +53% na sesję |
| 5 | 2 | 1.87 | +87% na sesję |
| 6 | 1 | 2.65 | +165% na sesję |

---

## dailyRate -- adaptacja do performancu

`dailyRate` startuje od `0.01` i jest dostosowywany po każdej sesji treningowej.

| Wykonanie | Stosunek | Zmiana dailyRate | Opis |
|:---------:|:--------:|:----------------:|:-----|
| ≥100% | completed/target ≥ 1.0 | +0.001 | Świetnie, przyspieszamy |
| 85-99% | 0.85 ≤ ratio < 1.0 | bez zmian | Dobry poziom, utrzymujemy |
| 60-84% | 0.60 ≤ ratio < 0.85 | -0.002 | Trochę za szybko, zwalniamy |
| <60% | ratio < 0.60 | -0.005 | Za ciężko, mocno zwalniamy |

**Limity dailyRate:**
- Minimum: `0.002` (cel rośnie minimalnie, ale zawsze rośnie)
- Maximum: `0.015` (zapobiega zbyt szybkiemu wzrostowi)

---

## Przykład: effectiveRate w praktyce

Przy `dailyRate = 0.01`:

| Treningi/tydzień | effectiveRate | Cel po 10 sesjach (start: 10) | Cel po 30 sesjach (start: 10) |
|:----------------:|:-------------:|:-----------------------------:|:-----------------------------:|
| 7 (codziennie) | 0.0100 | 11 | 13 |
| 5 | 0.0118 | 11 | 14 |
| 3 | 0.0153 | 11 | 15 |
| 1 | 0.0265 | 12 | 21 |

---

## Przykład: wpływ performancu na dailyRate

Scenariusz: start 10 powtórzeń, 5 treningów/tydzień, `dailyRate = 0.01`.

### Użytkownik zawsze robi 100%+

| Sesja | dailyRate | effectiveRate | Cel |
|:-----:|:---------:|:-------------:|:---:|
| 1 | 0.010 | 0.0118 | 10 |
| 2 | 0.011 | 0.0130 | 10 |
| 3 | 0.012 | 0.0142 | 10 |
| 4 | 0.013 | 0.0154 | 10 |
| 5 | 0.014 | 0.0165 | 10 |
| 6 | 0.015 | 0.0177 | 11 |
| 7 | 0.015 | 0.0177 | 11 |
| 10 | 0.015 | 0.0177 | 11 |
| 20 | 0.015 | 0.0177 | 13 |
| 30 | 0.015 | 0.0177 | 16 |

dailyRate szybko dochodzi do max (0.015) i tam zostaje.

### Użytkownik robi ~70% (zwalnia)

| Sesja | dailyRate | effectiveRate | Cel |
|:-----:|:---------:|:-------------:|:---:|
| 1 | 0.010 | 0.0118 | 10 |
| 2 | 0.008 | 0.0094 | 10 |
| 3 | 0.006 | 0.0071 | 10 |
| 4 | 0.004 | 0.0047 | 10 |
| 5 | 0.002 | 0.0024 | 10 |
| 10 | 0.002 | 0.0024 | 10 |
| 20 | 0.002 | 0.0024 | 10 |
| 30 | 0.002 | 0.0024 | 10 |

dailyRate spada do minimum. Cel prawie stoi w miejscu, czekając aż użytkownik się wzmocni.

### Użytkownik robi <60% (za ciężko)

dailyRate spada o 0.005 za sesję -- najszybszy spadek. Po 2 sesjach jest już na minimum. System "czeka" na użytkownika.

---

## Dni odpoczynku

### Budżet tygodniowy

Użytkownik ustawia `daysPerWeek` przy tworzeniu ćwiczenia. Reszta dni to budżet przerw:

```
restBudget = 7 - daysPerWeek
```

Użytkownik sam decyduje kiedy odpocząć (ikonka kawy w karcie ćwiczenia).

### Wymuszony odpoczynek (algorytm)

Algorytm wymusza dzień odpoczynku w dwóch przypadkach:

| Warunek | Kiedy |
|:--------|:------|
| 2 złe dni z rzędu | Ostatnie 2 sesje treningowe < 85% celu |
| 4 dni treningu z rzędu | Tylko gdy daysPerWeek ≥ 5 |

### Autobackfill

Jeśli użytkownik nie wpisze nic przez jeden lub więcej dni, pominięte dni są automatycznie oznaczane jako dni odpoczynku przy następnym otwarciu aplikacji.

---

## Seria (streak)

| Warunek | Efekt na streak |
|:--------|:----------------|
| completed/target ≥ 0.85 | streak + 1 |
| completed/target < 0.85 | streak = 0 |
| Dzień odpoczynku | streak bez zmian |

Seria jest wyłącznie informacyjna -- nie wpływa na algorytm progresji.

---

## Podsumowanie przepływu danych

```
1. Użytkownik wpisuje serie (np. 12, 10, 8 = 30 łącznie)
2. Klika "Zakończ dzień"
3. System oblicza ratio = 30 / target
4. adjustDailyRate() → nowy dailyRate
5. effectiveRate = dailyRate × √(7/daysPerWeek)
6. nextTarget = currentTarget × (1 + effectiveRate)
7. currentTarget = nextTarget (float)
8. Następnego dnia: displayTarget = Math.floor(currentTarget)
```
