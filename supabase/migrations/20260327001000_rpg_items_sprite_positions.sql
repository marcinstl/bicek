-- Optional sprite sheet positions for an item.
-- Format: [{"col": 0, "row": 3}]  (one entry = static, multiple = animation loop)
-- Pixel mapping: x = col * 32, y = row * 32  (sheet cell size is 32×32 px)
-- When set, the frontend renders from eq_sprites_t.png instead of icon_path.

alter table public.rpg_items
  add column if not exists sprite_positions jsonb;
