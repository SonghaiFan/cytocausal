"use client";
import type { CausalDataset, CausalNode } from "@cytocausal/core";
import { layouts, type Positions } from "@cytocausal/cytoscape";
import { CompareView, GraphView } from "@cytocausal/react";
import { useRef, useState } from "react";
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
            <GraphView key="single" {...shared} snapshotId={version} animateSnapshots />
          ) : (
            <CompareView key="compare" {...shared} left={LEFT} right={RIGHT} />
          )}
        </div>
      </div>
      <Sidebar
        debug={debug}
        datasetIds={datasets.map(({ id }) => id)}
        datasetId={selected.id}
        onDatasetChange={(id) => setSelected(datasets.find((dataset) => dataset.id === id)!)}
        layoutNames={Object.keys(layouts)}
        layoutName={layoutName}
        onLayoutChange={(name) => setLayoutName(name as keyof typeof layouts)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        versions={selected.snapshots.map(({ id }) => id)}
        version={version}
        onVersionChange={setVersion}
        terms={selected.snapshots.find(({ id }) => id === listed)!.nodes}
      />
    </main>
  );
}
