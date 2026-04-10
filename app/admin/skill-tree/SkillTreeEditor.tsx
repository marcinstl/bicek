'use client';

import '@xyflow/react/dist/style.css';

import {
  addEdge,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  type Connection,
  type Edge,
  MiniMap,
  type Node,
  type NodeChange,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BRANCH_HEADER_BG,
  BRANCH_LABEL,
  emptySkillNodeFragmentCosts,
  type SkillBranch,
  SKILL_BRANCHES,
  type SkillNodeData,
  SKILL_NODE_SIZE_LABEL,
  SKILL_NODE_SIZES,
  type SkillNodeSize,
} from '@/lib/skill-tree/types';
import { RARITY_LABELS } from '@/lib/rpg/hunts';
import {
  RARITY_CRYSTAL_TINT_HEX,
  RARITY_ICON_FRAME_STYLES,
  RARITY_SPRITE_TINT_OPACITY,
  RPG_RARITY_ORDER,
} from '@/lib/rpg/rpg-currency-ui';
import { SpriteIcon } from '@/components/SpriteIcon';
import {
  loadSkillTreeEditorGraph,
  saveSkillTreeEditorGraph,
} from '@/lib/skill-tree/editor-local-storage';
import {
  shiftTopLeftToPreserveCircleCenter,
  SKILL_TREE_EDITOR_SNAP_GRID,
  snapSkillNodeTopLeftToGrid,
} from '@/lib/skill-tree/skill-tree-snap';
import {
  SkillTreeCanvasModeProvider,
  type SkillTreeCanvasMode,
} from './SkillTreeCanvasModeContext';
import { EqSpritePickerModal } from './EqSpritePickerModal';
import { SkillTreeNode } from './SkillNode';

const nodeTypes = { skill: SkillTreeNode };

const defaultEdgeOptions = {
  style: { stroke: '#64748b', strokeWidth: 1.5 },
  selectable: true,
  deletable: true,
  focusable: true,
  interactionWidth: 24,
};

function defaultData(branch: SkillBranch): SkillNodeData {
  return {
    label: BRANCH_LABEL[branch],
    body: '',
    branch,
    maxRanks: 5,
    spritePositions: [],
    nodeSize: 'md',
    costFragments: emptySkillNodeFragmentCosts(),
    requiredLevel: 0,
  };
}

const initialNodesRaw: Node[] = [
  {
    id: 'root-exp',
    type: 'skill',
    position: { x: 40, y: 280 },
    data: defaultData('exp'),
  },
  {
    id: 'root-inventory',
    type: 'skill',
    position: { x: 40, y: 440 },
    data: { ...defaultData('inventory'), label: 'Inventory' },
  },
  {
    id: 'root-hunting',
    type: 'skill',
    position: { x: 40, y: 600 },
    data: { ...defaultData('hunting'), label: 'Hunting' },
  },
  {
    id: 'exp-a',
    type: 'skill',
    position: { x: 300, y: 280 },
    data: {
      label: 'Bonus XP',
      body: '',
      branch: 'exp',
      maxRanks: 3,
      spritePositions: [],
      nodeSize: 'md',
      costFragments: emptySkillNodeFragmentCosts(),
    },
  },
  {
    id: 'inv-a',
    type: 'skill',
    position: { x: 300, y: 440 },
    data: {
      label: 'Bag size',
      body: '',
      branch: 'inventory',
      maxRanks: 1,
      spritePositions: [],
      nodeSize: 'md',
      costFragments: emptySkillNodeFragmentCosts(),
    },
  },
  {
    id: 'hunt-a',
    type: 'skill',
    position: { x: 300, y: 600 },
    data: {
      label: 'Loot luck',
      body: '',
      branch: 'hunting',
      maxRanks: 5,
      spritePositions: [],
      nodeSize: 'md',
      costFragments: emptySkillNodeFragmentCosts(),
    },
  },
];

const initialNodes: Node[] = initialNodesRaw.map((n) => ({
  ...n,
  position: snapSkillNodeTopLeftToGrid(n.position, n.data as SkillNodeData, SKILL_TREE_EDITOR_SNAP_GRID),
}));

const initialEdges: Edge[] = [
  { id: 'e-exp', source: 'root-exp', target: 'exp-a', ...defaultEdgeOptions },
  { id: 'e-inv', source: 'root-inventory', target: 'inv-a', ...defaultEdgeOptions },
  { id: 'e-hunt', source: 'root-hunting', target: 'hunt-a', ...defaultEdgeOptions },
];

function SkillTreeEditorInner() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setNodes((nds) => {
      const adjusted = changes.map((ch) => {
        if (ch.type !== 'position' || ch.position == null) return ch;
        const n = nds.find((x) => x.id === ch.id);
        if (!n) return ch;
        const snapped = snapSkillNodeTopLeftToGrid(
          ch.position,
          n.data as SkillNodeData,
          SKILL_TREE_EDITOR_SNAP_GRID,
        );
        return { ...ch, position: snapped };
      });
      return applyNodeChanges(adjusted, nds);
    });
  }, []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [storageReady, setStorageReady] = useState(false);
  const { screenToFlowPosition, deleteElements } = useReactFlow();
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [spritePickerOpen, setSpritePickerOpen] = useState(false);

  useEffect(() => {
    const { nodes: n, edges: e } = loadSkillTreeEditorGraph(
      initialNodes,
      initialEdges,
      defaultEdgeOptions,
    );
    setNodes(
      n.map((node) => ({
        ...node,
        position: snapSkillNodeTopLeftToGrid(
          node.position,
          node.data as SkillNodeData,
          SKILL_TREE_EDITOR_SNAP_GRID,
        ),
      })),
    );
    setEdges(e);
    setStorageReady(true);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!storageReady) return;
    saveSkillTreeEditorGraph(nodes, edges);
  }, [nodes, edges, storageReady]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => {
        if (eds.some((e) => e.source === params.source && e.target === params.target)) return eds;
        const id = `edge-${params.source}-${params.target}`;
        if (eds.some((e) => e.id === id)) return eds;
        return addEdge({ ...params, id, ...defaultEdgeOptions }, eds);
      }),
    [setEdges],
  );

  const deleteSelectedNodes = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) return;
    await deleteElements({ nodes: selectedNodes.map((n) => ({ id: n.id })) });
  }, [nodes, deleteElements]);

  const deleteSelectedEdges = useCallback(async () => {
    const selectedEdges = edges.filter((e) => e.selected);
    if (selectedEdges.length === 0) return;
    await deleteElements({ edges: selectedEdges.map((e) => ({ id: e.id })) });
  }, [edges, deleteElements]);

  const selected = useMemo(() => nodes.find((n) => n.selected), [nodes]);
  const selectedNodeCount = useMemo(() => nodes.filter((n) => n.selected).length, [nodes]);
  const selectedEdgeCount = useMemo(() => edges.filter((e) => e.selected).length, [edges]);

  const updateSelectedData = useCallback(
    (patch: Partial<SkillNodeData>) => {
      if (!selected) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selected.id) return n;
          const prevData = n.data as SkillNodeData;
          const nextData = { ...prevData, ...patch } as SkillNodeData;
          let position = n.position;
          if (patch.nodeSize !== undefined) {
            position = shiftTopLeftToPreserveCircleCenter(
              n.position,
              prevData.nodeSize,
              patch.nodeSize,
            );
          }
          return { ...n, data: nextData, position };
        }),
      );
    },
    [selected, setNodes],
  );

  const addNode = useCallback(() => {
    const id = `node-${crypto.randomUUID().slice(0, 8)}`;
    const raw = screenToFlowPosition({
      x: typeof window !== 'undefined' ? window.innerWidth / 2 : 400,
      y: typeof window !== 'undefined' ? window.innerHeight / 2 : 300,
    });
    const data: SkillNodeData = {
      label: 'Nowy węzeł',
      body: '',
      branch: 'exp',
      maxRanks: 1,
      spritePositions: [],
      nodeSize: 'md',
      costFragments: emptySkillNodeFragmentCosts(),
      requiredLevel: 0,
    };
    const pos = snapSkillNodeTopLeftToGrid(raw, data, SKILL_TREE_EDITOR_SNAP_GRID);
    setNodes((nds) => [...nds, { id, type: 'skill', position: pos, data }]);
  }, [screenToFlowPosition, setNodes]);

  const exportJson = useCallback(() => {
    const graph = {
      nodes: nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: n.data as SkillNodeData,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
    void navigator.clipboard.writeText(JSON.stringify(graph, null, 2)).then(() => {
      setExportMsg('Skopiowano JSON do schowka');
      setTimeout(() => setExportMsg(null), 2000);
    });
  }, [nodes, edges]);

  const selectedData = selected ? (selected.data as SkillNodeData) : null;

  return (
    <>
      <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.25}
      maxZoom={1.5}
      nodesConnectable
      connectionRadius={32}
      connectOnClick
      isValidConnection={(c) => c.source !== c.target}
      proOptions={{ hideAttribution: true }}
      className="!bg-slate-950"
      deleteKeyCode={['Backspace', 'Delete']}
    >
      <Background color="#334155" variant={BackgroundVariant.Dots} gap={20} size={1} />
      <Controls className="!bg-slate-800 !border-slate-600 [&_button]:!fill-slate-200" />
      <MiniMap
        className="!bg-slate-900 !border-slate-600"
        nodeColor={(n) => {
          const b = (n.data as SkillNodeData)?.branch;
          if (b === 'exp') return '#34d399';
          if (b === 'inventory') return '#fbbf24';
          if (b === 'hunting') return '#fb7185';
          if (b === 'common') return '#94a3b8';
          return '#64748b';
        }}
        maskColor="rgb(15 23 42 / 0.7)"
      />

      <Panel position="top-left" className="m-2 max-w-sm rounded-xl border border-slate-600 bg-slate-900/95 p-3 text-slate-200 shadow-lg backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Edytor</p>
        <p className="mt-1 text-[10px] text-slate-500">
          Stan grafu zapisuje się automatycznie w <span className="text-slate-400">localStorage</span> tej
          przeglądarki po każdej zmianie.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          <strong className="text-slate-400">Połączenia:</strong> drzewko w prawo — jedno wejście po lewej, jedno wyjście po
          prawej. W edycji widać kropki; w trybie readonly znikają. Przeciągnij lub klik–klik.{' '}
          <strong className="text-slate-400">Usuwanie:</strong> zaznacz węzeł lub krawędź na płótnie (klik w
          tło, jeśli pisałeś w polu), potem Backspace/Delete albo przyciski poniżej. Siatka 20×20 px — snap do
          środka okręgu (różne rozmiary węzłów wyrównują się na tej samej linii).{' '}
          <strong className="text-slate-400">Bez zapisu do bazy</strong> — eksport JSON.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addNode}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600"
          >
            + Węzeł
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Kopiuj JSON
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void deleteSelectedNodes()}
            disabled={selectedNodeCount === 0}
            className="rounded-lg border border-red-900/80 bg-red-950/80 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Usuń węzły ({selectedNodeCount})
          </button>
          <button
            type="button"
            onClick={() => void deleteSelectedEdges()}
            disabled={selectedEdgeCount === 0}
            className="rounded-lg border border-orange-900/80 bg-orange-950/60 px-3 py-1.5 text-xs font-semibold text-orange-200 hover:bg-orange-900/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Usuń krawędzie ({selectedEdgeCount})
          </button>
        </div>
        {exportMsg ? <p className="mt-2 text-xs text-emerald-400">{exportMsg}</p> : null}
      </Panel>

      <Panel position="top-right" className="m-2 w-72 rounded-xl border border-slate-600 bg-slate-900/95 p-3 text-slate-200 shadow-lg backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Właściwości węzła</p>
        {selected ? (
          <div className="mt-2 flex flex-col gap-2">
            <div
              className={`rounded-md px-2 py-1 text-[10px] font-bold ${BRANCH_HEADER_BG[(selected.data as SkillNodeData).branch]}`}
            >
              {BRANCH_LABEL[(selected.data as SkillNodeData).branch]}
            </div>
            <label className="block text-[10px] text-slate-500">Tytuł</label>
            <input
              value={(selected.data as SkillNodeData).label}
              onChange={(e) => updateSelectedData({ label: e.target.value })}
              className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
            />
            <label className="block text-[10px] text-slate-500">Opis / notatka</label>
            <textarea
              value={(selected.data as SkillNodeData).body}
              onChange={(e) => updateSelectedData({ body: e.target.value })}
              rows={3}
              className="w-full resize-none rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
            />
            <label className="block text-[10px] text-slate-500">Gałąź</label>
            <select
              value={(selected.data as SkillNodeData).branch}
              onChange={(e) => updateSelectedData({ branch: e.target.value as SkillBranch })}
              className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
            >
              {SKILL_BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {BRANCH_LABEL[b]}
                </option>
              ))}
            </select>
            <label className="block text-[10px] text-slate-500">Max rang (wyświetlane 0/max)</label>
            <input
              type="number"
              min={1}
              max={99}
              value={(selected.data as SkillNodeData).maxRanks}
              onChange={(e) => updateSelectedData({ maxRanks: Math.max(1, Number(e.target.value) || 1) })}
              className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
            />
            <label className="block text-[10px] text-slate-500">Rozmiar węzła</label>
            <select
              value={(selected.data as SkillNodeData).nodeSize ?? 'md'}
              onChange={(e) => updateSelectedData({ nodeSize: e.target.value as SkillNodeSize })}
              className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
            >
              {SKILL_NODE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {SKILL_NODE_SIZE_LABEL[s]}
                </option>
              ))}
            </select>
            <div className="border-t border-slate-700 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Wymagania</p>
              <p className="mt-0.5 text-[9px] text-slate-600">
                Level i fragmenty — 0 = brak wymagania / brak kosztu w danej rzadkości. Tylko w panelu; na canvasie widać
                sam węzeł.
              </p>
              <label className="mt-2 block text-[10px] text-slate-500">Level</label>
              <input
                type="number"
                min={0}
                max={999}
                value={(selected.data as SkillNodeData).requiredLevel ?? 0}
                onChange={(e) =>
                  updateSelectedData({
                    requiredLevel: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  })
                }
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
              />
              <p className="mt-2 text-[10px] text-slate-500">Fragmenty</p>
              <div className="mt-1 grid grid-cols-1 gap-1.5">
                {RPG_RARITY_ORDER.map((tier) => {
                  const d = selected.data as SkillNodeData;
                  const frag = { ...emptySkillNodeFragmentCosts(), ...d.costFragments };
                  return (
                    <label key={tier} className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="w-24 shrink-0 truncate">{RARITY_LABELS[tier]}</span>
                      <input
                        type="number"
                        min={0}
                        value={frag[tier]}
                        onChange={(e) =>
                          updateSelectedData({
                            costFragments: {
                              ...frag,
                              [tier]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                            },
                          })
                        }
                        className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void deleteElements({ nodes: [{ id: selected.id }] })}
              className="w-full rounded-lg border border-red-900/70 bg-red-950/50 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/40"
            >
              Usuń ten węzeł
            </button>
            <div className="border-t border-slate-700 pt-2">
              <label className="block text-[10px] text-slate-500">Ikona (SpriteIcon / eq_sprites_t)</label>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-950">
                  {selectedData!.spritePositions?.length ? (
                    <SpriteIcon
                      positions={selectedData!.spritePositions}
                      size={48}
                      tintColor={
                        selectedData!.spriteIconTintRarity != null
                          ? RARITY_CRYSTAL_TINT_HEX[selectedData!.spriteIconTintRarity]
                          : undefined
                      }
                      tintOpacity={RARITY_SPRITE_TINT_OPACITY}
                    />
                  ) : (
                    <span className="text-[10px] text-slate-600">brak</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setSpritePickerOpen(true)}
                    className="rounded-lg bg-slate-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-600"
                  >
                    Wybierz z arkusza…
                  </button>
                  {selectedData!.spritePositions?.length ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedData({ spritePositions: [], spriteIconTintRarity: undefined })
                      }
                      className="text-left text-[10px] text-red-400 hover:text-red-300"
                    >
                      Usuń ikonę
                    </button>
                  ) : null}
                </div>
              </div>
              <label className="mt-2 block text-[10px] text-slate-500">
                Odcień — te same kolory co rarity w modalu wyprawy (/rpg)
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateSelectedData({ spriteIconTintRarity: undefined })}
                  className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
                    selectedData!.spriteIconTintRarity == null
                      ? 'border-amber-400 bg-amber-950/50 text-amber-200'
                      : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Brak
                </button>
                {RPG_RARITY_ORDER.map((r) => {
                  const frame = RARITY_ICON_FRAME_STYLES[r];
                  const active = selectedData!.spriteIconTintRarity === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      title={RARITY_LABELS[r]}
                      onClick={() => updateSelectedData({ spriteIconTintRarity: r })}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${frame.border} ${frame.bg} ${
                        active ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900' : 'hover:brightness-110'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full shadow-sm"
                        style={{ backgroundColor: RARITY_CRYSTAL_TINT_HEX[r] }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Zaznacz węzeł na canvasie.</p>
        )}
      </Panel>
      </ReactFlow>
      <EqSpritePickerModal
        open={spritePickerOpen && !!selectedData}
        onClose={() => setSpritePickerOpen(false)}
        currentPositions={selectedData?.spritePositions ?? []}
        multiFrame={false}
        onPick={(positions) => {
          updateSelectedData({ spritePositions: positions });
        }}
      />
    </>
  );
}

type SkillTreeEditorProps = {
  /** `readonly` — ukryte kropki uchwytów (np. podgląd w grze). Domyślnie `edit`. */
  mode?: SkillTreeCanvasMode;
};

export default function SkillTreeEditor({ mode = 'edit' }: SkillTreeEditorProps) {
  return (
    <ReactFlowProvider>
      <SkillTreeCanvasModeProvider mode={mode}>
        <div className="relative h-full w-full">
          <SkillTreeEditorInner />
        </div>
      </SkillTreeCanvasModeProvider>
    </ReactFlowProvider>
  );
}
