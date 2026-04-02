-- Rename icon_path -> spritesheet_path and point all rows at the new sheet.
-- Items without sprite_positions are hidden from the UI automatically.

alter table public.rpg_items
  rename column icon_path to spritesheet_path;

update public.rpg_items
  set spritesheet_path = 'pixelart/eq_sprites_t.png';
