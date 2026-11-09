import type { Core, EdgeSingular } from "cytoscape";

export interface LayoutQuality {
  /** Pairs of visible nodes whose boxes overlap. */
  nodeOverlaps: number;
  /** Links whose drawn path runs through a node they don't join. */
  linksThroughNodes: number;
  /** Pairs of links whose paths cross, which more than anything makes a graph hard to follow. */
  linkCrossings: number;
}

type Point = { x: number; y: number };

/** Points along a link as Cytoscape draws it: straight, or a curve through its control point. */
function pathOf(edge: EdgeSingular, steps = 16): Point[] {
  const start = edge.sourceEndpoint();
  const end = edge.targetEndpoint();
  const control = edge.controlPoints()?.[0];
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    if (!control) return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
    const u = 1 - t;
    return {
      x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
      y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
    };
  });
}

const crosses = (a: Point, b: Point, c: Point, d: Point) => {
  const side = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};

/**
 * Counts what makes a layout hard to read, as drawn: overlapping nodes, links through nodes and
 * crossing links. Use it to compare layouts or settings for a graph, or in tests.
 */
export function layoutQuality(cy: Core): LayoutQuality {
  const nodes = cy.nodes(":visible");
  const edges = cy.edges(":visible").filter((edge) => !edge.isLoop()) as unknown as EdgeSingular[];
  const boxes = nodes.map((node) => ({ node, box: node.boundingBox({ includeLabels: false }) }));

  let nodeOverlaps = 0;
  boxes.forEach(({ box: a }, index) =>
    boxes.slice(index + 1).forEach(({ box: b }) => {
      if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) nodeOverlaps++;
    }),
  );

  const paths = [...edges].map((edge) => ({ edge, points: pathOf(edge) }));
  let linksThroughNodes = 0;
  for (const { edge, points } of paths) {
    const through = boxes.some(
      ({ node, box }) =>
        node.id() !== edge.source().id() &&
        node.id() !== edge.target().id() &&
        points.some(({ x, y }) => x > box.x1 && x < box.x2 && y > box.y1 && y < box.y2),
    );
    if (through) linksThroughNodes++;
  }

  let linkCrossings = 0;
  paths.forEach((first, index) =>
    paths.slice(index + 1).forEach((second) => {
      // Links that share a node meet there rather than cross
      const ends = new Set([first.edge.source().id(), first.edge.target().id()]);
      if (ends.has(second.edge.source().id()) || ends.has(second.edge.target().id())) return;
      const found = first.points.some((point, i) =>
        i > 0 && second.points.some((other, j) => j > 0 && crosses(first.points[i - 1], point, second.points[j - 1], other)),
      );
      if (found) linkCrossings++;
    }),
  );

  return { nodeOverlaps, linksThroughNodes, linkCrossings };
}
