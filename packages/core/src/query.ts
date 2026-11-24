import { causalFailure, type CausalResult, type ElementSet } from "./document.ts";
import type { CausalEdge, CausalNode, Snapshot } from "./types.ts";
export interface ElementFilter { label?: string; metadata?: Record<string, string | number | boolean | null> }
export interface CausalQuery {
  node(id: string): Readonly<CausalNode> | undefined;
  edge(id: string): Readonly<CausalEdge> | undefined;
  nodes(filter?: ElementFilter | ((node: Readonly<CausalNode>) => boolean)): ElementSet;
  edges(filter?: Pick<ElementFilter, "metadata"> | ((edge: Readonly<CausalEdge>) => boolean)): ElementSet;
  union(...sets: ElementSet[]): CausalResult<ElementSet>;
  intersection(...sets: ElementSet[]): CausalResult<ElementSet>;
  difference(first: ElementSet, ...sets: ElementSet[]): CausalResult<ElementSet>;
  filter(set: ElementSet, predicate: (element: Readonly<CausalNode | CausalEdge>) => boolean): CausalResult<ElementSet>;
}
const detached = <T extends object>(value: T): Readonly<T> => Object.freeze(structuredClone(value));
/** Queries capture one snapshot revision. Results remain detached when the document changes. */
export function querySnapshot(snapshot: Snapshot, revision = 0): CausalQuery {
  const data = structuredClone(snapshot);
  const make = (nodes: readonly string[], edges: readonly string[]): ElementSet => Object.freeze({ snapshotId: data.id, revision, nodes: Object.freeze([...new Set(nodes)]), edges: Object.freeze([...new Set(edges)]) });
  const check = (sets: ElementSet[]): CausalResult<void> => {
    if (sets.some(set => set.snapshotId !== data.id)) return causalFailure("SnapshotMismatch", "Collections belong to different snapshots.");
    if (sets.some(set => set.revision !== revision)) return causalFailure("StaleResult", "Collections belong to different revisions.");
    const unknown = sets.flatMap(set => [...(set.nodes ?? []).filter(id => !data.nodes.some(n => n.id === id)), ...(set.edges ?? []).filter(id => !data.edges.some(e => e.id === id))]);
    return unknown.length ? causalFailure("UnknownElement", "A collection contains unknown elements.", unknown) : { ok: true, value: undefined };
  };
  const matches = (metadata: Record<string, unknown> | undefined, filter: ElementFilter["metadata"]) => Object.entries(filter ?? {}).every(([key, value]) => metadata?.[key] === value);
  const combine = (kind: "union" | "intersection" | "difference", sets: ElementSet[]): CausalResult<ElementSet> => {
    const valid = check(sets); if (!valid.ok) return valid;
    const ids = (field: "nodes" | "edges") => {
      const [first = [], ...others] = sets.map(set => [...(set[field] ?? [])]);
      return kind === "union" ? [first, ...others].flat() : first.filter(id => kind === "intersection" ? others.every(set => set.includes(id)) : others.every(set => !set.includes(id)));
    };
    return { ok: true, value: make(ids("nodes"), ids("edges")) };
  };
  return {
    node: id => { const node = data.nodes.find(n => n.id === id); return node && detached(node); },
    edge: id => { const edge = data.edges.find(e => e.id === id); return edge && detached(edge); },
    nodes: filter => make(data.nodes.filter(node => typeof filter === "function" ? filter(detached(node)) : (filter?.label === undefined || node.label === filter.label) && matches(node.metadata, filter?.metadata)).map(n => n.id), []),
    edges: filter => make([], data.edges.filter(edge => typeof filter === "function" ? filter(detached(edge)) : matches(edge.metadata, filter?.metadata)).map(e => e.id)),
    union: (...sets) => combine("union", sets), intersection: (...sets) => combine("intersection", sets), difference: (first, ...sets) => combine("difference", [first, ...sets]),
    filter: (set, predicate) => {
      const valid = check([set]); if (!valid.ok) return valid;
      return { ok: true, value: make((set.nodes ?? []).filter(id => predicate(detached(data.nodes.find(n => n.id === id)!))), (set.edges ?? []).filter(id => predicate(detached(data.edges.find(e => e.id === id)!)))) };
    },
  };
}
