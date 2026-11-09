"use client";
import {
  diffSnapshots,
  getSnapshot,
  findCausalPaths,
  type CausalDataset,
  type LoopOptions,
  type CausalNode,
  type Snapshot,
} from "@cytocausal/core";
import type { Route } from "@cytocausal/cytoscape";
import { useMemo, type ReactNode } from "react";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import type { useCausalGraph } from "./useCausalGraph.ts";
import { Segmented } from "./controls.tsx";
import { useCausalLabels } from "./labels.tsx";
import { LinkDetails } from "./LinkDetails.tsx";
import { NodeDetails } from "./NodeDetails.tsx";
import { RouteButton } from "./RouteButton.tsx";

/** Buttons for how many links away a highlight reaches. */
export function DepthControl({
  value,
  onChange,
  steps = [1, 2, 3],
  bare = false,
  className = "",
}: {
  value?: number;
  onChange?: (depth: number) => void;
  steps?: number[];
  /** Leave out the panel, to place it on the graph. */
  bare?: boolean;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const current = value ?? causal?.graph.depth;
  const choose = onChange ?? causal?.graph.setDepth;

  const buttons = (
    <Segmented label={labels.depth} options={steps} value={current} onChange={choose} />
  );
  if (bare) {
    return (
      <div className={`cc-inline ${className}`}>
        <span className="cc-muted">{labels.depth}</span>
        {buttons}
      </div>
    );
  }
  return (
    <section className={`cc-panel ${className}`}>
      <h3 className="cc-heading">{labels.depth}</h3>
      {buttons}
    </section>
  );
}

/**
 * Lists the causal paths between two nodes, in both directions, for choosing one to highlight.
 * In a provider, it follows the two selected nodes.
 */
export function PathList({
  snapshot: given,
  from: start,
  to: end,
  active,
  onToggle,
  onPreview,
  className = "",
}: {
  snapshot?: Snapshot;
  from?: string;
  to?: string;
  active?: Route | null;
  onToggle?: (path: Route) => void;
  onPreview?: (path: Route | null) => void;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const snapshot = required(given ?? causal?.snapshot, "PathList", "snapshot");
  const from = start ?? causal?.graph.selected[0];
  const to = end ?? causal?.graph.selected[1];
  const labelOf = (id: string) => snapshot.nodes.find((node) => node.id === id)?.label ?? id;
  const searches = useMemo(
    () =>
      from && to
        ? [
            { start: from, end: to, ...findCausalPaths(snapshot, from, to) },
            { start: to, end: from, ...findCausalPaths(snapshot, to, from) },
          ]
        : [],
    [snapshot, from, to],
  );
  if (searches.length === 0) return null;

  return (
    <section aria-label="Paths" className={`cc-panel ${className}`}>
      {searches.map(({ start, end, paths, complete }) => (
        <div key={start} className="cc-block">
          <h3 className="cc-heading">
            {labels.paths(labelOf(start), labelOf(end))} ({paths.length}
            {complete ? "" : "+"})
          </h3>
          {paths.length === 0 ? (
            <p className="cc-muted">{labels.noPaths}</p>
          ) : (
            <ul className="cc-list">
              {paths.map((path) => (
                <li key={path.edges.join()}>
                  <RouteButton route={path} active={active} onToggle={onToggle} onPreview={onPreview}>
                    {path.nodes.map(labelOf).join(" → ")}
                  </RouteButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * Everything about the current selection: a prompt, each node's details and the paths.
 * Outside a provider, pass `graph` and `snapshot`.
 */
export function SelectionPanel({
  graph: given,
  snapshot: chosen,
  loopOptions,
  className = "",
}: {
  graph?: ReturnType<typeof useCausalGraph>;
  snapshot?: Snapshot;
  /** Lists the loops through each selected node, within these limits. */
  loopOptions?: LoopOptions;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const graph = required(given ?? causal?.graph, "SelectionPanel", "graph");
  const snapshot = required(chosen ?? causal?.snapshot, "SelectionPanel", "snapshot");
  const { selected, clear } = graph;
  const routes = { active: graph.activeRoute, onToggle: graph.toggleRoute };

  if (graph.selectedLink) {
    return (
      <LinkDetails
        snapshot={snapshot}
        linkId={graph.selectedLink}
        onSelect={graph.focus}
        onClose={clear}
        className={className}
      />
    );
  }
  if (selected.length === 0) {
    return <p className={`cc-panel cc-hint ${className}`}>{labels.selectHint}</p>;
  }
  return (
    <>
      <div className="cc-spread">
        <p className="cc-muted">{selected.length === 1 ? labels.pathHint : ""}</p>
        <button type="button" className="cc-link" onClick={clear}>
          {labels.clearSelection}
        </button>
      </div>
      <PathList
        snapshot={snapshot}
        from={selected[0]}
        to={selected[1]}
        onPreview={graph.previewRoute}
        className={className}
        {...routes}
      />
      {selected.map((id) => (
        <NodeDetails
          key={id}
          snapshot={snapshot}
          nodeId={id}
          onSelect={graph.focus}
          onClose={() => graph.toggle(id)}
          onShowLink={graph.toggleLink}
          loopOptions={loopOptions}
          activeRoute={graph.activeRoute}
          onToggleRoute={loopOptions ? graph.toggleRoute : undefined}
          className={className}
        />
      ))}
    </>
  );
}

function ChangeGroup({ title, items }: { title: string; items: ReactNode[] }) {
  if (items.length === 0) return null;
  return (
    <details className="cc-diff">
      <summary>
        {title} ({items.length})
      </summary>
      <ul className="cc-list cc-evidence">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </details>
  );
}

/** Summarises what changed between two snapshots. */
export function VersionDiff(props: VersionDiffProps) {
  const causal = useOptionalCausal();
  const dataset = required(props.dataset ?? causal?.dataset, "VersionDiff", "dataset");
  const from = props.from ?? causal?.firstVersion ?? dataset.snapshots[0].id;
  const to = props.to ?? causal?.lastVersion ?? dataset.snapshots[dataset.snapshots.length - 1].id;
  if (from === to) return null;

  // Inside a provider, the button marks the changes on its graph
  const connected = causal && !props.onToggle;
  return (
    <Differences
      dataset={dataset}
      from={from}
      to={to}
      shown={connected ? causal.showChanges : props.shown}
      onToggle={connected ? () => causal.setShowChanges(!causal.showChanges) : props.onToggle}
      className={props.className}
    />
  );
}

export interface VersionDiffProps {
  dataset?: CausalDataset;
  /** Defaults to the first snapshot. */
  from?: string;
  /** Defaults to the last snapshot. */
  to?: string;
  /** Whether changes are marked on the graph. Leave out with `onToggle` to hide the button. */
  shown?: boolean;
  onToggle?: () => void;
  className?: string;
}

function Differences({
  dataset,
  from,
  to,
  shown,
  onToggle,
  className = "",
}: {
  dataset: CausalDataset;
  from: string;
  to: string;
  /** Whether changes are marked on the graph. Leave out with `onToggle` to hide the button. */
  shown?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  const labels = useCausalLabels();
  const diff = useMemo(() => diffSnapshots(dataset, from, to), [dataset, from, to]);
  const names = useMemo(() => {
    const all = new Map<string, CausalNode>();
    for (const { nodes } of dataset.snapshots) nodes.forEach((node) => all.set(node.id, node));
    return all;
  }, [dataset]);

  const fromNodes = getSnapshot(dataset, from).nodes;
  const toNodes = getSnapshot(dataset, to).nodes;
  const labelIn = (nodes: CausalNode[], id: string) =>
    nodes.find((node) => node.id === id)?.label ?? names.get(id)?.label ?? id;
  const link = (nodes: CausalNode[]) => (edge: { source: string; target: string }) =>
    `${labelIn(nodes, edge.source)} → ${labelIn(nodes, edge.target)}`;

  const groups: [string, ReactNode[]][] = [
    [labels.added, diff.addedNodes.map(({ label }) => label)],
    [labels.removed, diff.removedNodes.map(({ label }) => label)],
    [labels.renamed, diff.renamedNodes.map((item) => `${item.from.label} → ${item.to.label}`)],
    [
      labels.merged,
      diff.mergedNodes.map(
        (item) => `${item.from.map(({ label }) => label).join(", ")} → ${item.to.label}`,
      ),
    ],
    [
      labels.split,
      diff.splitNodes.map(
        (item) => `${item.from.label} → ${item.to.map(({ label }) => label).join(", ")}`,
      ),
    ],
    [
      labels.regrouped,
      diff.regroupedNodes.map(
        (item) =>
          `${item.from.map(({ label }) => label).join(", ")} → ${item.to.map(({ label }) => label).join(", ")}`,
      ),
    ],
    [labels.linksAdded, diff.addedLinks.map(link(toNodes))],
    [labels.linksRemoved, diff.removedLinks.map(link(fromNodes))],
    [labels.polarityChanged, diff.changedLinks.map(({ to: edge }) => link(toNodes)(edge))],
  ];
  const changed = groups.some(([, items]) => items.length > 0);

  return (
    <section aria-label="Changes" className={`cc-panel ${className}`}>
      <div className="cc-spread">
        <h3 className="cc-heading">
          {labels.changes}: {from} → {to}
        </h3>
        {onToggle && changed && (
          <button type="button" className="cc-button" aria-pressed={shown} onClick={onToggle}>
            {labels.showChanges}
          </button>
        )}
      </div>
      {!changed && <p className="cc-muted">{labels.noChanges}</p>}
      {shown && (
        <ul className="cc-legend">
          <li>
            <span className="cc-swatch" style={{ background: "var(--cc-added)" }} />
            {labels.added}
          </li>
          <li>
            <span className="cc-swatch" style={{ background: "var(--cc-conflict)" }} />
            {labels.removed}
          </li>
        </ul>
      )}
      {groups.map(([title, items]) => (
        <ChangeGroup key={title} title={title} items={items} />
      ))}
    </section>
  );
}
