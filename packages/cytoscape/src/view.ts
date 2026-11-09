import type { Core } from "cytoscape";

/**
 * Fits the visible nodes to the screen. Cytoscape's own fit includes labels, whose size can
 * depend on zoom, so each fit would change the next one.
 */
export function fitNodes(cy: Core, duration = 0) {
  fitBox(cy, cy.nodes(":visible").boundingBox({ includeLabels: false }), duration);
}

/** Fits an area of the graph, in model units, to the screen. */
export function fitBox(
  cy: Core,
  box: { x1: number; x2: number; y1: number; y2: number; w: number; h: number },
  duration = 0,
) {
  const padding = 30;
  const zoom = Math.min(
    (cy.width() - 2 * padding) / box.w,
    (cy.height() - 2 * padding) / box.h,
    cy.maxZoom(),
  );
  const pan = {
    x: (cy.width() - zoom * (box.x1 + box.x2)) / 2,
    y: (cy.height() - zoom * (box.y1 + box.y2)) / 2,
  };
  if (duration > 0) cy.animate({ zoom, pan }, { duration });
  else cy.viewport({ zoom, pan });
}

/** Downloads the whole graph as a PNG. */
export function exportImage(cy: Core, fileName: string, background: string) {
  const blob = cy.png({ full: true, scale: 2, bg: background, output: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.png`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Zooms around the middle of the screen. */
export function zoomBy(cy: Core, factor: number, duration = 0) {
  const renderedPosition = { x: cy.width() / 2, y: cy.height() / 2 };
  const zoom = { level: cy.zoom() * factor, renderedPosition };
  if (duration > 0) cy.animate({ zoom }, { duration });
  else cy.zoom(zoom);
}
