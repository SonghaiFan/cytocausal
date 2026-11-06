"use client";
import type { CausalNode } from "@cytocausal/core";
import type { ReactNode } from "react";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";

/** Buttons for moving between snapshots. */
export function VersionSwitcher({
  versions,
  value,
  onChange,
  format = (version) => version,
  bare = false,
  className = "",
}: {
  versions?: string[];
  value?: string;
  onChange?: (version: string) => void;
  /** Turns a snapshot id into text for its button. */
  format?: (version: string) => string;
  /** Leave out the panel and heading, to place it on the graph. */
  bare?: boolean;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const shown = required(
    versions ?? causal?.dataset.snapshots.map(({ id }) => id),
    "VersionSwitcher",
    "versions",
  );
  const current = value ?? causal?.version;
  const choose = onChange ?? causal?.setVersion;
  if (shown.length < 2) return null;

  const buttons = (
    <div role="group" aria-label={labels.version} className="cc-segmented">
      {shown.map((version) => (
        <button
          key={version}
          type="button"
          className="cc-button"
          aria-pressed={version === current}
          onClick={() => choose?.(version)}
        >
          {format(version)}
        </button>
      ))}
    </div>
  );
  if (bare) return <div className={className}>{buttons}</div>;
  return (
    <section className={`cc-panel ${className}`}>
      <h3 className="cc-heading">{labels.version}</h3>
      {buttons}
    </section>
  );
}

export interface LegendItem {
  label: string;
  color: string;
}

/** A colour key. Shows causes and effects unless given other items. */
export function Legend({
  items,
  title,
  bare = false,
  className = "",
}: {
  items?: LegendItem[];
  title?: string;
  /** Leave out the panel, to place it on the graph. */
  bare?: boolean;
  className?: string;
}) {
  const labels = useCausalLabels();
  const shown = items ?? [
    { label: labels.causes, color: "var(--cc-cause)" },
    { label: labels.effects, color: "var(--cc-effect)" },
  ];
  return (
    <section className={`${bare ? "" : "cc-panel"} ${className}`}>
      {title && <h3 className="cc-heading">{title}</h3>}
      <ul className="cc-legend">
        {shown.map(({ label, color }) => (
          <li key={label}>
            <span className="cc-swatch" style={{ background: color }} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Zoom and fit buttons. Outside a provider, pass the result of `useCausalGraph`. */
export function ZoomControls({
  graph: given,
  className = "",
}: {
  graph?: { zoomIn: () => void; zoomOut: () => void; fit: () => void };
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const graph = required(given ?? causal?.graph, "ZoomControls", "graph");
  return (
    <div className={`cc-zoom ${className}`}>
      <button type="button" className="cc-button" aria-label={labels.zoomIn} onClick={graph.zoomIn}>
        +
      </button>
      <button type="button" className="cc-button" aria-label={labels.zoomOut} onClick={graph.zoomOut}>
        −
      </button>
      <button type="button" className="cc-button" aria-label={labels.fit} onClick={graph.fit}>
        ⤢
      </button>
    </div>
  );
}

/** A hover preview of a node and its first few pieces of evidence. */
export function NodeTooltip({ node, limit = 3 }: { node: CausalNode; limit?: number }): ReactNode {
  const labels = useCausalLabels();
  const evidence = node.evidence ?? [];
  return (
    <div className="cc-tooltip">
      <strong>{node.label}</strong>
      {evidence.length > 0 && (
        <ul className="cc-list">
          {evidence.slice(0, limit).map(({ text }, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      )}
      {evidence.length > limit && <p className="cc-muted">{labels.seeAll(evidence.length)}</p>}
    </div>
  );
}
