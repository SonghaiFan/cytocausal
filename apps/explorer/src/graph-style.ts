import {
  concentricLayout,
  dagreLayout,
  fcoseLayout,
  savedLayout,
  type CausalStyleOptions,
  type ZoomMode,
} from "@cytocausal/cytoscape";
import type { LayoutOptions } from "cytoscape";

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

/**
 * Ways to lay the sample out. `original` keeps the positions from the source data, which were
 * worked out for the full benchmark. `force` refines them for the nodes shown, `centrality` puts
 * the most central events in the middle, and `flow` runs causes into effects from left to right.
 */
export const layoutChoices: Record<LayoutChoice, LayoutOptions> = {
  original: savedLayout,
  force: fcoseLayout,
  centrality: concentricLayout,
  flow: dagreLayout,
};

export type LayoutChoice = "original" | "force" | "centrality" | "flow";

export const LAYOUT_NAMES: Record<string, string> = {
  original: "Original",
  force: "Force",
  centrality: "By centrality",
  flow: "Flow",
};
