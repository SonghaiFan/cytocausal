import type { Core, LayoutOptions, ElementDefinition } from "cytoscape";

export const WORKER_LAYOUT_THRESHOLD = 50;
export interface LayoutJob {
  elements: ElementDefinition[];
  options: Record<string, unknown>;
  callbacks: Record<string, Record<string, number>>;
  levelWidth?: number;
  center: { x: number; y: number };
}

/** Evaluate per-element sizing functions once; never stringify executable code. */
export function layoutJob(cy: Core, layout: LayoutOptions): LayoutJob {
  const nodes = cy.nodes(":visible");
  const elements = cy.elements(":visible");
  const options: Record<string, unknown> = {};
  const callbacks: LayoutJob["callbacks"] = {};
  let levelWidth: number | undefined;
  const nodeOptions = new Set(["nodeRepulsion", "nodeSpacing", "concentric"]);
  const edgeOptions = new Set(["idealEdgeLength", "edgeLength", "edgeElasticity"]);
  for (const [key, value] of Object.entries(layout)) {
    if (["ready", "stop", "animate", "fit", "animationDuration", "animationEasing", "animateFilter"].includes(key)) continue;
    if (typeof value !== "function") { options[key] = value; continue; }
    if (key === "levelWidth") { levelWidth = value(nodes); continue; }
    if (key === "sort") {
      const sorted = nodes.toArray().sort(value);
      callbacks.sort = Object.fromEntries(sorted.map((node, index) => [node.id(), index]));
    } else if (nodeOptions.has(key) || edgeOptions.has(key)) {
      const collection = nodeOptions.has(key) ? nodes : elements.edges();
      callbacks[key] = Object.fromEntries(collection.map(ele => [ele.id(), value(ele)]));
    } else {
      throw new Error(`Layout option '${key}' is not supported in a worker.`);
    }
  }
  const box = nodes.boundingBox({ includeLabels: false });
  return {
    options: { ...options, boundingBox: options.boundingBox ?? { x1: 0, y1: 0, w: cy.width(), h: cy.height() } },
    callbacks, levelWidth,
    center: { x: (box.x1 + box.x2) / 2 || 0, y: (box.y1 + box.y2) / 2 || 0 },
    elements: elements.map(ele => ({
      group: ele.isNode() ? "nodes" : "edges",
      data: { ...ele.data(), ...(ele.isNode() ? { __layoutWidth: ele.outerWidth(), __layoutHeight: ele.outerHeight() } : {}) },
      ...(ele.isNode() ? { position: { ...ele.position() } } : {}),
    })),
  };
}

/** A dedicated worker per request makes even synchronous algorithms cancellable. */
export function startLayoutWorker(job: LayoutJob) {
  const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
  let rejectJob: (error: Error) => void = () => {};
  const promise = new Promise<Record<string, { x: number; y: number }>>((resolve, reject) => {
    rejectJob = reject;
    const fail = (message: string) => { worker.terminate(); reject(new Error(message)); };
    worker.onerror = event => { event.preventDefault(); fail(event.message || "Layout worker failed."); };
    worker.onmessageerror = () => fail("Layout worker returned an unreadable result.");
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error)); else resolve(data.positions);
    };
    try { worker.postMessage(job); } catch (error) { fail(String(error)); }
  });
  return { promise, cancel: () => { worker.terminate(); rejectJob(new Error("Layout cancelled")); } };
}
