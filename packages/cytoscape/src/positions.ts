import type { Snapshot } from "@cytocausal/core";
import type { Core, LayoutOptions, Layouts } from "cytoscape";
import { fcoseLayout } from "./layouts.ts";

export type Position = { x: number; y: number };
export type Positions = Record<string, Position>;

export const centre = (points: Position[]): Position => ({
  x: points.reduce((sum, { x }) => sum + x, 0) / points.length,
  y: points.reduce((sum, { y }) => sum + y, 0) / points.length,
});

// Moved to core, which diffs snapshots with it. Kept here so existing imports still work
export { getCounterparts } from "@cytocausal/core";

/**
 * Converts positions keyed by node id in one snapshot to ids in another. Without
 * counterparts, ids are assumed to match. Merged nodes sit at the centre of their sources.
 */
export function alignPositions(positions: Positions, counterparts: Record<string, string[]>) {
  const grouped: Record<string, Position[]> = {};
  Object.entries(positions).forEach(([id, position]) => {
    (counterparts[id] ?? [id]).forEach((target) => (grouped[target] ||= []).push(position));
  });
  return Object.fromEntries(Object.entries(grouped).map(([id, group]) => [id, centre(group)]));
}

/** Records where each node of `snapshot` sits right now. */
export function snapshotPositions(cy: Core, snapshot: Snapshot): Positions {
  return Object.fromEntries(
    snapshot.nodes
      .map(({ id }) => [id, cy.getElementById(id)] as const)
      .filter(([, node]) => node.length > 0)
      .map(([id, node]) => [id, { ...node.position() }]),
  );
}

/** Pins nodes in place and lets fcose arrange the rest around them. */
export function placeAround(cy: Core, positions: Positions): Layouts | null {
  const fixedNodeConstraint = Object.entries(positions)
    .filter(([nodeId]) => cy.getElementById(nodeId).length > 0)
    .map(([nodeId, position]) => ({ nodeId, position }));
  if (fixedNodeConstraint.length === 0) return null;
  // Cytoscape's types don't know fcose's options
  return cy.layout({ ...fcoseLayout, animate: false, fixedNodeConstraint } as unknown as LayoutOptions);
}
