"use client";
import {
  diffSnapshots,
  findFeedbackLoops,
  type CausalDataset,
  type CausalNode,
} from "@cytocausal/core";
import {
  easeStyles,
  exportImage,
  highlightChanges,
  isTransitioning,
  layouts,
  resolveMotion,
  type Positions,
  type Route,
} from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";
import {
  CausalRoot,
  CompareView,
  DepthControl,
  GraphView,
  Legend,
  LoopList,
  NodeSearch,
  Segmented,
  SelectionPanel,
  SidebarHeader,
  themeForScheme,
  useCausalGraph,
  useCausalLabels,
  useColorScheme,
  VersionDiff,
  VersionSwitcher,
  ZoomControls,
} from "@cytocausal/react";
import { useEffect, useMemo, useRef, useState } from "react";
import datasetsJson from "../../data/datasets.json";
import { NodeTooltip } from "@/components/NodeTooltip";
import { annotations, graphStyles } from "@/graph-style";

const datasets = datasetsJson as CausalDataset[];
const LEFT = "V1";
const RIGHT = "final";
const VIEWS = ["Compare", "Single"] as const;
const LAYOUTS = Object.keys(layouts) as (keyof typeof layouts)[];
const DOCS_URL = `${process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3200"}/en/case-perspectiva/`;

const renderTooltip = (node: CausalNode) => <NodeTooltip node={node} />;
const titleCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
const ids = (items: { id: string }[]) => items.map(({ id }) => id);

export function PerspectivaApp({ datasetId, debug }: { datasetId?: string; debug: boolean }) {
  const labels = useCausalLabels();
  const { scheme, setScheme } = useColorScheme();
  const theme = themeForScheme(scheme);
  const stylesheet = useMemo(() => graphStyles(theme), [theme]);

  const [dataset, setDataset] = useState(
    datasets.find(({ id }) => id === datasetId) ?? datasets[0],
  );
  const [layoutName, setLayoutName] = useState<keyof typeof layouts>("fcose");
  // Two graphs side by side are too small to read on a phone
  const [view, setView] = useState<(typeof VIEWS)[number]>(() =>
    window.matchMedia("(max-width: 800px)").matches ? "Single" : "Compare",
  );
  const [version, setVersion] = useState(LEFT);
  const [showChanges, setShowChanges] = useState(false);
  const positionCache = useRef<Record<string, Positions>>({});
  const comparing = view === "Compare";

  // One graph for each pane. In a single view, only `main` is on screen.
  const main = useCausalGraph({ maxSelected: 2, motion: theme.motion });
  const right = useCausalGraph({ maxSelected: 2, motion: theme.motion });
  const paneOf = (snapshotId: string) => (comparing && snapshotId === RIGHT ? right : main);
  const snapshotOf = (id: string) => dataset.snapshots.find((snapshot) => snapshot.id === id)!;

  // Only one pane holds the selection at a time, so the sidebar describes one graph
  const { selected: leftSelected, clear: clearLeft, cy: leftCy } = main;
  const { selected: rightSelected, clear: clearRight, cy: rightCy } = right;
  useEffect(() => {
    if (leftSelected.length) clearRight();
  }, [leftSelected, clearRight]);
  useEffect(() => {
    if (rightSelected.length) clearLeft();
  }, [rightSelected, clearLeft]);

  const active = comparing && rightSelected.length ? right : main;
  const activeSnapshot = snapshotOf(!comparing ? version : active === right ? RIGHT : LEFT);

  const shownVersions = comparing ? [LEFT, RIGHT] : [version];
  const loopGroups = useMemo(
    () =>
      shownVersions.map((id) => {
        const snapshot = dataset.snapshots.find((item) => item.id === id)!;
        return { snapshot, loops: findFeedbackLoops(snapshot).loops };
      }),
    // The array is rebuilt on each render, but only these decide its contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataset, comparing, version],
  );

  const toggleLoop = (snapshotId: string, route: Route) => {
    const target = paneOf(snapshotId);
    (target === main ? right : main).clear();
    target.toggleRoute(route);
  };

  // A highlight belongs to what was on screen when it was chosen
  const clearing =
    <T,>(update: (value: T) => void) =>
    (value: T) => {
      main.clear();
      right.clear();
      update(value);
    };

  useEffect(() => {
    const diff = diffSnapshots(dataset, LEFT, RIGHT);
    const added = showChanges ? [...ids(diff.addedNodes), ...ids(diff.addedLinks)] : [];
    const removed = showChanges ? [...ids(diff.removedNodes), ...ids(diff.removedLinks)] : [];
    const duration = resolveMotion(theme.motion).highlight;
    const mark = (cy: Core | null, marked: string[], gone: string[]) => {
      if (!cy) return;
      const change = () => highlightChanges(cy, marked, gone);
      if (isTransitioning(cy)) change();
      else easeStyles(cy, change, duration);
    };
    if (comparing) {
      mark(leftCy.current, [], removed);
      mark(rightCy.current, added, []);
    } else {
      mark(leftCy.current, version === RIGHT ? added : [], version === LEFT ? removed : []);
    }
  }, [dataset, showChanges, comparing, version, layoutName, leftCy, rightCy, theme]);

  const both = {
    zoomIn: () => [main, ...(comparing ? [right] : [])].forEach((pane) => pane.zoomIn()),
    zoomOut: () => [main, ...(comparing ? [right] : [])].forEach((pane) => pane.zoomOut()),
    fit: () => [main, ...(comparing ? [right] : [])].forEach((pane) => pane.fit()),
  };

  const shared = {
    dataset,
    layout: layouts[layoutName],
    stylesheet,
    motion: theme.motion,
    positionCache,
    renderTooltip,
  };

  return (
    <CausalRoot theme={theme} className="cc-workspace h-screen">
      <div className="cc-graph">
        {comparing ? (
          <CompareView
            key="compare"
            {...shared}
            left={LEFT}
            right={RIGHT}
            format={titleCase}
            onReady={(cy, snapshotId) => (snapshotId === LEFT ? main : right).attach(cy)}
          />
        ) : (
          <GraphView
            key="single"
            {...shared}
            snapshotId={version}
            animateSnapshots
            onReady={main.attach}
          />
        )}

        <div className="cc-overlay cc-overlay-top">
          <div className="cc-buttons">
            <Segmented label="View" options={VIEWS} value={view} onChange={clearing(setView)} />
            {!comparing && (
              <VersionSwitcher
                bare
                versions={ids(dataset.snapshots)}
                value={version}
                onChange={clearing(setVersion)}
                format={titleCase}
              />
            )}
          </div>
          <div className="cc-buttons">
            <Segmented
              label="Layout"
              options={LAYOUTS}
              value={layoutName}
              onChange={clearing(setLayoutName)}
            />
            <button
              type="button"
              className="cc-button"
              onClick={() =>
                leftCy.current &&
                exportImage(leftCy.current, dataset.id, theme.colors.background)
              }
            >
              {labels.exportImage}
            </button>
          </div>
        </div>

        <div className="cc-overlay cc-overlay-bottom">
          <Legend
            bare
            items={[
              { label: labels.causes, color: "var(--cc-cause)" },
              { label: labels.effects, color: "var(--cc-effect)" },
              ...annotations.map(({ label, color }) => ({ label, color: theme.colors[color] })),
            ]}
          />
          <DepthControl
            bare
            value={main.depth}
            onChange={(depth) => {
              main.setDepth(depth);
              right.setDepth(depth);
            }}
          />
        </div>

        <ZoomControls graph={both} />
        <p role="status" className="cc-sr-only">
          {active.announcement}
        </p>
      </div>

      <aside className="cc-sidebar">
        <SidebarHeader
          title="Perspectiva"
          subtitle="Causal loop diagrams from participatory workshops"
          scheme={scheme}
          onToggleScheme={() => setScheme(scheme === "dark" ? "light" : "dark")}
        >
          <a className="cc-link" href={DOCS_URL}>
            Docs
          </a>
        </SidebarHeader>

        {debug && (
          <select
            aria-label="Dataset"
            className="cc-select"
            value={dataset.id}
            onChange={(event) =>
              clearing(setDataset)(datasets.find(({ id }) => id === event.target.value)!)
            }
          >
            {ids(datasets).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        )}

        <NodeSearch nodes={activeSnapshot.nodes} onSelect={active.focus} />
        <SelectionPanel graph={active} snapshot={activeSnapshot} />

        {loopGroups.map(({ snapshot, loops }) => (
          <LoopList
            key={snapshot.id}
            title={loopGroups.length > 1 ? `Feedback loops: ${snapshot.id}` : undefined}
            snapshot={snapshot}
            loops={loops}
            active={paneOf(snapshot.id).activeRoute}
            onToggle={(route) => toggleLoop(snapshot.id, route)}
            onPreview={paneOf(snapshot.id).previewRoute}
          />
        ))}

        <VersionDiff
          dataset={dataset}
          from={LEFT}
          to={RIGHT}
          shown={showChanges}
          onToggle={() => setShowChanges(!showChanges)}
        />

        <details className="cc-panel cc-disclosure">
          <summary>Terms ({activeSnapshot.nodes.length})</summary>
          <ul className="cc-list cc-block">
            {activeSnapshot.nodes.map(({ id, label, metadata }) => (
              <li key={id} className="cc-muted">
                {String(metadata?.key ?? id)} {label}
              </li>
            ))}
          </ul>
        </details>
      </aside>
    </CausalRoot>
  );
}
