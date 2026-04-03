UPDATE public.rpg_items SET
  name = 'Vampire Sword',
  type = 'weapon-sword',
  eq_slot = 'slot-weapon',
  sprite_positions = '[{"col":0,"row":4},{"col":1,"row":4},{"col":2,"row":4},{"col":3,"row":4},{"col":4,"row":4},{"col":5,"row":4},{"col":6,"row":4},{"col":7,"row":4}]',
  buffs = '[{"type":"xp_rate","kind":"total","value":70},{"type":"xp_rate","kind":"weighted_reps","value":250}]'
WHERE code = 'vampire-sword';

DELETE FROM public.rpg_item_requirements
WHERE item_id = (SELECT id FROM public.rpg_items WHERE code = 'vampire-sword');

INSERT INTO public.rpg_item_requirements (item_id, type, level, kind, xp, count, secret)
SELECT id, 'kind_level', 1, 'weighted_reps', NULL, NULL, false
FROM public.rpg_items WHERE code = 'vampire-sword';