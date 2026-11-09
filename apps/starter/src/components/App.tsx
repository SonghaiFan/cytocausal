"use client";
import { autoLayout, layouts, type CausalStyleOptions } from "@cytocausal/cytoscape";
import { CausalWorkspace } from "@cytocausal/react";
import { dataset } from "@/data";

// Links get thicker the more people stated them. Defined here, so it's the same on each render
const styleOptions: CausalStyleOptions = { weightBySupport: true };

// Layouts people can switch between. Any of `layouts`, or any Cytoscape layout, works here
const layoutChoices = { force: autoLayout, flow: layouts.dagre, hubs: layouts.concentric };

export function App() {
  return (
    <CausalWorkspace
      dataset={dataset}
      title="cytocausal starter"
      styleOptions={styleOptions}
      layouts={layoutChoices}
    />
  );
}
