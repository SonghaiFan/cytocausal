import type { CausalStyleOptions } from "@cytocausal/cytoscape";

/** Dots and straight links keep a graph this dense readable. Everything else is the default. */
export const styleOptions: CausalStyleOptions = {
  node: "dot",
  link: "straight",
  sizeByScore: true,
  managedLabels: true,
};
