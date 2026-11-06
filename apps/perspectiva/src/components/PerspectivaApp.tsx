"use client";
import { findFeedbackLoops, type CausalDataset, type CausalNode } from "@cytocausal/core";
import { layouts, type Positions } from "@cytocausal/cytoscape";
import type { Route } from "@cytocausal/cytoscape";
import { CompareView, GraphView, LoopList, useCausalGraph, VersionDiff } from "@cytocausal/react";
import { useMemo, useRef, useState } from "react";
import datasetsJson from "../../data/datasets.json";
import { NodeTooltip } from "@/components/NodeTooltip";
import { Sidebar, type ViewMode } from "@/components/Sidebar";
import { graphStyles } from "@/graph-style";

const datasets = datasetsJson as CausalDataset[];
const LEFT = "V1";
const RIGHT = "final";
const graphFrame = "bg-gray-100 border border-gray-300";
const renderTooltip = (node: CausalNode) => <NodeTooltip node={node} />;

export function PerspectivaApp({ datasetId, debug }: { datasetId?: string; debug: boolean }) {
  const [selected, setSelected] = useState(
    datasets.find(({ id }) => id === datasetId) ?? datasets[0],
  );
  const [layoutName, setLayoutName] = useState<keyof typeof layouts>("fcose");
  const [viewMode, setViewMode] = useState<ViewMode>("2 Graphs");
  const [version, setVersion] = useState(LEFT);
  const positionCache = useRef<Record<string, Positions>>({});
  // Clicking a node here shows its details rather than selecting it
  const main = useCausalGraph({ selectable: false });
  const right = useCausalGraph({ selectable: false });

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

  const toggleLoop = (snapshotId: string, route: Route) => {
    const [target, other] =
      viewMode === "2 Graphs" && snapshotId === RIGHT ? [right, main] : [main, right];
    other.clear();
    target.toggleRoute(route);
  };

  // A highlighted loop belongs to what was on screen when it was chosen
  const clearing =
    <T,>(update: (value: T) => void) =>
    (value: T) => {
      main.clear();
      right.clear();
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
              onReady={main.attach}
            />
          ) : (
            <CompareView
              key="compare"
              {...shared}
              left={LEFT}
              right={RIGHT}
              onReady={(cy, snapshotId) => (snapshotId === LEFT ? main : right).attach(cy)}
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
        {loopGroups.map(({ snapshot, loops }) => (
          <LoopList
            key={snapshot.id}
            className="mb-8 shadow-lg"
            title={loopGroups.length > 1 ? `Feedback loops: ${snapshot.id}` : undefined}
            snapshot={snapshot}
            loops={loops}
            active={main.activeRoute ?? right.activeRoute}
            onToggle={(loop) => toggleLoop(snapshot.id, loop)}
          />
        ))}
        <VersionDiff className="mb-8 shadow-lg" dataset={selected} from={LEFT} to={RIGHT} />
      </Sidebar>
    </main>
  );
}
