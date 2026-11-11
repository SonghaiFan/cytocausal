import cytoscape, { type Core, type Stylesheet, type LayoutOptions } from "cytoscape";
// Registers the same bundled layout extensions as the visible graph.
import "@cytocausal/cytoscape";
import type { LayoutJob } from "./layout-worker.ts";

self.onmessage = ({ data }: MessageEvent<LayoutJob>) => {
  let cy: Core | undefined;
  try {
    cy = cytoscape({ headless: true, styleEnabled: true, elements: data.elements,
      style: [{ selector: "node", style: { width: "data(__layoutWidth)", height: "data(__layoutHeight)", padding: 0, "border-width": 0 } }] as unknown as Stylesheet[],
      layout: { name: "preset" },
    });
    const options: Record<string, unknown> = { ...data.options, animate: false, fit: false };
    for (const [key, values] of Object.entries(data.callbacks)) {
      options[key] = key === "sort"
        ? (a: { id(): string }, b: { id(): string }) => values[a.id()] - values[b.id()]
        : (ele: { id(): string }) => values[ele.id()];
    }
    if (data.levelWidth !== undefined) options.levelWidth = () => data.levelWidth;
    const layout = cy.layout(options as unknown as LayoutOptions);
    layout.one("layoutstop", () => {
      const box = cy!.nodes().boundingBox({ includeLabels: false });
      const offset = data.options.fixedNodeConstraint ? { x: 0, y: 0 } : { x: data.center.x - (box.x1 + box.x2) / 2, y: data.center.y - (box.y1 + box.y2) / 2 };
      const positions = Object.fromEntries(cy!.nodes().map(node => {
        const p = node.position();
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error("Layout returned invalid positions.");
        return [node.id(), { x: p.x + offset.x, y: p.y + offset.y }];
      }));
      self.postMessage({ positions });
      cy!.destroy();
    });
    layout.run();
  } catch (error) {
    cy?.destroy();
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
