import type { Core } from "cytoscape";

/** Moves from the current frame, replacing any older camera destination. */
export function moveCamera(
  cy: Core,
  target: { zoom: number; pan: { x: number; y: number } },
  duration = 0,
  complete?: () => void,
) {
  if (cy.destroyed()) return;
  // Stop only the viewport animation; node layout and highlight animations continue.
  // Do not jump to the old endpoint before beginning the new movement.
  cy.stop(true, false);
  if (duration > 0) {
    cy.animate(target, { duration, easing: "ease-in-out-cubic", queue: false, complete });
  } else {
    cy.viewport(target);
    complete?.();
  }
}

/** Centres a model point at the requested zoom, with pan and zoom moving together. */
export function centerView(cy: Core, point: { x: number; y: number }, zoom = cy.zoom(), duration = 0) {
  zoom = Math.max(cy.minZoom(), Math.min(cy.maxZoom(), zoom));
  moveCamera(cy, {
    zoom,
    pan: { x: cy.width() / 2 - point.x * zoom, y: cy.height() / 2 - point.y * zoom },
  }, duration);
}

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
  /** Called once the view is there. */
  complete?: () => void,
) {
  if (![box.x1, box.x2, box.y1, box.y2, box.w, box.h].every(Number.isFinite)) {
    complete?.();
    return;
  }
  const padding = 30;
  const zoom = Math.max(cy.minZoom(), Math.min(
    Math.max(1, cy.width() - 2 * padding) / Math.max(1, box.w),
    Math.max(1, cy.height() - 2 * padding) / Math.max(1, box.h),
    cy.maxZoom(),
  ));
  const pan = {
    x: (cy.width() - zoom * (box.x1 + box.x2)) / 2,
    y: (cy.height() - zoom * (box.y1 + box.y2)) / 2,
  };
  moveCamera(cy, { zoom, pan }, duration, complete);
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
  const zoom = cy.zoom();
  const pan = cy.pan();
  const centre = { x: (cy.width() / 2 - pan.x) / zoom, y: (cy.height() / 2 - pan.y) / zoom };
  centerView(cy, centre, zoom * factor, duration);
}
