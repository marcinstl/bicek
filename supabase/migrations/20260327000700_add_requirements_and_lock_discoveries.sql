alter table public.rpg_items
  add column if not exists requirements jsonb not null default '[]';

with ranked as (
  select id, row_number() over (order by created_at asc) as rn
  from public.rpg_items
)
update public.rpg_items as ri
set requirements = case
  when r.rn <= 10 then '[]'::jsonb
  when r.rn <= 25 then '[{"type":"total_level","level":2}]'::jsonb
  when r.rn <= 40 then '[{"type":"total_level","level":3}]'::jsonb
  when r.rn <= 55 then '[{"type":"kind_level","kind":"weighted_reps","level":3}]'::jsonb
  when r.rn <= 65 then '[{"type":"total_level","level":5},{"type":"workout_count","count":5}]'::jsonb
  else             '[{"type":"total_level","level":8,"secret":true}]'::jsonb
end
from ranked r
where ri.id = r.id;

drop policy if exists "Users can manage own rpg_item_discoveries" on public.rpg_item_discoveries;
create policy "Users can select own rpg_item_discoveries"
  on public.rpg_item_discoveries
  for select
  using (auth.uid() = user_id);
