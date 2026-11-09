"use client";
import type { CausalStyleOptions } from "@cytocausal/cytoscape";
import { CausalWorkspace } from "@cytocausal/react";
import { dataset } from "@/data";

// Links get thicker the more people stated them. Defined here, so it's the same on each render
const styleOptions: CausalStyleOptions = { weightBySupport: true };

export function App() {
  return <CausalWorkspace dataset={dataset} title="cytocausal starter" styleOptions={styleOptions} />;
}
