import type { Core } from "cytoscape";

/** Label sizes in screen pixels, which `keepLabelsReadable` places with. */
export const LABEL = { fontSize: 12, outline: 2, gap: 3, maxWidth: 160 };

const SCRATCH_KEY = "cytocausal-constant-size";

/**
 * Writes what styles need at the current zoom: `zoomScale`, 1/zoom, which `spread` styles map
 * sizes from, and `zoomRoot`, 1/√zoom, for `balanced` ones. Also each managed label's size,
 * outline and gap from its node, which stay constant on screen.
 */
export function writeZoomSizes(cy: Core) {
  if (cy.destroyed()) return;
  const scale = 1 / cy.zoom();
  cy.batch(() => {
    cy.elements().data({ zoomScale: scale, zoomRoot: Math.sqrt(scale) });
    cy.nodes().data({
      labelSize: LABEL.fontSize * scale,
      labelWidth: LABEL.maxWidth * scale,
      labelOutline: LABEL.outline * scale,
    });
    cy.nodes(".labelled").forEach((node) => {
      node.data({
        labelMarginX: (node.data("labelSideX") ?? 0) * LABEL.gap * scale,
        labelMarginY: (node.data("labelSideY") ?? 0) * LABEL.gap * scale,
      });
    });
  });
}

/**
 * Keeps marks styled with `zoom: "spread"` or `"balanced"` sized for the zoom, by updating them
 * on every zoom step rather than once zooming stops, so nothing swells and then snaps back.
 * Elements added later, such as in a version change, pick up the current zoom too. Safe to call
 * twice.
 */
export function keepConstantSize(cy: Core) {
  if (cy.scratch(SCRATCH_KEY)) return;
  cy.scratch(SCRATCH_KEY, true);
  cy.on("zoom", () => writeZoomSizes(cy));
  cy.on("add", (event) => {
    const scale = 1 / cy.zoom();
    event.target.data({ zoomScale: scale, zoomRoot: Math.sqrt(scale) });
  });
  writeZoomSizes(cy);
}
