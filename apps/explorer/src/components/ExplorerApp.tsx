"use client";
import type { CausalDataset, CausalNode } from "@cytocausal/core";
import { refreshLabels, relayout } from "@cytocausal/cytoscape";
import type { LayoutOptions } from "cytoscape";
import {
  CausalGraph,
  CausalProvider,
  DepthControl,
  Legend,
  LayoutSwitcher,
  NodeSearch,
  Segmented,
  SelectionPanel,
  SidebarHeader,
  useCausal,
  useCausalLabels,
} from "@cytocausal/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LAYOUT_NAMES, layoutChoices, styleOptions, ZOOM_MODES } from "@/graph-style";
import type { ZoomMode } from "@cytocausal/cytoscape";

// The largest group of loops is too big to list, so panels show the shortest ones
const LOOP_SEARCH = { maxLength: 4, limit: 30 };
const GRAPH_OPTIONS = { readableLabels: true, focusZoom: 2 };
const DOCS_URL = `${process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3200"}/en/case-explorer/`;

const labels = {
  search: "Search events and descriptions…",
  node: "Cluster",
  evidence: "Descriptions",
  loops: "Short feedback loops",
};

export function ExplorerApp() {
  const [dataset, setDataset] = useState<CausalDataset | null>(null);
  const [failed, setFailed] = useState(false);
  // How marks behave on zoom. Spread suits this dense a graph; the others are here to compare
  const [zoom, setZoom] = useState<ZoomMode>("spread");

  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_EXPLORER_DATA ?? "/dataset.json")
      .then((response) => response.json())
      .then(setDataset)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="p-4">The graph could not be loaded.</p>;
  if (!dataset) return <p className="p-4">Loading…</p>;
  return (
    <CausalProvider
      dataset={dataset}
      labels={labels}
      styleOptions={styleOptions[zoom]}
      layouts={layoutChoices}
      graphOptions={GRAPH_OPTIONS}
      shareInUrl
      className="cc-workspace h-screen"
    >
      <Explorer zoom={zoom} onZoomChange={setZoom} />
    </CausalProvider>
  );
}

const zoomName = (mode: ZoomMode) => mode.charAt(0).toUpperCase() + mode.slice(1);

const layoutName = (name: string) => LAYOUT_NAMES[name] ?? name;

function Explorer({ zoom, onZoomChange }: { zoom: ZoomMode; onZoomChange: (mode: ZoomMode) => void }) {
  const text = useCausalLabels();
  const { dataset, snapshot, graph, scheme, toggleScheme, exportImage, copyLink, copied, theme, layout } =
    useCausal();
  const { nodes, edges } = snapshot;
  const { keepSelected, fit, cy } = graph;
  const [loopsOnly, setLoopsOnly] = useState(false);
  // Read when the filter changes, not as a reason to run it
  const shownLayout = useRef<LayoutOptions>(layout);
  shownLayout.current = layout;
  const firstFilter = useRef(true);

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
    refreshLabels(instance);
    // A computed layout is worked out again for what's left, so the loops sit close together.
    // The original positions come from the data, so those only need fitting to the screen
    const current = shownLayout.current;
    if (!firstFilter.current && current.name !== "preset") {
      relayout(instance, current, { motion: theme.motion });
    } else {
      fit();
    }
    firstFilter.current = false;
    keepSelected((id) => inScope(nodeById.get(id)!));
  }, [loopsOnly, inScope, nodeById, cy, fit, keepSelected, theme]);

  return (
    <>
      <CausalGraph maxZoom={10}>
        <div className="cc-overlay cc-overlay-top">
          <label className="cc-check">
            <input
              type="checkbox"
              checked={loopsOnly}
              onChange={(event) => setLoopsOnly(event.target.checked)}
            />
            Show only feedback loops
          </label>
          <div className="cc-buttons">
            <LayoutSwitcher bare format={layoutName} />
            <Segmented
              label="Zoom"
              options={ZOOM_MODES}
              value={zoom}
              onChange={onZoomChange}
              format={zoomName}
            />
            <button type="button" className="cc-button" onClick={exportImage}>
              {text.exportImage}
            </button>
            {copyLink && (
              <button type="button" className="cc-button" onClick={copyLink}>
                {copied ? text.linkCopied : text.copyLink}
              </button>
            )}
          </div>
        </div>
        <div className="cc-overlay cc-overlay-bottom">
          <Legend bare />
          <DepthControl bare />
        </div>
      </CausalGraph>

      <aside className="cc-sidebar">
        <SidebarHeader
          title="Causal Explorer"
          subtitle={
            <span role="status">
              {visibleNodes.length} nodes, {visibleEdges.length} edges
            </span>
          }
          scheme={scheme}
          onToggleScheme={toggleScheme}
        >
          <a className="cc-link" href={DOCS_URL}>
            Docs
          </a>
        </SidebarHeader>

        <NodeSearch nodes={visibleNodes} />
        <SelectionPanel loopOptions={LOOP_SEARCH} />

        <details className="cc-panel cc-disclosure" open={graph.selected.length === 0}>
          <summary>About this graph</summary>
          <p>
            This map shows the causal graph from the{" "}
            <a href="https://arxiv.org/abs/2502.08148">ACCESS benchmark</a>, built on{" "}
            <a href="https://arxiv.org/abs/2009.07758">GLUCOSE</a>. Each node is an abstract event,
            and each edge a causal relation judged by annotators.
          </p>
          {dataset.id === "access-sample" && (
            <p>
              This is a sample of the most central events, with up to five descriptions each. The
              full benchmark is{" "}
              <a href="https://github.com/isVy08/ACCESS">available on request</a>.
            </p>
          )}
          <p>
            Node size shows directed betweenness centrality: bigger nodes sit on more of the causal
            paths through the network.
          </p>
        </details>
      </aside>
    </>
  );
}
