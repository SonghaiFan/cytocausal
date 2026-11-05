import type { Core } from "cytoscape";

/**
 * Fits the visible nodes to the screen. Cytoscape's own fit includes labels, whose size can
 * depend on zoom, so each fit would change the next one.
 */
export function fitNodes(cy: Core, duration = 0) {
  const padding = 30;
  const box = cy.nodes(":visible").boundingBox({ includeLabels: false });
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

/** Zooms around the middle of the screen. */
export function zoomBy(cy: Core, factor: number, duration = 0) {
  const renderedPosition = { x: cy.width() / 2, y: cy.height() / 2 };
  const zoom = { level: cy.zoom() * factor, renderedPosition };
  if (duration > 0) cy.animate({ zoom }, { duration });
  else cy.zoom(zoom);
}
