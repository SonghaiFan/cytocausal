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

/** For each node id of one version, the ids it became in another. */
export type NodeMapping = Record<string, string[]>;

/** Where a version is in the dataset's order. */
export const positionOf = (dataset: CausalDataset, id: string) => {
  const index = dataset.snapshots.findIndex((snapshot) => snapshot.id === id);
  if (index < 0) getSnapshot(dataset, id); // throws, naming the versions there are
  return index;
};

/** Ids that are in both versions map to themselves: the rule when nothing else is stated. */
function byId(dataset: CausalDataset, from: string, to: string): NodeMapping {
  const kept = new Set(getSnapshot(dataset, to).nodes.map(({ id }) => id));
  return Object.fromEntries(
    getSnapshot(dataset, from)
      .nodes.filter(({ id }) => kept.has(id))
      .map(({ id }) => [id, [id]]),
  );
}

/** One step between two versions: the correspondence stated for them, or matching ids. */
export const stepBetween = (dataset: CausalDataset, from: string, to: string): NodeMapping =>
  hasCorrespondence(dataset, from, to) ? getCounterparts(dataset, from, to) : byId(dataset, from, to);

/**
 * Which nodes of `to` each node of `from` became, for any two versions, in either direction.
 *
 * A correspondence stated for exactly these two versions is used as it is. Otherwise each step
 * between them, in the order the dataset lists its versions, is joined: its correspondence, or
 * matching ids where it has none. So V1 to V3 keeps a rename made between V1 and V2. A node lost
 * along the way, with no counterpart by the end, still matches a node of `to` with its id, if no
 * other node already became that one.
 */
export function followNodes(dataset: CausalDataset, from: string, to: string): NodeMapping {
  if (from === to) return byId(dataset, from, to);
  if (hasCorrespondence(dataset, from, to)) return getCounterparts(dataset, from, to);
  const [start, end] = [positionOf(dataset, from), positionOf(dataset, to)];
  const way = Math.sign(end - start);
  if (Math.abs(end - start) === 1) return byId(dataset, from, to);

  let mapping: NodeMapping = Object.fromEntries(
    getSnapshot(dataset, from).nodes.map(({ id }) => [id, [id]]),
  );
  for (let index = start; index !== end; index += way) {
    const step = stepBetween(dataset, dataset.snapshots[index].id, dataset.snapshots[index + way].id);
    mapping = Object.fromEntries(
      Object.entries(mapping).map(([id, reached]) => [id, [...new Set(reached.flatMap((node) => step[node] ?? []))]]),
    );
  }

  const claimed = new Set(Object.values(mapping).flat());
  const direct = byId(dataset, from, to);
  for (const [id, reached] of Object.entries(mapping)) {
    if (reached.length === 0 && direct[id] && !claimed.has(id)) mapping[id] = [id];
  }
  return Object.fromEntries(Object.entries(mapping).filter(([, reached]) => reached.length > 0));
}
