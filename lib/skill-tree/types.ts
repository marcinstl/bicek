import type { RpgRarity, SpritePosition } from '@/lib/types';

export type SkillBranch = 'exp' | 'inventory' | 'hunting' | 'common';

/** Rozmiar okręgu węzła na canvasie (edytor + eksport JSON). */
export type SkillNodeSize = 'sm' | 'md' | 'lg';

export const SKILL_NODE_SIZES: SkillNodeSize[] = ['sm', 'md', 'lg'];

export const SKILL_NODE_SIZE_LABEL: Record<SkillNodeSize, string> = {
  sm: 'Mały',
  md: 'Średni',
  lg: 'Duży',
};

/** px: okręg, sprite w środku, max szerokość etykiety tekstowej, klasy Tailwind dla tekstu. */
export function skillNodeLayout(size: SkillNodeSize | undefined) {
  switch (size ?? 'md') {
    case 'sm':
      return {
        circle: 40,
        sprite: 30,
        labelMax: 36,
        labelClass: 'text-[7px]',
        ranksClass: 'text-[8px]',
      };
    case 'lg':
      return {
        circle: 72,
        sprite: 58,
        labelMax: 66,
        labelClass: 'text-[10px]',
        ranksClass: 'text-[10px]',
      };
    default:
      return {
        circle: 56,
        sprite: 44,
        labelMax: 52,
        labelClass: 'text-[9px]',
        ranksClass: 'text-[9px]',
      };
  }
}

/** Koszt fragmentów wg rzadkości (jak w RPG — kryształ + kolor). */
export type SkillNodeFragmentCosts = Record<RpgRarity, number>;

export function emptySkillNodeFragmentCosts(): SkillNodeFragmentCosts {
  return { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
}

export type SkillNodeData = {
  label: string;
  /** Krótki opis / notatka dla designera */
  body: string;
  branch: SkillBranch;
  /** Jak na screenie referencyjnym (np. 5 poziomów w korzeniu). */
  maxRanks: number;
  /** Klatki z `eq_sprites_t.png` — ten sam format co w RPG (`SpriteIcon`). */
  spritePositions: SpritePosition[];
  /**
   * Opcjonalny tint ikony — `RARITY_CRYSTAL_TINT_HEX` / ta sama logika co modal wyprawy na `/rpg`.
   */
  spriteIconTintRarity?: RpgRarity;
  /** Domyślnie `md` jeśli brak (np. stary JSON). */
  nodeSize?: SkillNodeSize;
  /** Opcjonalnie w starym JSON; edytor drzewka nie ustawia Hunt Points. */
  costHuntPoints?: number;
  /** Fragmenty — kryształy jak na stronie `/rpg`. */
  costFragments?: SkillNodeFragmentCosts;
  /** Minimalny level postaci; `0` / brak = bez wymagania. */
  requiredLevel?: number;
};

export const SKILL_BRANCHES: SkillBranch[] = ['exp', 'inventory', 'hunting', 'common'];

export const BRANCH_LABEL: Record<SkillBranch, string> = {
  exp: 'Exp',
  inventory: 'Inventory',
  hunting: 'Hunting',
  common: 'Common',
};

/** Obramowanie okręgu węzła (Tailwind). */
export const BRANCH_NODE_RING: Record<SkillBranch, string> = {
  exp: 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.35)]',
  inventory: 'border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]',
  hunting: 'border-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.35)]',
  common: 'border-slate-400 shadow-[0_0_12px_rgba(148,163,184,0.4)]',
};

export const BRANCH_HEADER_BG: Record<SkillBranch, string> = {
  exp: 'bg-emerald-500/20 text-emerald-200',
  inventory: 'bg-amber-500/20 text-amber-200',
  hunting: 'bg-rose-500/20 text-rose-200',
  common: 'bg-slate-500/25 text-slate-200',
};
