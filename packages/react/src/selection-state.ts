import { causalFailure, type CausalResult, type ElementIds, type ElementSet, type Snapshot } from "@cytocausal/core";
export type SelectionOperation = "set" | "add" | "remove" | "toggle";
/** Resolves the whole next selection before a caller changes any state. */
export function resolveSelection(snapshot: Snapshot, revision: number, current: ElementIds, target: ElementIds | ElementSet, operation: SelectionOperation, maxNodes = Infinity): CausalResult<ElementSet> {
  if ("snapshotId" in target && target.snapshotId !== snapshot.id) return causalFailure("SnapshotMismatch", "The selection belongs to another snapshot.");
  if ("revision" in target && target.revision !== revision) return causalFailure("StaleResult", "The selection is stale.");
  for (const [kind, elements] of [["nodes", snapshot.nodes], ["edges", snapshot.edges]] as const) {
    const unknown = (target[kind] ?? []).filter(id => !elements.some(element => element.id === id));
    if (unknown.length) return causalFailure("UnknownElement", `Unknown ${kind}: ${unknown.join(", ")}`, unknown);
  }
  const next = (kind: "nodes" | "edges") => {
    const requested = [...new Set(target[kind] ?? [])];
    const before = [...new Set(current[kind] ?? [])].filter(id => snapshot[kind].some(element => element.id === id));
    if (operation === "set") return requested;
    if (operation === "add") return [...new Set([...before, ...requested])];
    if (operation === "remove") return before.filter(id => !requested.includes(id));
    return [...before.filter(id => !requested.includes(id)), ...requested.filter(id => !before.includes(id))];
  };
  const nodes = next("nodes"), edges = next("edges");
  if (nodes.length > maxNodes) return causalFailure("SelectionLimit", `Select at most ${maxNodes} nodes.`);
  return { ok: true, value: { nodes, edges, snapshotId: snapshot.id, revision } };
}
