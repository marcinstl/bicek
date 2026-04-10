'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpritePosition, RpgRarity } from '@/lib/types';

// ─── Equipment slots ──────────────────────────────────────────────────────────
const EQUIPMENT_SLOTS = [
  { id: 'slot-coin',   row: 1, col: 1, label: 'Coin' },
  { id: 'slot-head',   row: 1, col: 2, label: 'Head' },
  { id: 'slot-potion', row: 1, col: 3, label: 'Potion' },
  { id: 'slot-weapon', row: 2, col: 1, label: 'Weapon' },
  { id: 'slot-armor',  row: 2, col: 2, label: 'Armor' },
  { id: 'slot-shield', row: 2, col: 3, label: 'Shield' },
  { id: 'slot-ring',   row: 3, col: 1, label: 'Ring' },
  { id: 'slot-legs',   row: 3, col: 2, label: 'Legs' },
  { id: 'slot-tool',   row: 3, col: 3, label: 'Tool' },
  { id: 'slot-boots',  row: 4, col: 2, label: 'Boots' },
] as const;

type EquipmentSlotId = (typeof EQUIPMENT_SLOTS)[number]['id'];

// ─── Sprite sheet constants ────────────────────────────────────────────────────
const SHEET_W = 512;
const SHEET_H = 1600;
const CELL = 32;
const COLS = SHEET_W / CELL;   // 16
const ROWS = SHEET_H / CELL;   // 50
const PREVIEW_SIZE = 56;
const PICKER_CELL = 44; // displayed cell size in the picker grid

// ─── Types ────────────────────────────────────────────────────────────────────
type ReqType = 'total_level' | 'kind_level' | 'total_xp' | 'workout_count';
type ExerciseKind = 'weighted_reps' | 'bodyweight_reps' | 'time_based' | 'distance_per_time';
type BuffKind = ExerciseKind | 'total';

interface Requirement {
  type: ReqType;
  level?: number;
  kind?: ExerciseKind;
  xp?: number;
  count?: number;
  secret: boolean;
}

interface DbRequirement {
  id: string;
  type: string;
  level: number | null;
  kind: string | null;
  xp: number | null;
  count: number | null;
  secret: boolean;
}

interface Buff {
  kind: BuffKind;
  value: number;
}

const RARITIES: RpgRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

interface DbItem {
  id: string;
  code: string;
  name: string;
  type: string;
  eq_slot: string;
  rarity: RpgRarity;
  spritesheet_path: string;
  sprite_positions: SpritePosition[] | null;
  buffs: Buff[] | null;
  created_at: string;
  rpg_item_requirements: DbRequirement[];
}

// ─── Rarity colours ───────────────────────────────────────────────────────────
const RARITY_STYLES: Record<RpgRarity, { dot: string; activeBg: string; activeBorder: string; activeText: string; idleBorder: string; idleText: string }> = {
  common:    { dot: 'bg-gray-400',   activeBg: 'bg-gray-500',   activeBorder: 'border-gray-500',   activeText: 'text-white', idleBorder: 'border-gray-300',   idleText: 'text-gray-500' },
  uncommon:  { dot: 'bg-green-500',  activeBg: 'bg-green-500',  activeBorder: 'border-green-500',  activeText: 'text-white', idleBorder: 'border-green-300',  idleText: 'text-green-700' },
  rare:      { dot: 'bg-blue-500',   activeBg: 'bg-blue-500',   activeBorder: 'border-blue-500',   activeText: 'text-white', idleBorder: 'border-blue-300',   idleText: 'text-blue-700' },
  epic:      { dot: 'bg-purple-500', activeBg: 'bg-purple-600', activeBorder: 'border-purple-600', activeText: 'text-white', idleBorder: 'border-purple-300', idleText: 'text-purple-700' },
  legendary: { dot: 'bg-yellow-500', activeBg: 'bg-yellow-500', activeBorder: 'border-yellow-500', activeText: 'text-gray-900', idleBorder: 'border-yellow-300', idleText: 'text-yellow-700' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function posKey(p: SpritePosition) {
  return `${p.col}:${p.row}`;
}

function sqlStr(v: string) {
  return `'${v.replace(/'/g, "''")}'`;
}

function nullOr(v: number | undefined) {
  return v !== undefined && v !== null ? String(v) : 'NULL';
}

function generateSql(
  isNew: boolean,
  code: string,
  name: string,
  type: string,
  eqSlot: string,
  rarity: RpgRarity,
  positions: SpritePosition[],
  requirements: Requirement[],
  buffs: Buff[],
): string {
  const posJson = JSON.stringify(positions);
  const buffsJson = JSON.stringify(
    buffs.map((b) => ({ type: 'xp_rate', kind: b.kind, value: b.value }))
  );
  const lines: string[] = [];

  if (isNew) {
    lines.push(
      `INSERT INTO public.rpg_items (code, name, type, eq_slot, rarity, spritesheet_path, sprite_positions, buffs)`,
      `VALUES (`,
      `  ${sqlStr(code)},`,
      `  ${sqlStr(name)},`,
      `  ${sqlStr(type)},`,
      `  ${sqlStr(eqSlot)},`,
      `  '${rarity}',`,
      `  'pixelart/eq_sprites_t.png',`,
      `  '${posJson}',`,
      `  '${buffsJson}'`,
      `);`,
    );
  } else {
    lines.push(
      `UPDATE public.rpg_items SET`,
      `  name = ${sqlStr(name)},`,
      `  type = ${sqlStr(type)},`,
      `  eq_slot = ${sqlStr(eqSlot)},`,
      `  rarity = '${rarity}',`,
      `  sprite_positions = '${posJson}',`,
      `  buffs = '${buffsJson}'`,
      `WHERE code = ${sqlStr(code)};`,
    );
  }

  if (requirements.length > 0) {
    lines.push('');
    lines.push(
      `DELETE FROM public.rpg_item_requirements`,
      `WHERE item_id = (SELECT id FROM public.rpg_items WHERE code = ${sqlStr(code)});`,
    );
    lines.push('');
    for (const req of requirements) {
      const level = req.type === 'total_level' || req.type === 'kind_level' ? nullOr(req.level) : 'NULL';
      const kind = req.type === 'kind_level' && req.kind ? sqlStr(req.kind) : 'NULL';
      const xp = req.type === 'total_xp' ? nullOr(req.xp) : 'NULL';
      const count = req.type === 'workout_count' ? nullOr(req.count) : 'NULL';
      lines.push(
        `INSERT INTO public.rpg_item_requirements (item_id, type, level, kind, xp, count, secret)`,
        `SELECT id, ${sqlStr(req.type)}, ${level}, ${kind}, ${xp}, ${count}, ${req.secret}`,
        `FROM public.rpg_items WHERE code = ${sqlStr(code)};`,
      );
    }
  } else if (!isNew) {
    lines.push('');
    lines.push(
      `DELETE FROM public.rpg_item_requirements`,
      `WHERE item_id = (SELECT id FROM public.rpg_items WHERE code = ${sqlStr(code)});`,
    );
  }

  return lines.join('\n');
}

function generateAllItemsSql(items: DbItem[]): string {
  const blocks: string[] = [
    `-- Export wszystkich itemów (${items.length}) — ${new Date().toISOString().slice(0, 10)}`,
    `-- INSERT ... ON CONFLICT (code) DO UPDATE — nie nadpisuje id`,
    '',
  ];

  for (const item of items) {
    const posJson = JSON.stringify(item.sprite_positions ?? []);
    const buffsJson = JSON.stringify(
      (item.buffs ?? []).map((b) => ({ type: 'xp_rate', kind: b.kind, value: b.value }))
    );

    blocks.push(
      `-- ${item.code}`,
      `INSERT INTO public.rpg_items (code, name, type, eq_slot, rarity, spritesheet_path, sprite_positions, buffs)`,
      `VALUES (`,
      `  ${sqlStr(item.code)},`,
      `  ${sqlStr(item.name)},`,
      `  ${sqlStr(item.type)},`,
      `  ${sqlStr(item.eq_slot)},`,
      `  '${item.rarity ?? 'common'}',`,
      `  'pixelart/eq_sprites_t.png',`,
      `  '${posJson}',`,
      `  '${buffsJson}'`,
      `)`,
      `ON CONFLICT (code) DO UPDATE SET`,
      `  name = EXCLUDED.name,`,
      `  type = EXCLUDED.type,`,
      `  eq_slot = EXCLUDED.eq_slot,`,
      `  rarity = EXCLUDED.rarity,`,
      `  sprite_positions = EXCLUDED.sprite_positions,`,
      `  buffs = EXCLUDED.buffs;`,
    );

    // Always replace requirements (delete + re-insert)
    blocks.push(
      ``,
      `DELETE FROM public.rpg_item_requirements`,
      `WHERE item_id = (SELECT id FROM public.rpg_items WHERE code = ${sqlStr(item.code)});`,
    );

    for (const req of item.rpg_item_requirements) {
      const level = req.type === 'total_level' || req.type === 'kind_level' ? nullOr(req.level ?? undefined) : 'NULL';
      const kind = req.type === 'kind_level' && req.kind ? sqlStr(req.kind) : 'NULL';
      const xp = req.type === 'total_xp' ? nullOr(req.xp ?? undefined) : 'NULL';
      const count = req.type === 'workout_count' ? nullOr(req.count ?? undefined) : 'NULL';
      blocks.push(
        `INSERT INTO public.rpg_item_requirements (item_id, type, level, kind, xp, count, secret)`,
        `SELECT id, ${sqlStr(req.type)}, ${level}, ${kind}, ${xp}, ${count}, ${req.secret}`,
        `FROM public.rpg_items WHERE code = ${sqlStr(item.code)};`,
      );
    }

    blocks.push('');
  }

  return blocks.join('\n');
}

function dbReqToForm(r: DbRequirement): Requirement {
  return {
    type: r.type as ReqType,
    level: r.level ?? undefined,
    kind: r.kind as ExerciseKind | undefined,
    xp: r.xp ?? undefined,
    count: r.count ?? undefined,
    secret: r.secret,
  };
}

// ─── Buff row ─────────────────────────────────────────────────────────────────
const BUFF_KINDS: BuffKind[] = ['total', 'weighted_reps', 'bodyweight_reps', 'time_based', 'distance_per_time'];

function BuffRow({
  buff,
  onChange,
  onRemove,
}: {
  buff: Buff;
  onChange: (b: Buff) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
      <select
        value={buff.kind}
        onChange={(e) => onChange({ ...buff, kind: e.target.value as BuffKind })}
        className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
      >
        {BUFF_KINDS.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>
      <span className="text-xs text-gray-500">+</span>
      <input
        type="number"
        value={buff.value}
        onChange={(e) => onChange({ ...buff, value: Number(e.target.value) })}
        className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs"
        title="Punkty procentowe dodane do xp_rate (np. 50 = +50%)"
      />
      <span className="text-xs text-gray-400">%</span>
      <button type="button" onClick={onRemove} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
    </div>
  );
}

// ─── Sprite preview component ─────────────────────────────────────────────────
function SpritePreview({ positions, size = PREVIEW_SIZE }: { positions: SpritePosition[]; size?: number }) {
  const [frameIdx, setFrameIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (positions.length <= 1) { setFrameIdx(0); return; }
    timerRef.current = setInterval(() => setFrameIdx((i) => (i + 1) % positions.length), 300);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [positions.length]);

  if (positions.length === 0) {
    return <div className="border border-dashed border-gray-300 bg-gray-50" style={{ width: size, height: size }} />;
  }

  const pos = positions[Math.min(frameIdx, positions.length - 1)];
  const scale = size / CELL;
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundImage: `url(/pixelart/eq_sprites_t.png)`,
        backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
        backgroundPosition: `${-(pos.col * CELL * scale)}px ${-(pos.row * CELL * scale)}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  );
}

// ─── Requirement row ──────────────────────────────────────────────────────────
function RequirementRow({
  req,
  onChange,
  onRemove,
}: {
  req: Requirement;
  onChange: (r: Requirement) => void;
  onRemove: () => void;
}) {
  const kinds: ExerciseKind[] = ['weighted_reps', 'bodyweight_reps', 'time_based', 'distance_per_time'];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
      <select
        value={req.type}
        onChange={(e) => onChange({ ...req, type: e.target.value as ReqType })}
        className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
      >
        <option value="total_level">total_level</option>
        <option value="kind_level">kind_level</option>
        <option value="total_xp">total_xp</option>
        <option value="workout_count">workout_count</option>
      </select>

      {(req.type === 'total_level' || req.type === 'kind_level') && (
        <input
          type="number"
          placeholder="level"
          value={req.level ?? ''}
          onChange={(e) => onChange({ ...req, level: e.target.value ? Number(e.target.value) : undefined })}
          className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs"
        />
      )}
      {req.type === 'kind_level' && (
        <select
          value={req.kind ?? ''}
          onChange={(e) => onChange({ ...req, kind: e.target.value as ExerciseKind })}
          className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
        >
          <option value="">-- kind --</option>
          {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      )}
      {req.type === 'total_xp' && (
        <input
          type="number"
          placeholder="xp"
          value={req.xp ?? ''}
          onChange={(e) => onChange({ ...req, xp: e.target.value ? Number(e.target.value) : undefined })}
          className="w-20 rounded border border-gray-300 px-1.5 py-1 text-xs"
        />
      )}
      {req.type === 'workout_count' && (
        <input
          type="number"
          placeholder="count"
          value={req.count ?? ''}
          onChange={(e) => onChange({ ...req, count: e.target.value ? Number(e.target.value) : undefined })}
          className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs"
        />
      )}

      <label className="flex items-center gap-1 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={req.secret}
          onChange={(e) => onChange({ ...req, secret: e.target.checked })}
        />
        secret
      </label>
      <button type="button" onClick={onRemove} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminItemsPage() {
  const [items, setItems] = useState<DbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<DbItem | null>(null); // null = new item

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('weapon-sword');
  const [eqSlot, setEqSlot] = useState<EquipmentSlotId>('slot-weapon');
  const [rarity, setRarity] = useState<RpgRarity>('common');
  const [positions, setPositions] = useState<SpritePosition[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [buffs, setBuffs] = useState<Buff[]>([]);
  const [sql, setSql] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportSql, setExportSql] = useState('');
  const [exportCopied, setExportCopied] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rpg-items');
      const data = (await res.json()) as DbItem[];
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const loadItem = (item: DbItem) => {
    setSelectedItem(item);
    setCode(item.code);
    setName(item.name);
    setType(item.type);
    setEqSlot(item.eq_slot as EquipmentSlotId);
    setRarity(item.rarity ?? 'common');
    setPositions(item.sprite_positions ?? []);
    setRequirements(item.rpg_item_requirements.map(dbReqToForm));
    setBuffs((item.buffs ?? []).map((b) => ({ kind: b.kind as BuffKind, value: b.value })));
    setSql('');
  };

  const resetForm = () => {
    setSelectedItem(null);
    setCode('');
    setName('');
    setType('weapon-sword');
    setEqSlot('slot-weapon');
    setRarity('common');
    setPositions([]);
    setRequirements([]);
    setBuffs([]);
    setSql('');
  };

  // Sprite picker: selected cells with order
  const selectedMap = new Map(positions.map((p, i) => [posKey(p), i + 1]));

  const handleCellClick = (col: number, row: number) => {
    const key = posKey({ col, row });
    if (selectedMap.has(key)) {
      setPositions((prev) => prev.filter((p) => posKey(p) !== key));
    } else {
      setPositions((prev) => [...prev, { col, row }]);
    }
  };

  const handleGenerate = () => {
    setSql(generateSql(
      selectedItem === null,
      code, name, type, eqSlot, rarity, positions, requirements, buffs,
    ));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const addRequirement = () => {
    setRequirements((prev) => [...prev, { type: 'total_level', level: 1, secret: false }]);
  };

  const updateRequirement = (i: number, r: Requirement) => {
    setRequirements((prev) => prev.map((x, idx) => idx === i ? r : x));
  };

  const removeRequirement = (i: number) => {
    setRequirements((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addBuff = () => {
    setBuffs((prev) => [...prev, { kind: 'total', value: 50 }]);
  };

  const updateBuff = (i: number, b: Buff) => {
    setBuffs((prev) => prev.map((x, idx) => idx === i ? b : x));
  };

  const removeBuff = (i: number) => {
    setBuffs((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans text-sm text-gray-900">
      {/* ── Left sidebar: item list ── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-3 py-1.5">
          <Link href="/admin" className="text-[11px] font-medium text-blue-600 hover:underline">
            ← Admin
          </Link>
        </div>
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
          <span className="font-semibold text-xs uppercase tracking-wide text-gray-500">RPG Items</span>
          <button
            type="button"
            onClick={() => void fetchItems()}
            className="text-xs text-blue-600 hover:underline"
          >
            ↺
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-3 py-4 text-xs text-gray-400">Ładowanie…</p>
          ) : (
            <ul>
              {[...items].sort((a, b) => RARITIES.indexOf(a.rarity ?? 'common') - RARITIES.indexOf(b.rarity ?? 'common')).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => loadItem(item)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors ${selectedItem?.id === item.id ? 'bg-blue-50 font-semibold text-blue-700' : ''}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${RARITY_STYLES[item.rarity ?? 'common'].dot}`} />
                    {item.sprite_positions?.length ? (
                      <SpritePreview positions={item.sprite_positions} size={24} />
                    ) : (
                      <div className="h-6 w-6 rounded bg-gray-200" />
                    )}
                    <span className="min-w-0 truncate">{item.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-gray-200 p-2">
          <button
            type="button"
            onClick={resetForm}
            className="w-full rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            + Nowy item
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center gap-3">
          <h1 className="text-base font-bold">
            {selectedItem ? `Edycja: ${selectedItem.code}` : 'Nowy item'}
          </h1>
          <span className="text-xs text-gray-400">admin — tylko lokalnie</span>
          <button
            type="button"
            className="ml-auto rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            disabled={items.length === 0}
            onClick={() => setExportSql(generateAllItemsSql(items))}
          >
            Eksport wszystkich ({items.length})
          </button>
        </div>

        <div className="flex flex-1 gap-0">
          {/* ── Form ── */}
          <div className="flex w-80 shrink-0 flex-col gap-4 border-r border-gray-200 bg-white p-5 overflow-y-auto">

            {/* Basic fields */}
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Podstawowe</h2>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'code', value: code, set: setCode, disabled: selectedItem !== null },
                  { label: 'name', value: name, set: setName, disabled: false },
                ].map(({ label, value, set, disabled }) => (
                  <label key={label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-500">{label}</span>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      disabled={disabled}
                      className="rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </label>
                ))}

                {/* Type — combobox with existing types from DB */}
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500">type</span>
                  <input
                    type="text"
                    list="admin-type-list"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="np. weapon-sword"
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                  <datalist id="admin-type-list">
                    {Array.from(new Set(items.map((i) => i.type)))
                      .sort()
                      .map((t) => (
                        <option key={t} value={t} />
                      ))}
                  </datalist>
                </label>

                {/* Rarity picker */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500">rarity</span>
                  <div className="flex flex-wrap gap-1">
                    {RARITIES.map((r) => {
                      const s = RARITY_STYLES[r];
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRarity(r)}
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold border transition-colors ${
                            rarity === r
                              ? `${s.activeBg} ${s.activeBorder} ${s.activeText}`
                              : `bg-white ${s.idleBorder} ${s.idleText} hover:opacity-80`
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slot picker */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500">eq_slot</span>
                  <div
                    className="grid w-fit gap-1"
                    style={{ gridTemplateColumns: 'repeat(3, 2.5rem)', gridTemplateRows: 'repeat(4, 2.5rem)' }}
                  >
                    {EQUIPMENT_SLOTS.map((slot) => {
                      const active = eqSlot === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          title={slot.id}
                          onClick={() => setEqSlot(slot.id)}
                          style={{ gridColumnStart: slot.col, gridRowStart: slot.row }}
                          className={`flex flex-col items-center justify-center rounded border text-[8px] leading-tight transition-colors ${
                            active
                              ? 'border-blue-500 bg-blue-500 text-white'
                              : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="mt-0.5 text-[10px] text-gray-400">{eqSlot}</span>
                </div>
              </div>
            </section>

            {/* Requirements */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Wymagania</h2>
                <button
                  type="button"
                  onClick={addRequirement}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Dodaj
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {requirements.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Brak wymagań</p>
                )}
                {requirements.map((req, i) => (
                  <RequirementRow
                    key={i}
                    req={req}
                    onChange={(r) => updateRequirement(i, r)}
                    onRemove={() => removeRequirement(i)}
                  />
                ))}
              </div>
            </section>

            {/* Buffs */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Buffy</h2>
                <button
                  type="button"
                  onClick={addBuff}
                  className="text-xs text-amber-600 hover:underline"
                >
                  + Dodaj
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {buffs.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Brak buffów</p>
                )}
                {buffs.map((buff, i) => (
                  <BuffRow
                    key={i}
                    buff={buff}
                    onChange={(b) => updateBuff(i, b)}
                    onRemove={() => removeBuff(i)}
                  />
                ))}
              </div>
              {buffs.length > 0 && (
                <p className="mt-1 text-[10px] text-gray-400">
                  xp_rate = 100 + Σ buffy → XP × xp_rate / 100
                </p>
              )}
            </section>

            {/* Generate */}
            <section>
              <button
                type="button"
                onClick={handleGenerate}
                className="w-full rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={!code.trim() || !name.trim()}
              >
                Generuj SQL
              </button>
            </section>

            {/* SQL output */}
            {sql && (
              <section className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">SQL</h2>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {copied ? '✓ Skopiowano' : 'Kopiuj'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={sql}
                  rows={12}
                  className="w-full rounded border border-gray-300 bg-gray-50 p-2 font-mono text-[10px] leading-relaxed resize-y"
                />
              </section>
            )}
          </div>

          {/* ── Sprite picker ── */}
          <div className="flex-1 overflow-auto p-5">
            <div className="mb-3 flex items-center gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sprite picker</h2>
              <div className="flex items-center gap-2">
                <SpritePreview positions={positions} size={PREVIEW_SIZE} />
                <div>
                  <p className="text-xs text-gray-500">
                    {positions.length === 0
                      ? 'Nie wybrano klatek'
                      : `${positions.length} klatk${positions.length === 1 ? 'a' : positions.length < 5 ? 'i' : ''}`}
                  </p>
                  {positions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPositions([])}
                      className="text-[10px] text-red-400 hover:text-red-600"
                    >
                      Wyczyść
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Grid */}
            <div
              className="inline-grid border border-gray-300"
              style={{
                gridTemplateColumns: `repeat(${COLS}, ${PICKER_CELL}px)`,
                gap: 1,
                backgroundColor: '#d1d5db',
              }}
            >
              {Array.from({ length: ROWS }, (_, row) =>
                Array.from({ length: COLS }, (_, col) => {
                  const key = posKey({ col, row });
                  const order = selectedMap.get(key);
                  const isSelected = order !== undefined;
                  const scale = PICKER_CELL / CELL;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleCellClick(col, row)}
                      title={`col=${col} row=${row}`}
                      className="relative overflow-hidden hover:opacity-80"
                      style={{
                        width: PICKER_CELL,
                        height: PICKER_CELL,
                        backgroundImage: `url(/pixelart/eq_sprites_t.png)`,
                        backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
                        backgroundPosition: `${-(col * CELL * scale)}px ${-(row * CELL * scale)}px`,
                        backgroundRepeat: 'no-repeat',
                        imageRendering: 'pixelated',
                        outline: isSelected ? '2px solid #16a34a' : '1px solid transparent',
                        outlineOffset: '-2px',
                      }}
                    >
                      {isSelected && (
                        <span
                          className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-tl bg-emerald-600 text-[8px] font-bold text-white leading-none"
                        >
                          {order}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <p className="mt-2 text-[10px] text-gray-400">
              Kliknij sprite żeby dodać do animacji. Kolejność klatek: {positions.map((p) => `(${p.col},${p.row})`).join(' → ') || '—'}
            </p>
          </div>
        </div>
      </main>

      {/* ── Export modal ── */}
      {exportSql && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="flex w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <div>
                <h2 className="text-sm font-bold">Eksport wszystkich itemów</h2>
                <p className="text-[11px] text-gray-400">
                  INSERT … ON CONFLICT (code) DO UPDATE — istniejące id nie są nadpisywane
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(exportSql);
                    setExportCopied(true);
                    setTimeout(() => setExportCopied(false), 1500);
                  }}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  {exportCopied ? '✓ Skopiowano' : 'Kopiuj'}
                </button>
                <button
                  type="button"
                  onClick={() => setExportSql('')}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Zamknij
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={exportSql}
              className="flex-1 overflow-auto rounded-b-xl bg-gray-50 p-4 font-mono text-[11px] leading-relaxed resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
