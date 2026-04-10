# Skill tree — plan (model danych, canvas, gra)

**Status (2026-04):** wdrożony jest **tylko edytor** na `/admin/skill-tree` (localhost) — stan w pamięci, przycisk **Kopiuj JSON**; **bez zapisu w Supabase**. Kolejne kroki: migracja, API, readonly w grze, unlocki, podpięcie huntów/XP/inventory.

## Założenia

- **Definicja drzewka** jest **globalna** (jedna wersja na grę); gracz widzi **całe drzewko** od razu — **bez fog of war**.
- **Postęp** per user: odblokowane `node_id` (ew. **ranga** w węźle, wzorzec 0/max na UI).
- Efekty węzłów deklaratywne; agregacja po stronie serwera (docelowo).

### Referencja wizualna

Ciemne tło, **trzy korzenie** (u nas: **Exp / Inventory / Hunting**) z kolorami (zieleń / bursztyn / róż), okrągłe węzły, szare krzywe, kłódka na zablokowanych w grze, licznik **0/max** przy węźle.

## 1. Canvas i logika w bazie (docelowo)

Tabela np. `rpg_skill_tree_definitions`: `version`, `graph` (jsonb) z `nodes` (id, branch, position, data, maxRanks, effect) i `edges` (id, source, target).

### Przykładowe `effect`

| Intencja | Przykład |
|----------|----------|
| Max hunt points | `hunt_points_max_delta` |
| Plecak | `inventory_max_delta` |
| Global XP % | `xp_global_pct_delta` |
| XP per kind | `xp_kind_pct_delta` |
| Odblokowanie hunta | `unlock_hunt_rarity` |
| Szansa na drop | `hunt_loot_luck` |

## 2. Postęp gracza (docelowo)

Tabela `rpg_user_skill_unlocks`: `user_id`, `node_id`, `rank`, `unlocked_at`. Walidacja prereqs przy `POST unlock`.

## 3. API (docelowo)

- `GET/PUT /api/admin/skill-tree` (localhost + service role)
- `GET /api/rpg/skill-tree` — pełny graph + unlocki
- `POST /api/rpg/skill-tree/unlock`

## 4. Edytor

- Implementacja: [`app/admin/skill-tree/`](../../app/admin/skill-tree/) + [`lib/skill-tree/types.ts`](../../lib/skill-tree/types.ts).
- Biblioteka: `@xyflow/react`.

## 5. Kolejność prac (reszta)

1. Migracja SQL + RLS  
2. Zod + `aggregateEffects`  
3. Admin API zapis/odczyt  
4. Widok readonly w grze + unlock  
5. Hunt start / `rollLoot` / XP / capy — podpięcie agregatu  

## 6. Otwarte

- Koszt odblokowania (waluta / fragmenty).

---

*Pełniejsza wersja planu z diagramami mermaid była w `.cursor/plans/`; ten plik jest kanoniczną kopią w repozytorium.*
