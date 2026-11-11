"use client";
import { followNodes, type CausalDataset } from "@cytocausal/core";
import {
  alignPositions,
  autoLayout,
  syncViews,
  type Positions,
} from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphView, type GraphViewProps } from "./GraphView.tsx";

type SharedProps = Pick<
  GraphViewProps,
  | "layout"
  | "stylesheet"
  | "motion"
  | "maxZoom"
  | "positionCache"
  | "renderTooltip"
  | "renderLinkTooltip"
  | "className"
>;

/** Shows two snapshots side by side, with matching nodes in the same place. */
export function CompareView({
  dataset,
  left,
  right,
  onReady,
  layout = autoLayout,
  positionCache: sharedCache,
  format = (id) => id,
  sync = true,
  ...others
}: SharedProps & {
  /**
   * Move both graphs together: panning or zooming one moves the other, and dragging a node
   * moves its counterpart. On by default.
   */
  sync?: boolean;
  /** Turns a snapshot id into the label above its graph. */
  format?: (snapshotId: string) => string;
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
        ? alignPositions(baseline.positions, followNodes(dataset, left, right))
        : undefined,
    [baseline, baselineKey, dataset, left, right],
  );

  // Each pane can rebuild its graph, such as for a new layout, so syncing restarts with it
  const graphs = useRef<{ left: Core | null; right: Core | null; stop: (() => void) | null }>({
    left: null,
    right: null,
    stop: null,
  });
  const connect = useCallback(() => {
    const current = graphs.current;
    current.stop?.();
    current.stop = null;
    if (!sync || !current.left || !current.right) return;
    if (current.left.destroyed() || current.right.destroyed()) return;
    current.stop = syncViews(current.left, current.right, {
      counterparts: followNodes(dataset, left, right),
      reverse: followNodes(dataset, right, left),
    });
  }, [sync, dataset, left, right]);
  useEffect(() => {
    connect();
    return () => graphs.current.stop?.();
  }, [connect]);

  const ready = (side: "left" | "right", snapshotId: string) => (cy: Core) => {
    graphs.current[side] = cy;
    connect();
    onReady?.(cy, snapshotId);
  };

  return (
    <div className="cc-compare">
      <div className="cc-pane">
        <span className="cc-pane-label">{format(left)}</span>
        <GraphView
          {...shared}
          dataset={dataset}
          snapshotId={left}
          onLayoutComplete={onLayoutComplete}
          onReady={ready("left", left)}
        />
      </div>
      <div className="cc-pane">
        <span className="cc-pane-label">{format(right)}</span>
        <GraphView
          {...shared}
          dataset={dataset}
          snapshotId={right}
          waitForAnchors
          anchorPositions={anchorPositions}
          onReady={ready("right", right)}
        />
      </div>
    </div>
  );
}
