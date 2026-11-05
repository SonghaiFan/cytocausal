"use client";
import type { CausalDataset, CausalNode } from "@cytocausal/core";
import type { Positions } from "@cytocausal/cytoscape";
import {
  CausalLabelsProvider,
  CausalRoot,
  GraphView,
  Legend,
  NodeDetails,
  NodeSearch,
  NodeTooltip,
  useCausalGraph,
  ZoomControls,
} from "@cytocausal/react";
import type { LayoutOptions } from "cytoscape";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { graphStyles, theme } from "@/graph-style";

const MAX_SELECTED = 2;
// The largest group of loops is too big to list, so panels show the shortest ones
const LOOP_SEARCH = { maxLength: 4, limit: 30 };
const savedLayout = { name: "preset", fit: true, padding: 30 } as LayoutOptions;

const labels = {
  search: "Search events and descriptions…",
  node: "Cluster",
  evidence: "Descriptions",
  loops: "Short feedback loops",
};

const renderTooltip = (node: CausalNode) => <NodeTooltip node={node} />;

export function ExplorerApp() {
  const [dataset, setDataset] = useState<CausalDataset | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_EXPLORER_DATA ?? "/dataset.json")
      .then((response) => response.json())
      .then(setDataset)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="p-4">The graph could not be loaded.</p>;
  if (!dataset) return <p className="p-4">Loading…</p>;
  return (
    <CausalLabelsProvider labels={labels}>
      <CausalRoot theme={theme}>
        <Explorer dataset={dataset} />
      </CausalRoot>
    </CausalLabelsProvider>
  );
}

function Explorer({ dataset }: { dataset: CausalDataset }) {
  const [{ nodes, edges }] = dataset.snapshots;
  const positionCache = useRef<Record<string, Positions>>({});
  const graph = useCausalGraph({
    maxSelected: MAX_SELECTED,
    readableLabels: true,
    focusZoom: 2,
    motion: theme.motion,
  });
  const { selected, keepSelected, fit, cy } = graph;
  const [loopsOnly, setLoopsOnly] = useState(false);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const inScope = useCallback(
    (node: CausalNode) => !loopsOnly || Boolean(node.metadata?.inFeedbackLoop),
    [loopsOnly],
  );
  const visibleNodes = useMemo(() => nodes.filter(inScope), [nodes, inScope]);
  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map(({ id }) => id));
    return edges.filter(({ source, target }) => ids.has(source) && ids.has(target));
  }, [edges, visibleNodes]);

  useEffect(() => {
    const instance = cy.current;
    if (!instance) return;
    instance.batch(() => {
      instance.nodes().removeClass("outside-loops");
      if (loopsOnly) {
        instance.nodes().filter((node) => !node.data("inFeedbackLoop")).addClass("outside-loops");
      }
    });
    fit();
    keepSelected((id) => inScope(nodeById.get(id)!));
  }, [loopsOnly, inScope, nodeById, cy, fit, keepSelected]);

  return (
    <main className="flex flex-col md:flex-row w-screen h-screen overflow-hidden">
      <div className="relative flex-1 min-h-[55vh] min-w-0">
        <GraphView
          dataset={dataset}
          snapshotId="final"
          layout={savedLayout}
          stylesheet={graphStyles}
          positionCache={positionCache}
          maxZoom={10}
          onReady={graph.attach}
          renderTooltip={renderTooltip}
        />
        <header className="absolute top-2 left-2 flex items-center gap-3 pointer-events-none bg-white/85 rounded p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/monash.png" alt="Monash University" className="w-12 h-12" />
          <div>
            <h1 className="font-serif text-xl md:text-2xl">Causal Discovery for Event Flows Playground</h1>
            <p className="font-serif italic" role="status">
              {visibleNodes.length} nodes, {visibleEdges.length} edges
            </p>
          </div>
        </header>
        <ZoomControls graph={graph} />
        <p role="status" className="cc-sr-only">
          {graph.announcement}
        </p>
      </div>

      <aside className="w-full md:w-96 shrink-0 h-[45vh] md:h-full overflow-auto bg-gray-50 border-l p-3 space-y-3">
        <NodeSearch nodes={visibleNodes} onSelect={graph.focus} />

        <section className="cc-panel space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={loopsOnly}
              onChange={(event) => setLoopsOnly(event.target.checked)}
            />
            Show only feedback loops
          </label>
        </section>

        <Legend />

        {selected.map((id) => (
          <NodeDetails
            key={id}
            snapshot={dataset.snapshots[0]}
            nodeId={id}
            loopOptions={LOOP_SEARCH}
            activeLoop={graph.activeLoop}
            onToggleLoop={graph.toggleLoop}
            onSelect={graph.focus}
            onClose={() => graph.toggle(id)}
          />
        ))}

        <details className="cc-panel" open={selected.length === 0}>
          <summary className="font-semibold cursor-pointer">Description</summary>
          <p className="mt-2">
            This map shows the causal graph from the{" "}
            <a className="underline" href="https://arxiv.org/abs/2502.08148">
              ACCESS benchmark
            </a>
            , built on{" "}
            <a className="underline" href="https://arxiv.org/abs/2009.07758">
              GLUCOSE
            </a>
            . Each node is an abstract event, and each edge a causal relation judged by annotators.
          </p>
          {dataset.id === "access-sample" && (
            <p className="mt-2">
              This is a sample of the most central events, with up to five descriptions each. The full
              benchmark is{" "}
              <a className="underline" href="https://github.com/isVy08/ACCESS">
                available on request
              </a>
              .
            </p>
          )}
          <p className="mt-2">
            Node size shows directed betweenness centrality: bigger nodes sit on more of the causal
            paths through the network. Click a node to read its descriptions, and click a second node to
            compare them.
          </p>
        </details>
      </aside>
    </main>
  );
}
