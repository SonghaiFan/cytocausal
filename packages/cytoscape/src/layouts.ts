import cytoscape, { type LayoutOptions } from "cytoscape";
import cola from "cytoscape-cola";
import fcose from "cytoscape-fcose";

cytoscape.use(cola);
cytoscape.use(fcose);

export const colaLayout = {
  name: "cola",
  animate: true,
  refresh: 0.2,
  maxSimulationTime: 500,
  fit: true,
  padding: 30,
  randomize: false,
  avoidOverlap: true,
  handleDisconnected: true,
  convergenceThreshold: 0.01,
  nodeSpacing: () => 10,
  centerGraph: true,
} as LayoutOptions;

export const fcoseLayout = {
  name: "fcose",
  quality: "proof",
  randomize: false,
  animate: true,
  animationDuration: 1000,
  animationEasing: "ease-in-out",
  fit: true,
  padding: 30,
  packComponents: true,
  samplingType: true,
  sampleSize: 25,
  nodeSeparation: 75,
  piTol: 0.0000001,
  nodeRepulsion: () => 14500,
  idealEdgeLength: () => 50,
  edgeElasticity: () => 0.45,
  nestingFactor: 0.1,
  numIter: 2500,
  tile: true,
  tilingPaddingVertical: 10,
  tilingPaddingHorizontal: 10,
  gravity: 0.25,
  gravityRangeCompound: 1.5,
  gravityCompound: 1.0,
  gravityRange: 3.8,
  initialEnergyOnIncremental: 0.3,
} as LayoutOptions;

export const layouts = { cola: colaLayout, fcose: fcoseLayout };

/** Lays out any small graph with no coordinates to write. Random starts keep cycles open. */
export const autoLayout = {
  ...fcoseLayout,
  randomize: true,
  padding: 30,
  idealEdgeLength: () => 180,
} as LayoutOptions;

/** Uses the positions already on each node. */
export const savedLayout = { name: "preset", fit: true, padding: 30 } as LayoutOptions;
