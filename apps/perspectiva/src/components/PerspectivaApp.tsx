"use client";
import { findFeedbackLoops, type CausalDataset, type CausalNode, type FeedbackLoop } from "@cytocausal/core";
import { highlightLoop, layouts, type Positions } from "@cytocausal/cytoscape";
import { CompareView, GraphView } from "@cytocausal/react";
import type { Core } from "cytoscape";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import datasetsJson from "../../data/datasets.json";
import { LoopPanel } from "@/components/LoopPanel";
import { NodeTooltip } from "@/components/NodeTooltip";
import { Sidebar, type ViewMode } from "@/components/Sidebar";
import { graphStyles } from "@/graph-style";

const datasets = datasetsJson as CausalDataset[];
const LEFT = "V1";
const RIGHT = "final";
const SINGLE = "single";
const graphFrame = "bg-gray-100 border border-gray-300";
const renderTooltip = (node: CausalNode) => <NodeTooltip node={node} />;

export function PerspectivaApp({ datasetId, debug }: { datasetId?: string; debug: boolean }) {
  const [selected, setSelected] = useState(
    datasets.find(({ id }) => id === datasetId) ?? datasets[0],
  );
  const [layoutName, setLayoutName] = useState<keyof typeof layouts>("fcose");
  const [viewMode, setViewMode] = useState<ViewMode>("2 Graphs");
  const [version, setVersion] = useState(LEFT);
  const [activeLoop, setActiveLoop] = useState<{ snapshotId: string; loop: FeedbackLoop } | null>(
    null,
  );
  const positionCache = useRef<Record<string, Positions>>({});
  const graphs = useRef(new Map<string, Core>());

  const shownVersions = viewMode === "1 Graph" ? [version] : [LEFT, RIGHT];
  const loopGroups = useMemo(
    () =>
      shownVersions.map((snapshotId) => {
        const snapshot = selected.snapshots.find(({ id }) => id === snapshotId)!;
        return { snapshot, loops: findFeedbackLoops(snapshot).loops };
      }),
    // The array is rebuilt on each render, but only these decide its contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, viewMode, version],
  );

  const onGraphReady = useCallback((cy: Core, snapshotId: string) => {
    graphs.current.set(snapshotId, cy);
  }, []);

  useEffect(() => {
    for (const [snapshotId, cy] of graphs.current) {
      if (cy.destroyed()) continue;
      const shown = snapshotId === SINGLE ? version : snapshotId;
      highlightLoop(cy, activeLoop?.snapshotId === shown ? activeLoop.loop : null);
    }
  }, [activeLoop, version]);

  // A highlighted loop belongs to what was on screen when it was chosen
  const clearing =
    <T,>(update: (value: T) => void) =>
    (value: T) => {
      setActiveLoop(null);
      update(value);
    };

  const shared = {
    dataset: selected,
    layout: layouts[layoutName],
    stylesheet: graphStyles,
    positionCache,
    renderTooltip,
    className: graphFrame,
  };
  const listed = viewMode === "1 Graph" ? version : LEFT;

  return (
    <main className="flex w-screen h-screen overflow-hidden">
      <div className="flex flex-grow flex-col p-4 min-w-0">
        <div className="mb-4 bg-yellow-400 rounded-md p-3">
          <h2 className="text-xl text-center">
            <span className="text-4xl font-mono font-bold py-1 px-4">Perspectiva</span>
            <span className="text-2xl">Causal Loop Diagram</span>
          </h2>
        </div>
        <div className="flex-grow min-h-0">
          {viewMode === "1 Graph" ? (
            <GraphView
              key="single"
              {...shared}
              snapshotId={version}
              animateSnapshots
              onReady={(cy) => onGraphReady(cy, SINGLE)}
            />
          ) : (
            <CompareView
              key="compare"
              {...shared}
              left={LEFT}
              right={RIGHT}
              onReady={onGraphReady}
            />
          )}
        </div>
      </div>
      <Sidebar
        debug={debug}
        datasetIds={datasets.map(({ id }) => id)}
        datasetId={selected.id}
        onDatasetChange={clearing((id: string) =>
          setSelected(datasets.find((dataset) => dataset.id === id)!),
        )}
        layoutNames={Object.keys(layouts)}
        layoutName={layoutName}
        onLayoutChange={clearing((name: string) => setLayoutName(name as keyof typeof layouts))}
        viewMode={viewMode}
        onViewModeChange={clearing(setViewMode)}
        versions={selected.snapshots.map(({ id }) => id)}
        version={version}
        onVersionChange={clearing(setVersion)}
        terms={selected.snapshots.find(({ id }) => id === listed)!.nodes}
      >
        <LoopPanel
          groups={loopGroups}
          active={activeLoop}
          onToggle={(snapshotId, loop) =>
            setActiveLoop(activeLoop?.loop === loop ? null : { snapshotId, loop })
          }
        />
      </Sidebar>
    </main>
  );
}
