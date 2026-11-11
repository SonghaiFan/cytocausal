"use client";
import { CausalWorkspace } from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import { dataset } from "./data.ts";

export default function WorkspaceExample() {
  return <CausalWorkspace dataset={dataset} title="Garden model" shareInUrl={false} />;
}
