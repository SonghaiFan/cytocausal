"use client";
import { CausalGraph, CausalProvider, NodeSearch, SelectionPanel, LoopList } from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import { dataset } from "./data.ts";

export default function ComposeExample() {
  return (
    <CausalProvider dataset={dataset} className="cc-workspace">
      <CausalGraph />
      <aside className="cc-sidebar">
        <NodeSearch />
        <SelectionPanel />
        <LoopList />
      </aside>
    </CausalProvider>
  );
}
