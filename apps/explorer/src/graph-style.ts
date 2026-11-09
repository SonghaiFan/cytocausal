import type { CausalStyleOptions, ZoomMode } from "@cytocausal/cytoscape";

export const ZOOM_MODES = ["spread", "balanced", "magnify"] as const satisfies readonly ZoomMode[];

/**
 * Dots and straight links keep a graph this dense readable. Everything else is the default. One
 * object per zoom mode, so the stylesheet only changes when the mode does.
 */
export const styleOptions = Object.fromEntries(
  ZOOM_MODES.map((zoom) => [
    zoom,
    { node: "dot", link: "straight", sizeByScore: true, managedLabels: true, zoom },
  ]),
) as Record<ZoomMode, CausalStyleOptions>;
