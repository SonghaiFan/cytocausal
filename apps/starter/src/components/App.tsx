"use client";
import { findFeedbackLoops, validateDataset, type CausalNode } from "@cytocausal/core";
import { fcoseLayout, type Positions } from "@cytocausal/cytoscape";
import {
  CausalRoot,
  GraphView,
  NodeSearch,
  themeForScheme,
  useCausalGraph,
  useColorScheme,
} from "@cytocausal/react";
import type { LayoutOptions } from "cytoscape";
import { useMemo, useRef, useState } from "react";
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
  const graph = useCausalGraph({ motion: theme.motion });
  const positionCache = useRef<Record<string, Positions>>({});

  const snapshot = dataset.snapshots.find(({ id }) => id === version)!;
  const { loops } = useMemo(() => findFeedbackLoops(snapshot), [snapshot]);
  const labelOf = (id: string) => snapshot.nodes.find((node) => node.id === id)!.label;
  const issues = useMemo(() => validateDataset(dataset), []);

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
            onReady={graph.attach}
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

          <NodeSearch nodes={snapshot.nodes} onSelect={graph.focus} />

          <h2>Version</h2>
          <div className="versions">
            {dataset.snapshots.map(({ id }) => (
              <button
                key={id}
                type="button"
                aria-pressed={version === id}
                onClick={() => {
                  graph.clear();
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
                  aria-pressed={graph.activeLoop === loop}
                  onClick={() => graph.toggleLoop(loop)}
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
