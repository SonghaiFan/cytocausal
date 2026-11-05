"use client";
import { findFeedbackLoops, validateDataset, type CausalNode, type FeedbackLoop } from "@cytocausal/core";
import {
  fcoseLayout,
  focusNode,
  highlightCausalNeighbours,
  highlightLoop,
  type Positions,
} from "@cytocausal/cytoscape";
import {
  CausalRoot,
  GraphView,
  NodeSearch,
  themeForScheme,
  useColorScheme,
} from "@cytocausal/react";
import type { Core, LayoutOptions } from "cytoscape";
import { useEffect, useMemo, useRef, useState } from "react";
import { dataset } from "@/data";
import { styles } from "@/graph-style";

// Random starting positions and long links suit small graphs. Any data gets laid out
// automatically, so there are no coordinates to write.
const layout = {
  ...fcoseLayout,
  randomize: true,
  padding: 100,
  idealEdgeLength: () => 180,
} as LayoutOptions;

const renderTooltip = (node: CausalNode) => (
  <div className="tooltip">
    <strong>{node.label}</strong>
    {node.evidence?.map(({ text }) => <p key={text}>{text}</p>)}
  </div>
);

export function App() {
  const { scheme, setScheme } = useColorScheme();
  const theme = themeForScheme(scheme);
  const [version, setVersion] = useState("V1");
  const [activeLoop, setActiveLoop] = useState<FeedbackLoop | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const cy = useRef<Core | null>(null);
  const positionCache = useRef<Record<string, Positions>>({});

  const snapshot = dataset.snapshots.find(({ id }) => id === version)!;
  const { loops } = useMemo(() => findFeedbackLoops(snapshot), [snapshot]);
  const labelOf = (id: string) => snapshot.nodes.find((node) => node.id === id)!.label;
  const issues = useMemo(() => validateDataset(dataset), []);

  useEffect(() => {
    if (!cy.current) return;
    if (activeLoop) {
      highlightCausalNeighbours(cy.current, []);
      highlightLoop(cy.current, activeLoop);
    } else {
      highlightLoop(cy.current, null);
      highlightCausalNeighbours(cy.current, selected ? [selected] : []);
    }
  }, [activeLoop, selected]);

  return (
    <CausalRoot theme={theme}>
      <main>
        <div className="graph">
          <GraphView
            dataset={dataset}
            snapshotId={version}
            layout={layout}
            stylesheet={styles[scheme]}
            motion={theme.motion}
            maxZoom={1.8}
            positionCache={positionCache}
            animateSnapshots
            renderTooltip={renderTooltip}
            onReady={(instance) => {
              cy.current = instance;
              instance.on("tap", (event) => {
                if (event.target === instance) setSelected(null);
              });
            }}
          />
        </div>

        <aside>
          <div className="header">
            <h1>cytocausal starter</h1>
            <button type="button" onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}>
              {scheme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
          {issues.length > 0 && <pre role="alert">{issues.join("\n")}</pre>}

          <NodeSearch
            nodes={snapshot.nodes}
            onSelect={(id) => {
              setActiveLoop(null);
              setSelected(id);
              if (cy.current) {
                focusNode(cy.current, id, { zoom: cy.current.zoom(), motion: theme.motion });
              }
            }}
          />

          <h2>Version</h2>
          <div className="versions">
            {dataset.snapshots.map(({ id }) => (
              <button
                key={id}
                type="button"
                aria-pressed={version === id}
                onClick={() => {
                  setActiveLoop(null);
                  setSelected(null);
                  setVersion(id);
                }}
              >
                {id}
              </button>
            ))}
          </div>

          <h2>Feedback loops ({loops.length})</h2>
          <ul>
            {loops.map((loop) => (
              <li key={loop.edges.join()}>
                <button
                  type="button"
                  className="loop"
                  aria-pressed={activeLoop === loop}
                  onClick={() => {
                    setSelected(null);
                    setActiveLoop(activeLoop === loop ? null : loop);
                  }}
                >
                  {loop.type}: {[...loop.nodes, loop.nodes[0]].map(labelOf).join(" → ")}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </CausalRoot>
  );
}
