"use client";
import { useState } from "react";
import { findCausalPaths, findFeedbackLoops, getSnapshot } from "@cytocausal/core";
import { dataset } from "./data.ts";

const snapshot = getSnapshot(dataset, "draft");

export default function AnalysisExample() {
  const [maxLength, setMaxLength] = useState(3);
  const loops = findFeedbackLoops(snapshot, { maxLength, limit: 20 });
  const paths = findCausalPaths(snapshot, "node:moisture", "node:use", { maxLength, limit: 20 });
  return (
    <div>
      <label>Maximum nodes per route: {maxLength}
        <input aria-label="Maximum nodes per route" type="range" min={2} max={4}
          value={maxLength} onChange={(event) => setMaxLength(Number(event.target.value))} />
      </label>
      <p role="status">{loops.loops.length} loops · {paths.paths.length} paths</p>
      <pre style={{ overflow: "auto" }}>{JSON.stringify({ loops, paths }, null, 2)}</pre>
    </div>
  );
}
