"use client";
import { useEffect, useRef } from "react";
import { causalFailure, type CausalDocument, type CausalResult, type ElementIds, type ElementSet, type Snapshot } from "@cytocausal/core";
import type { useCausalGraph } from "./useCausalGraph.ts";
import { resolveSelection, type SelectionOperation } from "./selection-state.ts";
export interface CausalSelection {
  current(): ElementSet;
  set(target: ElementIds | ElementSet): CausalResult<ElementSet>;
  add(target: ElementIds | ElementSet): CausalResult<ElementSet>;
  remove(target: ElementIds | ElementSet): CausalResult<ElementSet>;
  toggle(target: ElementIds | ElementSet): CausalResult<ElementSet>;
  clear(): CausalResult<ElementSet>;
  all(options?: SelectionScope): CausalResult<ElementSet>;
  invert(options?: SelectionScope): CausalResult<ElementSet>;
}
export interface SelectionScope { kind?: "nodes" | "edges" | "elements"; scope?: "snapshot" | "visible" }
export function useCausalSelection(graph: ReturnType<typeof useCausalGraph>, snapshot: Snapshot, revision: number, maxNodes: number, document?: CausalDocument): CausalSelection {
  const latest = useRef({ graph, snapshot, revision, maxNodes, document });
  latest.current = { graph, snapshot, revision, maxNodes, document };
  const source = () => {
    const value = latest.current, state = value.document?.getState();
    return { ...value, revision: state?.revision ?? value.revision, snapshot: state?.dataset.snapshots.find(s => s.id === value.snapshot.id) ?? state?.dataset.snapshots[0] ?? value.snapshot };
  };
  const current = (): ElementSet => {
    const { graph, snapshot, revision } = source(), chosen = graph.currentSelection();
    return { snapshotId: snapshot.id, revision, nodes: [...chosen.nodes].filter(id => snapshot.nodes.some(n => n.id === id)), edges: [...chosen.edges].filter(id => snapshot.edges.some(e => e.id === id)) };
  };
  const apply = (target: ElementIds | ElementSet, operation: SelectionOperation) => {
    const { graph, snapshot, revision, maxNodes } = source();
    const result = resolveSelection(snapshot, revision, current(), target, operation, maxNodes);
    if (result.ok) graph.replaceSelection(result.value);
    return result;
  };
  const universe = ({ kind = "elements", scope = "snapshot" }: SelectionScope = {}): CausalResult<ElementIds> => {
    const { graph, snapshot } = source();
    if (scope === "visible" && (!graph.cy.current || graph.cy.current.destroyed())) return causalFailure("ViewUnavailable", "Visible selection requires a mounted graph.");
    const visible = (id: string) => scope !== "visible" || graph.cy.current!.getElementById(id).visible();
    return { ok: true, value: { nodes: kind === "edges" ? [] : snapshot.nodes.filter(n => visible(n.id)).map(n => n.id), edges: kind === "nodes" ? [] : snapshot.edges.filter(e => visible(e.id)).map(e => e.id) } };
  };
  const previousSnapshot = useRef(snapshot.id);
  // Remove selections whose elements disappeared, including document replacement.
  useEffect(() => {
    if (previousSnapshot.current !== snapshot.id) {
      previousSnapshot.current = snapshot.id; graph.replaceSelection({}); return;
    }
    const before = graph.currentSelection(), next = current();
    if (before.nodes.join("\0") !== next.nodes?.join("\0") || before.edges.join("\0") !== next.edges?.join("\0")) graph.replaceSelection(next);
  }, [graph.replaceSelection, snapshot, revision]);
  return {
    current, set: target => apply(target, "set"), add: target => apply(target, "add"), remove: target => apply(target, "remove"), toggle: target => apply(target, "toggle"), clear: () => apply({}, "set"),
    all: options => { const result = universe(options); return result.ok ? apply(result.value, "set") : result; },
    invert: options => { const result = universe(options); return result.ok ? apply(result.value, "toggle") : result; },
  };
}
