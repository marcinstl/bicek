-- Add rarity enum and column to rpg_items.

create type public.rpg_rarity as enum ('common', 'uncommon', 'rare', 'epic', 'legendary');

alter table public.rpg_items
  add column if not exists rarity public.rpg_rarity not null default 'common';
