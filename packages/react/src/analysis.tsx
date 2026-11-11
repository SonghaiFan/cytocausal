"use client";
import { selectionPaths } from "./selection-paths.ts";
import {
  diffSnapshots,
  getSnapshot,
  type CausalDataset,
  type LoopOptions,
  type CausalNode,
  type Snapshot,
} from "@cytocausal/core";
import type { Route } from "@cytocausal/cytoscape";
import { Fragment, useMemo, type ReactNode } from "react";
import { LinkHistory, NodeHistory } from "./History.tsx";
import { required, useOptionalCausal, type Baseline } from "./CausalProvider.tsx";
import type { useCausalGraph } from "./useCausalGraph.ts";
import { Segmented, Swatch } from "./controls.tsx";
import { useCausalLabels } from "./labels.tsx";
import { LinkDetails } from "./LinkDetails.tsx";
import { NodeDetails } from "./NodeDetails.tsx";
import { RouteButton } from "./RouteButton.tsx";

/** Buttons for how many links away a highlight reaches. */
export function DepthControl({
  value,
  onChange,
  steps: given,
  bare = false,
  className = "",
}: {
  value?: number;
  onChange?: (depth: number) => void;
  /** Defaults to every step up to the graph's `maxDepth`. */
  steps?: number[];
  /** Leave out the panel, to place it on the graph. */
  bare?: boolean;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const current = value ?? causal?.graph.depth;
  const choose = onChange ?? causal?.graph.setDepth;
  const steps = given ?? Array.from({ length: causal?.graph.maxDepth ?? 2 }, (_, index) => index + 1);

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
 * Lists the sparse directed shortest connections for choosing one to highlight.
 * In a provider, it follows all selected nodes.
 */
export function PathList({
  snapshot: given,
  from: start,
  to: end,
  selected: givenSelected,
  active,
  onToggle,
  onPreview,
  className = "",
}: {
  snapshot?: Snapshot;
  from?: string;
  to?: string;
  selected?: string[];
  active?: Route | null;
  onToggle?: (path: Route) => void;
  onPreview?: (path: Route | null) => void;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const snapshot = required(given ?? causal?.snapshot, "PathList", "snapshot");
  const selected = givenSelected ?? causal?.graph.selected;
  const labelOf = (id: string) => snapshot.nodes.find((node) => node.id === id)?.label ?? id;
  const searches = useMemo(
    () => selectionPaths(snapshot, start !== undefined || end !== undefined
      ? [start, end].filter((id): id is string => id !== undefined)
      : selected ?? []),
    [snapshot, start, end, selected],
  );
  if (searches.length === 0) return null;

  return (
    <section aria-label="Paths" className={`cc-panel ${className}`}>
      {searches.map(({ start, end, paths, complete }) => (
        <div key={JSON.stringify([start, end])} className="cc-block">
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
  // History needs the provider's dataset and version, so only its own snapshot has one
  const history = Boolean(causal && !chosen);
  const routes = { active: graph.activeRoute, onToggle: graph.toggleRoute };

  if (graph.selectedLink) {
    return (
      <>
        <LinkDetails
          snapshot={snapshot}
          linkId={graph.selectedLink}
          onSelect={graph.focus}
          onClose={clear}
          className={className}
        />
        {history && <LinkHistory linkId={graph.selectedLink} className={className} />}
      </>
    );
  }
  if (selected.length === 0) {
    return <p className={`cc-panel cc-hint ${className}`}>{labels.selectHint}</p>;
  }
  return (
    <>
      <div className="cc-spread">
        <div>
          {graph.canTrace && selected.length === 1 && <button type="button" className="cc-link" aria-pressed={graph.tracing}
            onClick={() => graph.tracing ? graph.stopTracing() : graph.startTracing()}
            onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); graph.dismiss(); } }}>
            {labels.tracePaths}
          </button>}
          {graph.tracing && <p className="cc-muted">{labels.tracingHint}</p>}
        </div>
        <button type="button" className="cc-link" onClick={clear}>
          {labels.clearSelection}
        </button>
      </div>
      <PathList
        snapshot={snapshot}
        selected={selected}
        onPreview={graph.previewRoute}
        className={className}
        {...routes}
      />
      {selected.map((id) => (
        <Fragment key={id}>
        <NodeDetails
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
        {history && <NodeHistory nodeId={id} className={className} />}
        </Fragment>
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
  const fallback = { from: dataset.snapshots[0].id, to: dataset.snapshots[dataset.snapshots.length - 1].id };
  const comparison = causal ? causal.comparison : fallback;
  const from = props.from ?? comparison?.from;
  const to = props.to ?? comparison?.to;
  if (!from || !to || from === to) return null;

  // Inside a provider, the button marks the changes on its graph
  const connected = causal && !props.onToggle;
  return (
    <Differences
      dataset={dataset}
      from={from}
      to={to}
      shown={connected ? causal.showChanges : props.shown}
      onToggle={connected ? () => causal.setShowChanges(!causal.showChanges) : props.onToggle}
      // With more than two versions, there's a choice of what to compare with
      baseline={
        causal && !props.from && !props.to && dataset.snapshots.length > 2
          ? { value: causal.baseline, onChange: causal.setBaseline }
          : undefined
      }
      className={props.className}
    />
  );
}

export interface VersionDiffProps {
  dataset?: CausalDataset;
  /** Defaults to the provider's comparison, or outside one, the first snapshot. */
  from?: string;
  /** Defaults to the provider's comparison, or outside one, the last snapshot. */
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
  baseline,
  className = "",
}: {
  dataset: CausalDataset;
  from: string;
  to: string;
  /** Whether changes are marked on the graph. Leave out with `onToggle` to hide the button. */
  shown?: boolean;
  onToggle?: () => void;
  baseline?: { value: Baseline; onChange: (baseline: Baseline) => void };
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
      {baseline && (
        <Segmented<Baseline>
          label={labels.compareWith}
          options={["previous", "first"]}
          value={baseline.value}
          onChange={baseline.onChange}
          format={(option) => (option === "previous" ? labels.previousVersion : labels.firstVersion)}
        />
      )}
      {!changed && <p className="cc-muted">{labels.noChanges}</p>}
      {shown && (
        <ul className="cc-legend">
          <li>
            <Swatch color="var(--cc-added)" />
            {labels.added}
          </li>
          <li>
            <Swatch color="var(--cc-removed)" />
            {labels.removed}
          </li>
          <li>
            <Swatch color="var(--cc-ink)" />
            {labels.changed}
          </li>
        </ul>
      )}
      {groups.map(([title, items]) => (
        <ChangeGroup key={title} title={title} items={items} />
      ))}
    </section>
  );
}
