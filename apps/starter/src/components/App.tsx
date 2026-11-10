"use client";
import { autoLayout, layouts, type CausalStyleOptions } from "@cytocausal/cytoscape";
import { CausalWorkspace } from "@cytocausal/react";
import { useState } from "react";
import { dataset } from "@/data";

// Links get thicker the more people stated them. Defined here, so it's the same on each render
const styleOptions: CausalStyleOptions = { weightBySupport: true };

// Layouts people can switch between. Any of `layouts`, or any Cytoscape layout, works here
const loopSettings = { title: "Coffee shop cycles", description: "Reinforcing and balancing cycles in the coffee shop model.", maxLength: Infinity, limit: 1000 };
const labels = { loops: "Coffee shop cycles", noLoops: "No coffee shop cycles found within this range" };

const layoutChoices = { force: autoLayout, flow: layouts.dagre, hubs: layouts.concentric };

export function App() {
  // Add ?debug=directions to the address to see the area around a selected node that leads to
  // each linked node
  const [showDirections] = useState(() => new URLSearchParams(window.location.search).get("debug") === "directions");
  return (
    <CausalWorkspace
      showDirections={showDirections}
      dataset={dataset}
      labels={labels}
      loopSettings={loopSettings}
      title="cytocausal starter"
      styleOptions={styleOptions}
      layouts={layoutChoices}
    />
  );
}
