import cytoscape, {
  type EdgeSingular,
  type LayoutOptions,
  type NodeCollection,
  type NodeSingular,
} from "cytoscape";
import cola from "cytoscape-cola";
import dagre from "cytoscape-dagre";
import fcose from "cytoscape-fcose";

cytoscape.use(cola);
cytoscape.use(dagre);
cytoscape.use(fcose);

/** How much room a node takes up: its larger side, counting padding and border. */
const reach = (node: NodeSingular) => Math.max(node.outerWidth(), node.outerHeight());

/**
 * A link's ideal length: enough to clear both nodes, plus a gap. Fixed lengths suit one node
 * size only: pills holding long labels are several times wider than dots, and would be packed
 * into each other.
 */
const linkLength = (gap: number) => (edge: EdgeSingular) =>
  (reach(edge.source()) + reach(edge.target())) / 2 + gap;

/** Repulsion that grows with a node's size, so big nodes push others further away. */
const repulsion = (base: number) => (node: NodeSingular) => base * Math.max(1, reach(node) / 40);

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
  edgeLength: linkLength(30),
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
  nodeRepulsion: repulsion(14500),
  idealEdgeLength: linkLength(30),
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

/** How central a node is: its `score` data when it has one, such as betweenness, or its degree. */
const importance = (node: NodeSingular) => {
  const score = node.data("score");
  return typeof score === "number" ? score : node.degree(false);
};

/** Causes flow into effects from left to right, with loops broken where they must be. */
export const dagreLayout = {
  name: "dagre",
  rankDir: "LR",
  nodeSep: 20,
  rankSep: 70,
  edgeSep: 10,
  ranker: "network-simplex",
  fit: true,
  padding: 30,
} as LayoutOptions;

/** Trees grown from the nodes nothing causes, with each step further from them. */
export const breadthfirstLayout = {
  name: "breadthfirst",
  directed: true,
  avoidOverlap: true,
  spacingFactor: 1,
  fit: true,
  padding: 30,
} as LayoutOptions;

/** Rings, with the most central nodes in the middle. */
export const concentricLayout = {
  name: "concentric",
  concentric: importance,
  // Four rings over the range of values, as Cytoscape's default does for degree
  levelWidth: (nodes: NodeCollection) => Math.max(...nodes.map(importance)) / 4 || 1,
  // Room between rings for links to pass, rather than through the nodes in between
  minNodeSpacing: 40,
  startAngle: (3 / 2) * Math.PI,
  avoidOverlap: true,
  fit: true,
  padding: 30,
} as LayoutOptions;

/** Cytoscape's built-in force layout. fcose is usually better and faster. */
export const coseLayout = {
  name: "cose",
  randomize: false,
  idealEdgeLength: linkLength(30),
  nodeRepulsion: repulsion(8000),
  nodeOverlap: 8,
  componentSpacing: 60,
  fit: true,
  padding: 30,
} as LayoutOptions;

/** One circle, ordered by how central each node is. */
export const circleLayout = {
  name: "circle",
  avoidOverlap: true,
  sort: (a: NodeSingular, b: NodeSingular) => importance(b) - importance(a),
  fit: true,
  padding: 30,
} as LayoutOptions;

/** A grid, ordered by how central each node is. */
export const gridLayout = {
  name: "grid",
  avoidOverlap: true,
  condense: true,
  sort: (a: NodeSingular, b: NodeSingular) => importance(b) - importance(a),
  fit: true,
  padding: 30,
} as LayoutOptions;

export const randomLayout = { name: "random", fit: true, padding: 30 } as LayoutOptions;

/**
 * Every layout Cytoscape ships, and the extensions this package registers, set up for causal
 * graphs. Pass any of them, or any other Cytoscape layout, as `layout`, or several as `layouts`
 * to let people choose. For another extension, register it with `cytoscape.use` first.
 */
export const layouts = {
  fcose: fcoseLayout,
  cola: colaLayout,
  dagre: dagreLayout,
  breadthfirst: breadthfirstLayout,
  concentric: concentricLayout,
  cose: coseLayout,
  circle: circleLayout,
  grid: gridLayout,
  random: randomLayout,
};

export type LayoutName = keyof typeof layouts;

/** Lays out any small graph with no coordinates to write. Random starts keep cycles open. */
export const autoLayout = {
  ...fcoseLayout,
  randomize: true,
  padding: 30,
  idealEdgeLength: linkLength(50),
} as LayoutOptions;

/** Uses the positions already on each node. */
export const savedLayout = { name: "preset", fit: true, padding: 30 } as LayoutOptions;
