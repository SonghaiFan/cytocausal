import type { CausalDataset, Snapshot } from "./types.ts";

/** Finds a snapshot by id, and says which one is missing instead of failing later. */
export function getSnapshot(dataset: CausalDataset, id: string): Snapshot {
  const snapshot = dataset.snapshots.find((item) => item.id === id);
  if (!snapshot) {
    const known = dataset.snapshots.map((item) => `"${item.id}"`).join(", ");
    throw new Error(`Dataset "${dataset.id}" has no snapshot "${id}". It has ${known}.`);
  }
  return snapshot;
}

/** Whether the dataset says how nodes of these two snapshots correspond, in either direction. */
export const hasCorrespondence = (dataset: CausalDataset, from: string, to: string) =>
  (dataset.correspondences ?? []).some(
    (item) => (item.from === from && item.to === to) || (item.from === to && item.to === from),
  );

/**
 * Lists the nodes of `to` that each node of `from` corresponds to, in either direction. A node
 * can have several: in reverse, a merge becomes a split.
 */
export function getCounterparts(dataset: CausalDataset, from: string, to: string) {
  const counterparts: Record<string, string[]> = {};
  for (const correspondence of dataset.correspondences ?? []) {
    const forward = correspondence.from === from && correspondence.to === to;
    const backward = correspondence.from === to && correspondence.to === from;
    if (!forward && !backward) continue;
    for (const [source, target] of Object.entries(correspondence.nodes)) {
      const [key, value] = forward ? [source, target] : [target, source];
      const list = (counterparts[key] ||= []);
      if (!list.includes(value)) list.push(value);
    }
  }
  return counterparts;
}
