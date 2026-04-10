import type { Edge, Node } from '@xyflow/react';
import type { SkillNodeData } from '@/lib/skill-tree/types';

const STORAGE_KEY = 'bicek:admin:skill-tree-editor:v1';

type PersistedEdge = Pick<Edge, 'id' | 'source' | 'target'>;

type PersistedPayload = {
  nodes: Array<Pick<Node, 'id' | 'type' | 'position'> & { data: SkillNodeData }>;
  edges: PersistedEdge[];
};

export function loadSkillTreeEditorGraph(
  fallbackNodes: Node[],
  fallbackEdges: Edge[],
  edgeDefaults: Partial<Edge>,
): { nodes: Node[]; edges: Edge[] } {
  if (typeof window === 'undefined') {
    return { nodes: fallbackNodes, edges: fallbackEdges };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nodes: fallbackNodes, edges: fallbackEdges };
    const parsed = JSON.parse(raw) as Partial<PersistedPayload>;
    if (!parsed?.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      return { nodes: fallbackNodes, edges: fallbackEdges };
    }
    const nodes: Node[] = parsed.nodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'skill',
      position: n.position,
      data: n.data,
    }));
    const edges: Edge[] = (Array.isArray(parsed.edges) ? parsed.edges : []).map((e) => ({
      ...edgeDefaults,
      id: e.id,
      source: e.source,
      target: e.target,
    }));
    return { nodes, edges };
  } catch {
    return { nodes: fallbackNodes, edges: fallbackEdges };
  }
}

export function saveSkillTreeEditorGraph(nodes: Node[], edges: Edge[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedPayload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type ?? 'skill',
        position: n.position,
        data: n.data as SkillNodeData,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}
