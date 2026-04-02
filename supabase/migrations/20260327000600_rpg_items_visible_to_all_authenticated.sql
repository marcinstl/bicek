drop policy if exists "Users can read discovered rpg_items" on public.rpg_items;

create policy "Authenticated users can read rpg_items basic fields"
  on public.rpg_items
  for select
  to authenticated
  using (true);
