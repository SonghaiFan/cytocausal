"use client";
import {
  diffSnapshots,
  findFeedbackLoops,
  validateDataset,
  type CausalDataset,
  type CausalNode,
} from "@cytocausal/core";
import {
  autoLayout,
  createCausalStyle,
  darkTheme,
  exportImage,
  highlightChanges,
  lightTheme,
  savedLayout,
  type CausalStyleOptions,
  type CausalTheme,
  type Positions,
} from "@cytocausal/cytoscape";
import type { LayoutOptions } from "cytoscape";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DepthControl, PathList, VersionDiff } from "./analysis.tsx";
import { Legend, NodeTooltip, VersionSwitcher, ZoomControls } from "./controls.tsx";
import { GraphView } from "./GraphView.tsx";
import { CausalLabelsProvider, useCausalLabels, type CausalLabels } from "./labels.tsx";
import { LoopList } from "./LoopList.tsx";
import { NodeDetails } from "./NodeDetails.tsx";
import { NodeSearch } from "./NodeSearch.tsx";
import { CausalRoot, useColorScheme } from "./theme.tsx";
import { useCausalGraph } from "./useCausalGraph.ts";

export interface CausalWorkspaceProps {
  dataset: CausalDataset;
  title?: string;
  /** Text to replace, such as to translate the interface. Keep this stable between renders. */
  labels?: Partial<CausalLabels>;
  /** Keep this stable between renders. */
  themes?: { light: CausalTheme; dark: CausalTheme };
  /** Keep this stable between renders. */
  styleOptions?: CausalStyleOptions;
  /** Defaults to saved positions when every node has one, and otherwise an automatic layout. */
  layout?: LayoutOptions;
  /** How many nodes can be selected at once. */
  maxSelected?: number;
  /** Keep the version and selection in the page address, so a link reopens the same view. */
  shareInUrl?: boolean;
  /** Extra panels, shown at the end of the sidebar. */
  children?: ReactNode;
}

const defaultThemes = { light: lightTheme, dark: darkTheme };

// The number of loops can explode on large graphs, so only short ones are listed
const LARGE_GRAPH = 60;
const LARGE_GRAPH_SEARCH = { maxLength: 6 };

const renderTooltip = (node: CausalNode) => <NodeTooltip node={node} />;

function Workspace({
  dataset,
  title,
  themes = defaultThemes,
  styleOptions,
  layout,
  maxSelected = 2,
  shareInUrl = true,
  children,
}: CausalWorkspaceProps) {
  const labels = useCausalLabels();
  const { scheme, setScheme } = useColorScheme();
  const theme = themes[scheme];
  const stylesheets = useMemo(
    () => ({
      light: createCausalStyle(themes.light, styleOptions),
      dark: createCausalStyle(themes.dark, styleOptions),
    }),
    [themes, styleOptions],
  );

  const [shared] = useState(() => new URLSearchParams(shareInUrl ? location.search : ""));
  const [version, setVersion] = useState(() => {
    const requested = shared.get("version");
    const known = dataset.snapshots.some(({ id }) => id === requested);
    return known ? requested! : dataset.snapshots[0].id;
  });
  const snapshot = dataset.snapshots.find(({ id }) => id === version)!;
  const issues = useMemo(() => validateDataset(dataset), [dataset]);
  const { loops, complete } = useMemo(
    () =>
      findFeedbackLoops(
        snapshot,
        snapshot.nodes.length > LARGE_GRAPH ? LARGE_GRAPH_SEARCH : undefined,
      ),
    [snapshot],
  );
  const hasPositions = snapshot.nodes.every(({ position }) => position);

  const positionCache = useRef<Record<string, Positions>>({});
  const graph = useCausalGraph({
    maxSelected,
    motion: theme.motion,
    initialSelected: (shared.get("selected")?.split(",") ?? []).filter((id) =>
      snapshot.nodes.some((node) => node.id === id),
    ),
  });

  const first = dataset.snapshots[0].id;
  const last = dataset.snapshots[dataset.snapshots.length - 1].id;
  const [showChanges, setShowChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const { cy, selected } = graph;

  useEffect(() => {
    if (!shareInUrl) return;
    const url = new URL(location.href);
    url.searchParams.set("version", version);
    if (selected.length) url.searchParams.set("selected", selected.join(","));
    else url.searchParams.delete("selected");
    history.replaceState(null, "", url);
    setCopied(false);
  }, [shareInUrl, version, selected]);

  useEffect(() => {
    const instance = cy.current;
    if (!instance || first === last) return;
    if (!showChanges) {
      highlightChanges(instance, [], []);
      return;
    }
    const diff = diffSnapshots(dataset, first, last);
    const ids = (items: { id: string }[]) => items.map(({ id }) => id);
    if (version === last) {
      highlightChanges(instance, [...ids(diff.addedNodes), ...ids(diff.addedLinks)], []);
    } else {
      highlightChanges(instance, [], [...ids(diff.removedNodes), ...ids(diff.removedLinks)]);
    }
  }, [cy, dataset, first, last, showChanges, version]);

  return (
    <CausalRoot theme={theme} className="cc-workspace">
      <div className="cc-graph">
        <GraphView
          dataset={dataset}
          snapshotId={version}
          layout={layout ?? (hasPositions ? savedLayout : autoLayout)}
          stylesheet={stylesheets[scheme]}
          motion={theme.motion}
          maxZoom={1.8}
          positionCache={positionCache}
          animateSnapshots
          renderTooltip={renderTooltip}
          onReady={(instance) => {
            graph.attach(instance);
            instance.container()!.setAttribute("aria-label", labels.graph);
          }}
        />
        <ZoomControls graph={graph} />
        <p role="status" className="cc-sr-only">
          {graph.announcement}
        </p>
      </div>

      <aside className="cc-sidebar">
        <div className="cc-spread">
          <h1 className="cc-title">{title}</h1>
          <button
            type="button"
            className="cc-button"
            onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}
          >
            {scheme === "dark" ? labels.lightMode : labels.darkMode}
          </button>
        </div>
        {issues.length > 0 && (
          <pre role="alert" className="cc-panel cc-issues">
            {issues.join("\n")}
          </pre>
        )}
        <NodeSearch nodes={snapshot.nodes} onSelect={graph.focus} />
        {dataset.snapshots.length > 1 && (
          <VersionSwitcher
            versions={dataset.snapshots.map(({ id }) => id)}
            value={version}
            onChange={(id) => {
              graph.clear();
              setVersion(id);
            }}
          />
        )}
        <Legend />
        <DepthControl value={graph.depth} onChange={graph.setDepth} />
        {graph.selected.length === 2 && (
          <PathList
            snapshot={snapshot}
            from={graph.selected[0]}
            to={graph.selected[1]}
            active={graph.activeLoop}
            onToggle={graph.toggleLoop}
          />
        )}
        {graph.selected.map((id) => (
          <NodeDetails
            key={id}
            snapshot={snapshot}
            nodeId={id}
            onSelect={graph.focus}
            onClose={() => graph.toggle(id)}
          />
        ))}
        <LoopList
          snapshot={snapshot}
          loops={loops}
          complete={complete}
          active={graph.activeLoop}
          onToggle={graph.toggleLoop}
        />
        {first !== last && (
          <VersionDiff
            dataset={dataset}
            from={first}
            to={last}
            shown={showChanges}
            onToggle={() => setShowChanges(!showChanges)}
          />
        )}
        <div className="cc-buttons">
          <button
            type="button"
            className="cc-button"
            onClick={() => cy.current && exportImage(cy.current, dataset.id, theme.colors.background)}
          >
            {labels.exportImage}
          </button>
          {shareInUrl && (
            <button
              type="button"
              className="cc-button"
              onClick={() => navigator.clipboard.writeText(location.href).then(() => setCopied(true))}
            >
              {copied ? labels.linkCopied : labels.copyLink}
            </button>
          )}
        </div>
        {children}
      </aside>
    </CausalRoot>
  );
}

/** A complete interface for a causal dataset, built from the components in this package. */
export function CausalWorkspace({ labels, ...props }: CausalWorkspaceProps) {
  return (
    <CausalLabelsProvider labels={labels}>
      <Workspace {...props} />
    </CausalLabelsProvider>
  );
}
