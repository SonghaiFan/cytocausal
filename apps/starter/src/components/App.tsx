"use client";
import { CausalWorkspace } from "@cytocausal/react";
import { dataset } from "@/data";

export function App() {
  return <CausalWorkspace dataset={dataset} title="cytocausal starter" />;
}
