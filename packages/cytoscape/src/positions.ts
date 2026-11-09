import type { Snapshot } from "@cytocausal/core";
import type { Core, LayoutOptions, Layouts, NodeSingular } from "cytoscape";
import { refreshLabels } from "./labels.ts";
import { fcoseLayout } from "./layouts.ts";
import { resolveMotion } from "./motion.ts";
import type { CausalMotion } from "./theme.ts";
import { fitBox, fitNodes } from "./view.ts";

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

type Box = { x1: number; y1: number; x2: number; y2: number; w: number; h: number };

/** The area covering two others. */
const merge = (a: Box, b: Box): Box => {
  const [x1, y1, x2, y2] = [Math.min(a.x1, b.x1), Math.min(a.y1, b.y1), Math.max(a.x2, b.x2), Math.max(a.y2, b.y2)];
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
};

/** The area the visible nodes will fill at these positions, counting each node's size. */
function boxAround(cy: Core, positions: Positions) {
  let [x1, y1, x2, y2] = [Infinity, Infinity, -Infinity, -Infinity];
  cy.nodes(":visible").forEach((node) => {
    const { x, y } = positions[node.id()] ?? node.position();
    const [halfWidth, halfHeight] = [node.width() / 2, node.height() / 2];
    [x1, y1] = [Math.min(x1, x - halfWidth), Math.min(y1, y - halfHeight)];
    [x2, y2] = [Math.max(x2, x + halfWidth), Math.max(y2, y + halfHeight)];
  });
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}

export interface RelayoutOptions {
  /** Where to put nodes instead of running the layout, such as positions it gave before. */
  positions?: Positions;
  motion?: CausalMotion;
  /** Called once nodes are in place. */
  onSettled?: () => void;
}

const RELAYOUT_KEY = "cytocausal-relayout";

/**
 * Works out where a layout would put the visible nodes, then puts them back. The result is moved
 * to the centre of the space the nodes fill now, because layouts each pick their own origin:
 * concentric centres on the canvas, so its nodes would fly off screen. It isn't scaled, since a
 * layout's spacing is what keeps its nodes apart, and shrinking positions without shrinking
 * nodes makes them overlap. Returns null for a layout that runs over time, such as cola, which
 * can't be measured in one go.
 */
export function measureLayout(cy: Core, layout: LayoutOptions): Positions | null {
  const nodes = cy.nodes(":visible");
  if (nodes.length === 0) return {};
  const start = new Map(nodes.map((node) => [node.id(), { ...node.position() }]));
  const before = nodes.boundingBox({ includeLabels: false });

  let finished = false;
  cy.batch(() => {
    const probe = cy.elements(":visible").layout({ ...layout, animate: false, fit: false } as LayoutOptions);
    probe.one("layoutstop", () => (finished = true));
    probe.run();
    if (!finished) probe.stop();
  });
  const after = nodes.boundingBox({ includeLabels: false });
  const placed = new Map(nodes.map((node) => [node.id(), { ...node.position() }]));
  cy.batch(() => nodes.positions((node) => start.get(node.id())!));
  if (!finished) return null;

  const centre = (box: typeof before) => ({ x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 });
  const [from, to] = [centre(after), centre(before)];
  return Object.fromEntries(
    [...placed].map(([id, { x, y }]) => [
      id,
      { x: to.x + (x - from.x), y: to.y + (y - from.y) },
    ]),
  );
}

/**
 * Moves the visible nodes into another layout on the same graph, so people can follow each node
 * there instead of seeing the graph redrawn. The new layout is centred where the old one was, and
 * the view moves with the nodes, so none of them leave the screen on the way. Hidden nodes stay put, so a filter lays out only what's shown. The
 * view fits the result once nodes arrive. A new call stops one in progress.
 */
export function relayout(cy: Core, layout: LayoutOptions, { positions, motion, onSettled }: RelayoutOptions = {}) {
  (cy.scratch(RELAYOUT_KEY) as Layouts | undefined)?.stop();
  const duration = resolveMotion(motion).move;
  const destination = positions ?? measureLayout(cy, layout);
  // A layout that runs over time, such as cola, animates itself instead
  const target = destination
    ? { name: "preset", positions: (node: NodeSingular) => destination[node.id()] ?? node.position() }
    : layout;
  const run = cy.elements(":visible").layout({
    ...target,
    fit: false,
    animate: duration > 0,
    animationDuration: duration,
    animationEasing: "ease-in-out-cubic",
  } as LayoutOptions);
  const view = resolveMotion(motion).view;
  run.one("layoutstop", () => {
    if (cy.destroyed() || cy.scratch(RELAYOUT_KEY) !== run) return;
    // The view closes in on where the nodes ended up
    if (destination) fitBox(cy, boxAround(cy, destination), view);
    else fitNodes(cy, view);
    refreshLabels(cy);
    onSettled?.();
  });
  cy.scratch(RELAYOUT_KEY, run);

  // Nodes travel in straight lines, so they stay inside the area that holds both where they
  // start and where they end. If that's off screen, the view backs out to it first
  const start = () => {
    if (!cy.destroyed() && cy.scratch(RELAYOUT_KEY) === run) run.run();
  };
  if (destination) {
    const both = merge(cy.nodes(":visible").boundingBox({ includeLabels: false }), boxAround(cy, destination));
    const shown = cy.extent();
    const fits = both.x1 >= shown.x1 && both.x2 <= shown.x2 && both.y1 >= shown.y1 && both.y2 <= shown.y2;
    if (fits) start();
    else fitBox(cy, both, view, start);
  } else {
    start();
  }
  return run;
}

/** How far a curved link bows from a straight line, as a share of its length. */
const BOW = 0.12;

/**
 * Bends each curved link in proportion to its length, so a long link, such as one running back
 * against a flow layout, arcs clear of the links and nodes it would otherwise lie on. Links in
 * both directions between two nodes bow to opposite sides, and further links between the same
 * pair bow further out. Writes `arc` data, which `flowing` link styles read. Call it once nodes
 * have settled; `GraphView` does.
 */
export function curveLinks(cy: Core) {
  const pairs = new Map<string, number>();
  cy.batch(() => {
    cy.edges().forEach((edge) => {
      if (edge.isLoop()) return;
      const key = `${edge.source().id()}>${edge.target().id()}`;
      const order = pairs.get(key) ?? 0;
      pairs.set(key, order + 1);
      const from = edge.source().position();
      const to = edge.target().position();
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const arc = Math.min(70, Math.max(14, length * BOW)) * (1 + 0.9 * order);
      edge.data("arc", Math.round(arc * 10) / 10);
    });
  });
}
