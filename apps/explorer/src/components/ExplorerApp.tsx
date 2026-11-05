"use client";
import {
  findFeedbackLoops,
  type CausalDataset,
  type CausalNode,
  type LoopSearch,
} from "@cytocausal/core";
import type { Positions } from "@cytocausal/cytoscape";
import { GraphView, NodeSearch, useCausalGraph } from "@cytocausal/react";
import type { LayoutOptions } from "cytoscape";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodePanel } from "@/components/NodePanel";
import { CAUSE_COLOR, EFFECT_COLOR, graphStyles, theme } from "@/graph-style";

const MAX_SELECTED = 2;
// The largest group of loops is too big to list, so panels show the shortest ones
const LOOP_SEARCH = { maxLength: 4, limit: 30 };
const savedLayout = { name: "preset", fit: true, padding: 30 } as LayoutOptions;

const renderTooltip = (node: CausalNode) => (
  <div className="bg-white border rounded shadow px-3 py-2 text-sm max-w-sm">
    <p className="text-xs text-gray-500">{node.id}</p>
    <p className="font-semibold">{node.label}</p>
    <ul className="text-gray-600">
      {node.evidence?.slice(0, 3).map(({ text }, index) => <li key={index}>{text}</li>)}
    </ul>
    {(node.evidence?.length ?? 0) > 3 && (
      <p className="text-xs text-gray-500 mt-1">Click to see all {node.evidence!.length}</p>
    )}
  </div>
);

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
  return <Explorer dataset={dataset} />;
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
  const links = useMemo(() => {
    const causes = new Map<string, CausalNode[]>();
    const effects = new Map<string, CausalNode[]>();
    for (const { source, target } of edges) {
      if (!causes.has(target)) causes.set(target, []);
      if (!effects.has(source)) effects.set(source, []);
      causes.get(target)!.push(nodeById.get(source)!);
      effects.get(source)!.push(nodeById.get(target)!);
    }
    return { causes, effects };
  }, [edges, nodeById]);

  const loopsThrough = useMemo(() => {
    const searches = new Map<string, LoopSearch>();
    for (const id of selected) {
      searches.set(id, findFeedbackLoops(dataset.snapshots[0], { ...LOOP_SEARCH, through: id }));
    }
    return searches;
  }, [dataset, selected]);

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

  const control = "w-9 h-9 bg-white border rounded shadow hover:bg-gray-100";

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
        <div className="absolute bottom-3 left-3 flex flex-col gap-2">
          <button type="button" aria-label="Zoom in" className={control} onClick={graph.zoomIn}>
            +
          </button>
          <button type="button" aria-label="Zoom out" className={control} onClick={graph.zoomOut}>
            −
          </button>
          <button
            type="button"
            aria-label="Fit graph"
            className={control}
            onClick={fit}
          >
            ⤢
          </button>
        </div>
      </div>

      <aside className="w-full md:w-96 shrink-0 h-[45vh] md:h-full overflow-auto bg-gray-50 border-l p-3 space-y-3">
        <NodeSearch
          nodes={visibleNodes}
          onSelect={graph.focus}
          placeholder="Search nodes and sentences…"
          className="bg-white border rounded-md shadow p-3"
        />

        <section className="bg-white border rounded-md shadow p-3 text-sm space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={loopsOnly}
              onChange={(event) => setLoopsOnly(event.target.checked)}
            />
            Show only feedback loops
          </label>
          <div className="flex gap-4">
            <span style={{ color: CAUSE_COLOR }}>● Causes</span>
            <span style={{ color: EFFECT_COLOR }}>● Effects</span>
          </div>
        </section>

        {selected.map((id) => (
          <NodePanel
            key={id}
            node={nodeById.get(id)!}
            causes={links.causes.get(id) ?? []}
            effects={links.effects.get(id) ?? []}
            loops={loopsThrough.get(id)!}
            labelOf={(nodeId) => nodeById.get(nodeId)!.label}
            activeLoop={graph.activeLoop}
            onToggleLoop={graph.toggleLoop}
            onSelect={graph.focus}
            onClose={() => graph.toggle(id)}
          />
        ))}

        <details className="bg-white border rounded-md shadow p-3 text-sm" open={selected.length === 0}>
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
            paths through the network. Click a node to read its sentences, and click a second node to
            compare them.
          </p>
        </details>
      </aside>
    </main>
  );
}
