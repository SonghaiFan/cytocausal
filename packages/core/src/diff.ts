import { getCounterparts, getSnapshot, hasCorrespondence } from "./snapshots.ts";
import type { CausalDataset, CausalEdge, CausalNode, Polarity, Snapshot } from "./types.ts";

/** The polarity of the links between two nodes. "mixed" when parallel links disagree. */
export type LinkPolarity = Polarity | "mixed";

export interface SnapshotDiff {
  addedNodes: CausalNode[];
  removedNodes: CausalNode[];
  renamedNodes: { from: CausalNode; to: CausalNode }[];
  /** Several nodes that became one. */
  mergedNodes: { from: CausalNode[]; to: CausalNode }[];
  /** One node that became several. A merge read in reverse. */
  splitNodes: { from: CausalNode; to: CausalNode[] }[];
  /** Several nodes that became several others, such as when two groups were redrawn. */
  regroupedNodes: { from: CausalNode[]; to: CausalNode[] }[];
  /** Every link between nodes that have no counterpart link. */
  addedLinks: CausalEdge[];
  removedLinks: CausalEdge[];
  /**
   * One entry per pair of nodes whose links changed polarity. `from` and `to` are the first link
   * of each side; parallel links between the same nodes count as one.
   */
  changedLinks: { from: CausalEdge; to: CausalEdge; polarity: [LinkPolarity?, LinkPolarity?] }[];
}

/** Disjoint sets, keyed by side and node id, so one id can be in both snapshots. */
function unionFind() {
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(key, root);
    return root;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  return { find, union };
}

/**
 * Groups the nodes of two snapshots that correspond, through the dataset's correspondences or by
 * matching ids without one. A group with nodes on one side only was added or removed.
 */
function groupNodes(dataset: CausalDataset, from: Snapshot, to: Snapshot) {
  const { find, union } = unionFind();
  const toIds = new Set(to.nodes.map(({ id }) => id));
  const counterparts = hasCorrespondence(dataset, from.id, to.id)
    ? getCounterparts(dataset, from.id, to.id)
    : Object.fromEntries(from.nodes.map(({ id }) => [id, [id]]));

  for (const { id } of from.nodes) {
    for (const target of counterparts[id] ?? []) {
      if (toIds.has(target)) union(`from:${id}`, `to:${target}`);
    }
  }

  const groups = new Map<string, { from: CausalNode[]; to: CausalNode[] }>();
  const add = (side: "from" | "to", node: CausalNode) => {
    const root = find(`${side}:${node.id}`);
    if (!groups.has(root)) groups.set(root, { from: [], to: [] });
    groups.get(root)![side].push(node);
  };
  from.nodes.forEach((node) => add("from", node));
  to.nodes.forEach((node) => add("to", node));
  return { groups: [...groups.values()], groupOf: find };
}

const polarityOf = (edges: CausalEdge[]): LinkPolarity | undefined => {
  const kinds = new Set(edges.map(({ polarity }) => polarity));
  return kinds.size > 1 ? "mixed" : edges[0].polarity;
};

/**
 * Compares two snapshots of a dataset, using its correspondences to follow nodes between them.
 * Reading it the other way swaps added and removed, and merged and split.
 */
export function diffSnapshots(dataset: CausalDataset, fromId: string, toId: string): SnapshotDiff {
  const from = getSnapshot(dataset, fromId);
  const to = getSnapshot(dataset, toId);
  const { groups, groupOf } = groupNodes(dataset, from, to);

  const diff: SnapshotDiff = {
    addedNodes: [],
    removedNodes: [],
    renamedNodes: [],
    mergedNodes: [],
    splitNodes: [],
    regroupedNodes: [],
    addedLinks: [],
    removedLinks: [],
    changedLinks: [],
  };

  for (const group of groups) {
    const [sources, targets] = [group.from, group.to];
    if (targets.length === 0) diff.removedNodes.push(...sources);
    else if (sources.length === 0) diff.addedNodes.push(...targets);
    else if (sources.length === 1 && targets.length === 1) {
      if (sources[0].label !== targets[0].label) {
        diff.renamedNodes.push({ from: sources[0], to: targets[0] });
      }
    } else if (targets.length === 1) diff.mergedNodes.push({ from: sources, to: targets[0] });
    else if (sources.length === 1) diff.splitNodes.push({ from: sources[0], to: targets });
    else diff.regroupedNodes.push({ from: sources, to: targets });
  }
  // Groups are listed in the order of the first snapshot, but new nodes read best in their own
  diff.addedNodes.sort((a, b) => to.nodes.indexOf(a) - to.nodes.indexOf(b));

  // Links are compared by the groups they join, so parallel links and merged nodes count once
  const linksBetween = (side: "from" | "to", edges: CausalEdge[]) => {
    const pairs = new Map<string, CausalEdge[]>();
    for (const edge of edges) {
      const key = `${groupOf(`${side}:${edge.source}`)}>${groupOf(`${side}:${edge.target}`)}`;
      pairs.set(key, [...(pairs.get(key) ?? []), edge]);
    }
    return pairs;
  };
  const before = linksBetween("from", from.edges);
  const after = linksBetween("to", to.edges);

  for (const [key, edges] of before) {
    const counterparts = after.get(key);
    if (!counterparts) {
      diff.removedLinks.push(...edges);
      continue;
    }
    const polarity: [LinkPolarity?, LinkPolarity?] = [polarityOf(edges), polarityOf(counterparts)];
    if (polarity[0] !== polarity[1]) {
      diff.changedLinks.push({ from: edges[0], to: counterparts[0], polarity });
    }
  }
  diff.addedLinks = to.edges.filter((edge) => {
    const key = `${groupOf(`to:${edge.source}`)}>${groupOf(`to:${edge.target}`)}`;
    return !before.has(key);
  });

  return diff;
}

export interface ChangeMarks {
  /** Nodes and links new in the later snapshot. */
  added: string[];
  /** Nodes and links gone from the earlier snapshot. */
  removed: string[];
  /**
   * Nodes and links in both that changed: renamed, merged, split or regrouped nodes, and links
   * whose polarity flipped.
   */
  changed: string[];
  /** The links among `changed` whose polarity flipped. */
  flipped: string[];
}

/**
 * What to mark on one side of a diff: `from` for the earlier snapshot, which can show what was
 * removed, or `to` for the later one, which can show what was added. Both show what changed.
 */
export function changeMarks(diff: SnapshotDiff, side: "from" | "to"): ChangeMarks {
  const ids = (items: { id: string }[]) => items.map(({ id }) => id);
  const early = side === "from";
  const regrouped = diff.regroupedNodes.flatMap((group) => (early ? group.from : group.to));
  const flipped = diff.changedLinks.map((link) => (early ? link.from.id : link.to.id));
  const changedNodes = [
    ...diff.renamedNodes.map((pair) => (early ? pair.from : pair.to)),
    ...diff.mergedNodes.flatMap((merge) => (early ? merge.from : [merge.to])),
    ...diff.splitNodes.flatMap((split) => (early ? [split.from] : split.to)),
    ...regrouped,
  ];
  return {
    added: early ? [] : [...ids(diff.addedNodes), ...ids(diff.addedLinks)],
    removed: early ? [...ids(diff.removedNodes), ...ids(diff.removedLinks)] : [],
    changed: [...ids(changedNodes), ...flipped],
    flipped,
  };
}
