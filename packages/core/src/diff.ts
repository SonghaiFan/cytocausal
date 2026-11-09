import type { CausalDataset, CausalEdge, CausalNode, Polarity, Snapshot } from "./types.ts";

export interface SnapshotDiff {
  addedNodes: CausalNode[];
  removedNodes: CausalNode[];
  renamedNodes: { from: CausalNode; to: CausalNode }[];
  /** Several nodes that became one. */
  mergedNodes: { from: CausalNode[]; to: CausalNode }[];
  addedLinks: CausalEdge[];
  removedLinks: CausalEdge[];
  changedLinks: { from: CausalEdge; to: CausalEdge; polarity: [Polarity?, Polarity?] }[];
}

/** Maps node ids across snapshots through correspondences, or by matching ids without one. */
function matchNodes(dataset: CausalDataset, from: Snapshot, to: Snapshot) {
  const matches = new Map<string, string>();
  const correspondence = dataset.correspondences?.find(
    (item) =>
      (item.from === from.id && item.to === to.id) || (item.from === to.id && item.to === from.id),
  );
  if (correspondence) {
    for (const [source, target] of Object.entries(correspondence.nodes)) {
      if (correspondence.from === from.id) matches.set(source, target);
      else matches.set(target, source);
    }
    return matches;
  }
  const ids = new Set(to.nodes.map(({ id }) => id));
  for (const { id } of from.nodes) if (ids.has(id)) matches.set(id, id);
  return matches;
}

/** Compares two snapshots of a dataset, using its correspondences to follow nodes between them. */
export function diffSnapshots(dataset: CausalDataset, fromId: string, toId: string): SnapshotDiff {
  const from = dataset.snapshots.find(({ id }) => id === fromId)!;
  const to = dataset.snapshots.find(({ id }) => id === toId)!;
  const matches = matchNodes(dataset, from, to);
  const toNodes = new Map(to.nodes.map((node) => [node.id, node]));

  const sources = new Map<string, CausalNode[]>();
  const removedNodes: CausalNode[] = [];
  for (const node of from.nodes) {
    const target = matches.get(node.id);
    if (target !== undefined && toNodes.has(target)) {
      sources.set(target, [...(sources.get(target) ?? []), node]);
    } else {
      removedNodes.push(node);
    }
  }

  const renamedNodes: SnapshotDiff["renamedNodes"] = [];
  const mergedNodes: SnapshotDiff["mergedNodes"] = [];
  for (const [target, group] of sources) {
    const node = toNodes.get(target)!;
    if (group.length > 1) mergedNodes.push({ from: group, to: node });
    else if (group[0].label !== node.label) renamedNodes.push({ from: group[0], to: node });
  }

  // Links are compared by the nodes they join, after following those nodes to the new snapshot
  const linkKey = (source: string, target: string) => `${source}>${target}`;
  const toLinks = new Map(to.edges.map((edge) => [linkKey(edge.source, edge.target), edge]));
  const matched = new Set<string>();
  const removedLinks: CausalEdge[] = [];
  const changedLinks: SnapshotDiff["changedLinks"] = [];
  for (const edge of from.edges) {
    const source = matches.get(edge.source);
    const target = matches.get(edge.target);
    const key = source !== undefined && target !== undefined ? linkKey(source, target) : "";
    const counterpart = toLinks.get(key);
    if (!counterpart) {
      removedLinks.push(edge);
      continue;
    }
    matched.add(key);
    if (counterpart.polarity !== edge.polarity) {
      changedLinks.push({
        from: edge,
        to: counterpart,
        polarity: [edge.polarity, counterpart.polarity],
      });
    }
  }

  return {
    addedNodes: to.nodes.filter(({ id }) => !sources.has(id)),
    removedNodes,
    renamedNodes,
    mergedNodes,
    addedLinks: to.edges.filter((edge) => !matched.has(linkKey(edge.source, edge.target))),
    removedLinks,
    changedLinks,
  };
}
