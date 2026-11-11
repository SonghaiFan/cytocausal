import type { CausalPath, Snapshot } from "@cytocausal/core";

type Search = { start: string; end: string; paths: CausalPath[]; complete: boolean };

/** A sparse connection of selected nodes using directed, unweighted shortest paths.
 * Greedy reuse keeps this interactive; it is not an exact directed Steiner solver.
 */
export function selectionPaths(snapshot: Snapshot, selected: string[]): Search[] {
  const visible = new Set(snapshot.nodes.map(node => node.id));
  const ids = [...new Set(selected)].filter(id => visible.has(id)).sort();
  if (ids.length < 2) return [];
  const terminals = new Set(ids);
  const outgoing = new Map<string, typeof snapshot.edges>();
  for (const edge of [...snapshot.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!visible.has(edge.source) || !visible.has(edge.target)) continue;
    const edges = outgoing.get(edge.source) ?? [];
    edges.push(edge); outgoing.set(edge.source, edges);
  }
  const candidates: { start: string; end: string; path: CausalPath }[] = [];
  for (const start of ids) {
    const previous = new Map<string, { node: string; edge: string }>();
    const seen = new Set([start]);
    const queue = [start];
    for (let index = 0; index < queue.length; index++) {
      const node = queue[index];
      for (const edge of outgoing.get(node) ?? []) {
        if (seen.has(edge.target)) continue;
        seen.add(edge.target); queue.push(edge.target);
        previous.set(edge.target, { node, edge: edge.id });
      }
    }
    for (const end of ids) {
      if (end === start || !previous.has(end)) continue;
      const nodes = [end], edges: string[] = [];
      let node = end;
      while (node !== start) {
        const via = previous.get(node)!;
        edges.push(via.edge); nodes.push(via.node); node = via.node;
      }
      candidates.push({ start, end, path: { nodes: nodes.reverse(), edges: edges.reverse() } });
    }
  }
  const parent = new Map<string, string>();
  const root = (id: string): string => {
    const p = parent.get(id);
    if (!p || p === id) return id;
    const r = root(p); parent.set(id, r); return r;
  };
  const usedEdges = new Set<string>(), usedNodes = new Set(ids);
  const result: Search[] = [];
  while (true) {
    const available = candidates.filter(c => root(c.start) !== root(c.end));
    if (!available.length) break;
    const cost = (c: typeof available[number]) => [
      c.path.edges.filter(id => !usedEdges.has(id)).length,
      c.path.nodes.filter(id => !usedNodes.has(id) && !terminals.has(id)).length,
      c.path.edges.length,
    ];
    available.sort((a, b) => {
      const ac = cost(a), bc = cost(b);
      for (let i = 0; i < ac.length; i++) if (ac[i] !== bc[i]) return ac[i] - bc[i];
      return a.start.localeCompare(b.start) || a.end.localeCompare(b.end);
    });
    const chosen = available[0];
    result.push({ start: chosen.start, end: chosen.end, paths: [chosen.path], complete: true });
    const component = root(chosen.start);
    chosen.path.nodes.forEach(id => { parent.set(root(id), component); usedNodes.add(id); });
    chosen.path.edges.forEach(id => usedEdges.add(id));
  }
  // Explain disconnected selections without listing every unreachable pair.
  const components = [...new Set(ids.map(root))];
  for (const component of components.slice(1)) {
    result.push({ start: ids[0], end: ids.find(id => root(id) === component)!, paths: [], complete: true });
  }
  return result;
}
