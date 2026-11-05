"use client";
import {
  diffSnapshots,
  findCausalPaths,
  type CausalDataset,
  type CausalNode,
  type Snapshot,
} from "@cytocausal/core";
import type { Route } from "@cytocausal/cytoscape";
import { useMemo, type ReactNode } from "react";
import { useCausalLabels } from "./labels.tsx";

/** Buttons for how many links away a highlight reaches. */
export function DepthControl({
  value,
  onChange,
  steps = [1, 2, 3],
  className = "",
}: {
  value: number;
  onChange: (depth: number) => void;
  steps?: number[];
  className?: string;
}) {
  const labels = useCausalLabels();
  return (
    <section className={`cc-panel ${className}`}>
      <h3 className="cc-heading">{labels.depth}</h3>
      <div className="cc-buttons">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            className="cc-button"
            aria-pressed={step === value}
            onClick={() => onChange(step)}
          >
            {step}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Lists the causal paths between two nodes, in both directions, for choosing one to highlight. */
export function PathList({
  snapshot,
  from,
  to,
  active,
  onToggle,
  className = "",
}: {
  snapshot: Snapshot;
  from: string;
  to: string;
  active?: Route | null;
  onToggle: (path: Route) => void;
  className?: string;
}) {
  const labels = useCausalLabels();
  const labelOf = (id: string) => snapshot.nodes.find((node) => node.id === id)?.label ?? id;
  const searches = useMemo(
    () => [
      { start: from, end: to, ...findCausalPaths(snapshot, from, to) },
      { start: to, end: from, ...findCausalPaths(snapshot, to, from) },
    ],
    [snapshot, from, to],
  );

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
                  <button
                    type="button"
                    className="cc-row"
                    aria-pressed={active === path}
                    onClick={() => onToggle(path)}
                  >
                    {path.nodes.map(labelOf).join(" → ")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
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
export function VersionDiff({
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

  const fromNodes = dataset.snapshots.find(({ id }) => id === from)!.nodes;
  const toNodes = dataset.snapshots.find(({ id }) => id === to)!.nodes;
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
            <span className="cc-swatch" style={{ background: "var(--cc-clarification)" }} />
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
