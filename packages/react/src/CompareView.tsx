"use client";
import type { CausalDataset } from "@cytocausal/core";
import { alignPositions, getCounterparts, type Positions } from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";
import { useCallback, useMemo, useState } from "react";
import { GraphView, type GraphViewProps } from "./GraphView.tsx";

type SharedProps = Pick<
  GraphViewProps,
  "layout" | "stylesheet" | "positionCache" | "renderTooltip" | "className"
>;

/** Shows two snapshots side by side, with matching nodes in the same place. */
export function CompareView({
  dataset,
  left,
  right,
  onReady,
  ...shared
}: SharedProps & {
  dataset: CausalDataset;
  left: string;
  right: string;
  onReady?: (cy: Core, snapshotId: string) => void;
}) {
  const baselineKey = `${dataset.id}:${left}:${shared.layout.name}`;
  const [baseline, setBaseline] = useState<{ key: string; positions: Positions } | null>(null);

  const onLayoutComplete = useCallback(
    (positions: Positions) => setBaseline({ key: baselineKey, positions }),
    [baselineKey],
  );

  // Positions from another dataset or layout must never reach the right graph
  const anchorPositions = useMemo(
    () =>
      baseline?.key === baselineKey
        ? alignPositions(baseline.positions, getCounterparts(dataset, left, right))
        : undefined,
    [baseline, baselineKey, dataset, left, right],
  );

  const pane = { flex: 1, minWidth: 0, height: "100%" };
  return (
    <div style={{ display: "flex", gap: "1rem", width: "100%", height: "100%" }}>
      <div style={pane}>
        <GraphView
          {...shared}
          dataset={dataset}
          snapshotId={left}
          onLayoutComplete={onLayoutComplete}
          onReady={(cy) => onReady?.(cy, left)}
        />
      </div>
      <div style={pane}>
        <GraphView
          {...shared}
          dataset={dataset}
          snapshotId={right}
          waitForAnchors
          anchorPositions={anchorPositions}
          onReady={(cy) => onReady?.(cy, right)}
        />
      </div>
    </div>
  );
}
