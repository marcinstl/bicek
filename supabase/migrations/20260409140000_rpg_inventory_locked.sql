-- Hunt overflow: stash excess loot as locked rows; unlock when bag has space.

ALTER TABLE public.rpg_inventory
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_hunt_id uuid REFERENCES public.rpg_hunts (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS rpg_inventory_pending_hunt_locked_idx
  ON public.rpg_inventory (pending_hunt_id)
  WHERE locked = true;

-- First collect vs retry (avoid double-roll on parallel requests).
ALTER TABLE public.rpg_hunts
  ADD COLUMN IF NOT EXISTS loot_rolled_at timestamptz;

COMMENT ON COLUMN public.rpg_inventory.locked IS 'When true, row is hidden from client; hunt overflow until bag space frees up.';
COMMENT ON COLUMN public.rpg_inventory.pending_hunt_id IS 'Hunt this locked row belongs to until unlocked or hunt deleted.';

-- Reject trading locked (stashed) rows.
CREATE OR REPLACE FUNCTION public.rpg_trade_inventory_row(p_row_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipped boolean;
  v_locked boolean;
  v_rarity text;
  dc int;
  du int;
  dr int;
  de int;
  dl int;
BEGIN
  SELECT i.equipped, COALESCE(i.locked, false), COALESCE(ri.rarity::text, 'common')
  INTO v_equipped, v_locked, v_rarity
  FROM public.rpg_inventory i
  INNER JOIN public.rpg_items ri ON ri.id = i.item_id
  WHERE i.id = p_row_id AND i.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_equipped THEN
    RETURN jsonb_build_object('error', 'equipped');
  END IF;

  IF v_locked THEN
    RETURN jsonb_build_object('error', 'locked');
  END IF;

  dc := 0;
  du := 0;
  dr := 0;
  de := 0;
  dl := 0;

  CASE v_rarity
    WHEN 'common' THEN dc := 1;
    WHEN 'uncommon' THEN du := 1; dc := 2;
    WHEN 'rare' THEN dr := 1; du := 2; dc := 3;
    WHEN 'epic' THEN de := 1; dr := 2; du := 3; dc := 4;
    WHEN 'legendary' THEN dl := 1; de := 2; dr := 3; du := 4; dc := 5;
    ELSE dc := 1;
  END CASE;

  DELETE FROM public.rpg_inventory WHERE id = p_row_id AND user_id = p_user_id;

  UPDATE public.rpg_profiles SET
    fragments_common = fragments_common + dc,
    fragments_uncommon = fragments_uncommon + du,
    fragments_rare = fragments_rare + dr,
    fragments_epic = fragments_epic + de,
    fragments_legendary = fragments_legendary + dl
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'item_rarity', v_rarity,
    'fragments_common', dc,
    'fragments_uncommon', du,
    'fragments_rare', dr,
    'fragments_epic', de,
    'fragments_legendary', dl
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpg_trade_inventory_row(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpg_trade_inventory_row(uuid, uuid) TO service_role;
