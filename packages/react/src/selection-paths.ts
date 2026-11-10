import { findCausalPaths, type Snapshot } from "@cytocausal/core";

/** Each unordered pair once, searched in both directions with the core's path limits. */
export function selectionPaths(snapshot: Snapshot, selected: string[]) {
  const visible = new Set(snapshot.nodes.map(({ id }) => id));
  const ids = [...new Set(selected)].filter((id) => visible.has(id));
  return ids.flatMap((from, i) => ids.slice(i + 1).flatMap((to) => [
    { start: from, end: to, ...findCausalPaths(snapshot, from, to) },
    { start: to, end: from, ...findCausalPaths(snapshot, to, from) },
  ]));
}
