import { diffSnapshots, type LinkPolarity, type SnapshotDiff } from "./diff.ts";
import { getSnapshot, positionOf, stepBetween } from "./snapshots.ts";
import type { CausalDataset, CausalEdge, CausalNode } from "./types.ts";

/** What changed between one version and the next. */
export interface VersionStep {
  from: string;
  to: string;
  diff: SnapshotDiff;
  /** How many nodes and links were added, removed and changed, for a timeline. */
  counts: { added: number; removed: number; changed: number };
}

/** The changes from each version to the next, in the order the dataset lists them. */
export function versionSteps(dataset: CausalDataset): VersionStep[] {
  return dataset.snapshots.slice(1).map((snapshot, index) => {
    const from = dataset.snapshots[index].id;
    const diff = diffSnapshots(dataset, from, snapshot.id);
    return {
      from,
      to: snapshot.id,
      diff,
      counts: {
        added: diff.addedNodes.length + diff.addedLinks.length,
        removed: diff.removedNodes.length + diff.removedLinks.length,
        changed:
          diff.renamedNodes.length +
          diff.mergedNodes.length +
          diff.splitNodes.length +
          diff.regroupedNodes.length +
          diff.changedLinks.length,
      },
    };
  });
}

/** How a node came to be in a version, compared with the version before. */
export type NodeChange = "start" | "added" | "unchanged" | "renamed" | "merged" | "split" | "regrouped" | "removed";

/** One node, or nodes joined by a merge or split, from one version to the next. */
export interface NodeHistoryPart {
  change: NodeChange;
  /** What it was in the version before. */
  before: CausalNode[];
  /** What it is in this version. */
  nodes: CausalNode[];
}

export interface NodeHistoryEntry {
  version: string;
  /**
   * The most telling change among `parts`: nodes that later merge are separate before, and may
   * change in different ways.
   */
  change: NodeChange;
  /** Everything the node is in this version: several after a split, none once removed. */
  nodes: CausalNode[];
  /** What it was in the version before, with anything it merged with. */
  before: CausalNode[];
  /** Each separate node of this version and where it came from. */
  parts: NodeHistoryPart[];
}

/**
 * Follows nodes one step, and finds everything that step joins them with: a node they merge
 * with, or the other half of a split. Returns the ids on each side.
 */
function groupAcross(dataset: CausalDataset, from: string, to: string, ids: string[]) {
  const forward = stepBetween(dataset, from, to);
  const backward = stepBetween(dataset, to, from);
  let sources = new Set(ids);
  let targets = new Set<string>();
  for (let round = 0; round < 8; round++) {
    targets = new Set([...sources].flatMap((id) => forward[id] ?? []));
    const more = new Set([...sources, ...[...targets].flatMap((id) => backward[id] ?? [])]);
    if (more.size === sources.size) break;
    sources = more;
  }
  return { sources: [...sources], targets: [...targets], forward };
}

const classify = (before: CausalNode[], after: CausalNode[]): NodeChange => {
  if (after.length === 0) return "removed";
  if (before.length === 0) return "added";
  if (before.length === 1 && after.length === 1) return before[0].label === after[0].label ? "unchanged" : "renamed";
  if (after.length === 1) return "merged";
  if (before.length === 1) return "split";
  return "regrouped";
};

/** Which change sums up an entry whose parts changed in different ways. */
const TELLING: NodeChange[] = ["regrouped", "merged", "split", "renamed", "added", "removed", "unchanged"];

const nodesOf = (dataset: CausalDataset, version: string, ids: string[]) => {
  const { nodes } = getSnapshot(dataset, version);
  return nodes.filter(({ id }) => ids.includes(id));
};

/**
 * The entry for one step: the nodes before, the nodes after, and `forward`, which maps the
 * before ids to the after ids. Nodes joined by the mapping form one part.
 */
function entryFor(version: string, before: CausalNode[], after: CausalNode[], forward: Record<string, string[]>): NodeHistoryEntry {
  const parts: NodeHistoryPart[] = [];
  const placed = new Set<string>();
  for (const start of before) {
    if (placed.has(start.id)) continue;
    // Grows a part through the mapping, both ways
    const sources = new Set([start.id]);
    let targets = new Set<string>();
    for (let round = 0; round < 8; round++) {
      targets = new Set([...sources].flatMap((id) => forward[id] ?? []).filter((id) => after.some((node) => node.id === id)));
      const more = before.filter(({ id }) => (forward[id] ?? []).some((target) => targets.has(target))).map(({ id }) => id);
      if (more.every((id) => sources.has(id))) break;
      more.forEach((id) => sources.add(id));
    }
    sources.forEach((id) => placed.add(id));
    const part = { before: before.filter(({ id }) => sources.has(id)), nodes: after.filter(({ id }) => targets.has(id)) };
    parts.push({ change: classify(part.before, part.nodes), ...part });
  }
  const reached = new Set(parts.flatMap(({ nodes }) => nodes.map(({ id }) => id)));
  for (const node of after) if (!reached.has(node.id)) parts.push({ change: "added", before: [], nodes: [node] });
  const change =
    after.length === 0 ? "removed" : before.length === 0 ? "added" : TELLING.find((kind) => parts.some((part) => part.change === kind))!;
  return { version, change, nodes: after, before, parts };
}

/**
 * A node's history across every version: when it first appears, each rename, merge or split,
 * and when it's removed. It starts from the node as it is in `version`, and follows it back to
 * where it began and forward to the last version or its removal. Versions before it began are
 * left out.
 */
export function nodeHistory(dataset: CausalDataset, version: string, nodeId: string): NodeHistoryEntry[] {
  const at = positionOf(dataset, version);
  if (!getSnapshot(dataset, version).nodes.some(({ id }) => id === nodeId)) {
    throw new Error(`Version "${version}" has no node "${nodeId}".`);
  }
  const versions = dataset.snapshots.map(({ id }) => id);
  const entries: NodeHistoryEntry[] = [];

  // Back to where it began. Each entry says how its version's nodes came from the one before
  let current = [nodeId];
  for (let index = at; index >= 0; index--) {
    if (index === 0) {
      const nodes = nodesOf(dataset, versions[0], current);
      entries.unshift({ version: versions[0], change: "start", nodes, before: [], parts: [{ change: "start", before: [], nodes }] });
      break;
    }
    const back = groupAcross(dataset, versions[index], versions[index - 1], current);
    const after = nodesOf(dataset, versions[index], back.sources);
    const before = nodesOf(dataset, versions[index - 1], back.targets);
    entries.unshift(entryFor(versions[index], before, after, stepBetween(dataset, versions[index - 1], versions[index])));
    if (before.length === 0) break;
    current = before.map(({ id }) => id);
  }

  // Forward to the last version, or until it's removed
  current = [nodeId];
  for (let index = at + 1; index < versions.length; index++) {
    const ahead = groupAcross(dataset, versions[index - 1], versions[index], current);
    const before = nodesOf(dataset, versions[index - 1], ahead.sources);
    const nodes = nodesOf(dataset, versions[index], ahead.targets);
    entries.push(entryFor(versions[index], before, nodes, ahead.forward));
    if (nodes.length === 0) break;
    current = nodes.map(({ id }) => id);
  }
  return entries;
}

/** How a link came to be in a version, compared with the version before. */
export type LinkChange = "start" | "added" | "unchanged" | "flipped" | "removed";

export interface LinkHistoryEntry {
  version: string;
  change: LinkChange;
  /** The links between the two ends in this version: parallel links count together. */
  links: CausalEdge[];
  polarity?: LinkPolarity;
}

const polarityOf = (links: CausalEdge[]): LinkPolarity | undefined => {
  if (links.length === 0) return undefined;
  const kinds = new Set(links.map(({ polarity }) => polarity));
  return kinds.size > 1 ? "mixed" : links[0].polarity;
};

/**
 * A link's history across every version, following both its ends: when it appears, when its
 * polarity flips, and when it's removed. Its ends are followed through renames and merges, so
 * a link between nodes that were renamed is still the same link. Versions where an end doesn't
 * exist, or the link isn't there yet, are left out before it starts.
 */
export function linkHistory(dataset: CausalDataset, version: string, linkId: string): LinkHistoryEntry[] {
  const link = getSnapshot(dataset, version).edges.find(({ id }) => id === linkId);
  if (!link) throw new Error(`Version "${version}" has no link "${linkId}".`);
  const ends = (end: string) =>
    new Map(nodeHistory(dataset, version, end).map((entry) => [entry.version, entry.nodes.map(({ id }) => id)]));
  const [sources, targets] = [ends(link.source), ends(link.target)];

  const entries: LinkHistoryEntry[] = [];
  let previous: LinkHistoryEntry | undefined;
  for (const { id: current, edges } of dataset.snapshots) {
    const [from, to] = [sources.get(current) ?? [], targets.get(current) ?? []];
    const links = edges.filter(({ source, target }) => from.includes(source) && to.includes(target));
    const polarity = polarityOf(links);
    let change: LinkChange;
    if (links.length === 0) {
      if (!previous || previous.change === "removed") {
        previous = undefined;
        continue;
      }
      change = "removed";
    } else if (!previous) change = entries.length === 0 && current === dataset.snapshots[0].id ? "start" : "added";
    else change = previous.polarity === polarity ? "unchanged" : "flipped";
    previous = { version: current, change, links, polarity };
    entries.push(previous);
  }
  return entries;
}
