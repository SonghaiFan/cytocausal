import type { CausalDataset } from "./types.ts";

const duplicates = (values: string[]) =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

/** Returns a description of every structural problem, or an empty list. */
export function validateDataset(dataset: CausalDataset): string[] {
  const issues: string[] = [];
  const snapshots = new Map(dataset.snapshots.map((snapshot) => [snapshot.id, snapshot]));

  duplicates(dataset.snapshots.map(({ id }) => id)).forEach((id) =>
    issues.push(`duplicate snapshot ${id}`),
  );

  for (const { id, nodes, edges } of dataset.snapshots) {
    const nodeIds = new Set(nodes.map((node) => node.id));
    duplicates(nodes.map((node) => node.id)).forEach((node) =>
      issues.push(`${id}: duplicate node ${node}`),
    );
    duplicates(edges.map((edge) => edge.id)).forEach((edge) =>
      issues.push(`${id}: duplicate edge ${edge}`),
    );
    for (const edge of edges) {
      for (const end of [edge.source, edge.target]) {
        if (!nodeIds.has(end)) issues.push(`${id}: edge ${edge.id} references missing node ${end}`);
      }
    }
  }

  for (const { from, to, nodes } of dataset.correspondences ?? []) {
    const source = snapshots.get(from);
    const target = snapshots.get(to);
    if (!source) issues.push(`correspondence references missing snapshot ${from}`);
    if (!target) issues.push(`correspondence references missing snapshot ${to}`);
    if (!source || !target) continue;
    const sourceIds = new Set(source.nodes.map((node) => node.id));
    const targetIds = new Set(target.nodes.map((node) => node.id));
    for (const [fromId, toId] of Object.entries(nodes)) {
      if (!sourceIds.has(fromId)) issues.push(`${from}->${to}: missing source node ${fromId}`);
      if (!targetIds.has(toId)) issues.push(`${from}->${to}: missing target node ${toId}`);
    }
  }

  return issues;
}
