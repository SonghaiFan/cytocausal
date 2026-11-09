import type {
  CausalDataset,
  CausalEdge,
  CausalNode,
  Correspondence,
  Evidence,
  Snapshot,
} from "./types.ts";

/** Who stated a node or link, each once, in the order they appear in its evidence. */
export function contributorsOf({ evidence }: { evidence?: Evidence[] }): string[] {
  const names = new Set<string>();
  for (const { contributor } of evidence ?? []) if (contributor) names.add(contributor);
  return [...names];
}

/** How many people stated a node or link. */
export const supportOf = (item: { evidence?: Evidence[] }) => contributorsOf(item).length;

export interface ContributorSummary {
  contributor: string;
  /** How many nodes they stated. */
  nodes: number;
  /** How many links they stated. */
  links: number;
}

/** Everyone who stated part of a snapshot, in natural order, such as citizen_2 before citizen_10. */
export function listContributors({ nodes, edges }: Snapshot): ContributorSummary[] {
  const summaries = new Map<string, ContributorSummary>();
  const count = (items: { evidence?: Evidence[] }[], field: "nodes" | "links") => {
    for (const item of items) {
      for (const contributor of contributorsOf(item)) {
        if (!summaries.has(contributor)) summaries.set(contributor, { contributor, nodes: 0, links: 0 });
        summaries.get(contributor)![field]++;
      }
    }
  };
  count(nodes, "nodes");
  count(edges, "links");
  return [...summaries.values()].sort((a, b) =>
    a.contributor.localeCompare(b.contributor, undefined, { numeric: true }),
  );
}

/**
 * Keeps what the given people stated: their links, the nodes those links join, and their own
 * nodes. Links with no contributor are left out.
 */
export function filterByContributors(snapshot: Snapshot, contributors: string[]): Snapshot {
  const chosen = new Set(contributors);
  const statedBy = (item: { evidence?: Evidence[] }) =>
    contributorsOf(item).some((name) => chosen.has(name));
  const edges = snapshot.edges.filter(statedBy);
  const ends = new Set(edges.flatMap(({ source, target }) => [source, target]));
  return {
    ...snapshot,
    nodes: snapshot.nodes.filter((node) => ends.has(node.id) || statedBy(node)),
    edges,
  };
}

export interface CombineOptions {
  /** The combined dataset's id. */
  id: string;
  /**
   * Which concept a node stands for. Nodes with the same key become one. Defaults to the node
   * id, which is only right when ids mean the same thing in every dataset.
   */
  key?: (node: CausalNode, dataset: CausalDataset) => string;
  /** Who a dataset's unattributed nodes and links came from. Defaults to the dataset id. */
  contributorOf?: (dataset: CausalDataset) => string;
}

export interface CombinedDataset {
  dataset: CausalDataset;
  /** Disagreements the combination couldn't settle, such as one key with two labels. */
  issues: string[];
}

/** Gives each piece of evidence a contributor, so support can always be counted. */
const attribute = (evidence: Evidence[] | undefined, contributor: string): Evidence[] =>
  evidence?.length
    ? evidence.map((item) => (item.contributor ? item : { ...item, contributor }))
    : [{ contributor }];

/**
 * Combines several datasets, such as one per workshop participant, into one. Snapshots with the
 * same id are merged: nodes by `key`, and links by the nodes they join and their polarity. Every
 * node and link keeps the evidence of each source, so `supportOf` counts who stated it. When
 * people disagree on a link's polarity, both links are kept side by side.
 */
export function combineDatasets(
  datasets: CausalDataset[],
  { id, key = (node) => node.id, contributorOf = (dataset) => dataset.id }: CombineOptions,
): CombinedDataset {
  const issues: string[] = [];
  const snapshotIds = [...new Set(datasets.flatMap(({ snapshots }) => snapshots.map((s) => s.id)))];
  // The key of every node, by dataset and snapshot, so links and correspondences can follow it
  const keys = new Map<string, Map<string, string>>();
  const keysOf = (dataset: CausalDataset, snapshot: string) => {
    const lookup = `${dataset.id}\u0000${snapshot}`;
    if (!keys.has(lookup)) {
      const found = dataset.snapshots.find((item) => item.id === snapshot);
      keys.set(lookup, new Map(found?.nodes.map((node) => [node.id, key(node, dataset)]) ?? []));
    }
    return keys.get(lookup)!;
  };

  const snapshots: Snapshot[] = snapshotIds.map((snapshotId) => {
    const nodes = new Map<string, CausalNode & { evidence: Evidence[] }>();
    const named = new Map<string, string>();
    const links = new Map<string, Omit<CausalEdge, "id"> & { evidence: Evidence[] }>();

    for (const dataset of datasets) {
      const snapshot = dataset.snapshots.find((item) => item.id === snapshotId);
      if (!snapshot) continue;
      const contributor = contributorOf(dataset);
      const keyOf = keysOf(dataset, snapshotId);

      for (const node of snapshot.nodes) {
        const nodeKey = keyOf.get(node.id)!;
        const evidence = attribute(node.evidence, contributor);
        const existing = nodes.get(nodeKey);
        if (!existing) {
          nodes.set(nodeKey, { id: nodeKey, label: node.label, evidence });
          named.set(nodeKey, dataset.id);
          continue;
        }
        if (existing.label !== node.label) {
          issues.push(
            `${snapshotId}: ${nodeKey} is "${existing.label}" in ${named.get(nodeKey)} and "${node.label}" in ${dataset.id}`,
          );
        }
        existing.evidence.push(...evidence);
      }

      for (const edge of snapshot.edges) {
        const source = keyOf.get(edge.source);
        const target = keyOf.get(edge.target);
        if (source === undefined || target === undefined) {
          issues.push(`${snapshotId}: ${dataset.id} link ${edge.id} references a missing node`);
          continue;
        }
        const linkKey = [source, target, edge.polarity ?? ""].join("\u0000");
        const evidence = attribute(edge.evidence, contributor);
        const existing = links.get(linkKey);
        if (existing) existing.evidence.push(...evidence);
        else links.set(linkKey, { source, target, polarity: edge.polarity, evidence });
      }
    }

    // A pair with one polarity keeps a plain id. Disagreeing links say which side they're on
    const variants = new Map<string, number>();
    for (const { source, target } of links.values()) {
      const pair = `${source}->${target}`;
      variants.set(pair, (variants.get(pair) ?? 0) + 1);
    }
    const edges = [...links.values()].map((link): CausalEdge => {
      const pair = `${link.source}->${link.target}`;
      const edgeId = variants.get(pair)! > 1 ? `${pair}:${link.polarity ?? "unsigned"}` : pair;
      return { id: edgeId, ...link };
    });

    return { id: snapshotId, nodes: [...nodes.values()], edges };
  });

  // Correspondences are kept per direction, as getCounterparts reads both
  const correspondences = new Map<string, Correspondence>();
  for (const dataset of datasets) {
    for (const { from, to, nodes } of dataset.correspondences ?? []) {
      const pair = `${from}\u0000${to}`;
      if (!correspondences.has(pair)) correspondences.set(pair, { from, to, nodes: {} });
      const combined = correspondences.get(pair)!.nodes;
      const fromKeys = keysOf(dataset, from);
      const toKeys = keysOf(dataset, to);
      for (const [source, target] of Object.entries(nodes)) {
        const sourceKey = fromKeys.get(source);
        const targetKey = toKeys.get(target);
        if (sourceKey === undefined || targetKey === undefined) {
          issues.push(`${from}->${to}: ${dataset.id} maps ${source} to ${target}, which is missing`);
          continue;
        }
        if (combined[sourceKey] !== undefined && combined[sourceKey] !== targetKey) {
          issues.push(
            `${from}->${to}: ${sourceKey} becomes ${combined[sourceKey]} elsewhere, but ${targetKey} in ${dataset.id}`,
          );
          continue;
        }
        combined[sourceKey] = targetKey;
      }
    }
  }

  return {
    dataset: { id, snapshots, correspondences: [...correspondences.values()] },
    issues,
  };
}
