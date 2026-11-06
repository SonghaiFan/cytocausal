"use client";
import type { CausalDataset } from "@cytocausal/core";
import { alignPositions, autoLayout, getCounterparts, type Positions } from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";
import { useCallback, useMemo, useRef, useState } from "react";
import { GraphView, type GraphViewProps } from "./GraphView.tsx";

type SharedProps = Pick<
  GraphViewProps,
  "layout" | "stylesheet" | "motion" | "maxZoom" | "positionCache" | "renderTooltip" | "className"
>;

/** Shows two snapshots side by side, with matching nodes in the same place. */
export function CompareView({
  dataset,
  left,
  right,
  onReady,
  layout = autoLayout,
  positionCache: sharedCache,
  ...others
}: SharedProps & {
  dataset: CausalDataset;
  left: string;
  right: string;
  onReady?: (cy: Core, snapshotId: string) => void;
}) {
  const ownCache = useRef<Record<string, Positions>>({});
  const shared = { ...others, layout, positionCache: sharedCache ?? ownCache };
  const baselineKey = `${dataset.id}:${left}:${layout.name}`;
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
