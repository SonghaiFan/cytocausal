"use client";
import type { CausalNode } from "@cytocausal/core";
import type { ReactNode } from "react";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";

/** One choice from a few options, as a row of joined buttons. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format = String,
}: {
  label: string;
  options: readonly T[];
  value?: T;
  onChange?: (value: T) => void;
  format?: (option: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="cc-segmented">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="cc-button"
          aria-pressed={option === value}
          onClick={() => onChange?.(option)}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

/** The title at the top of a sidebar, with a light and dark switch and any links. */
export function SidebarHeader({
  title,
  subtitle,
  scheme,
  onToggleScheme,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  scheme?: "light" | "dark";
  onToggleScheme?: (() => void) | null;
  /** Links, shown under the title. */
  children?: ReactNode;
}) {
  const labels = useCausalLabels();
  return (
    <header className="cc-spread">
      <div>
        <h1 className="cc-title">{title}</h1>
        {subtitle && <p className="cc-muted">{subtitle}</p>}
        {children}
      </div>
      {onToggleScheme && (
        <button type="button" className="cc-button" onClick={onToggleScheme}>
          {scheme === "dark" ? labels.lightMode : labels.darkMode}
        </button>
      )}
    </header>
  );
}

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
    <Segmented
      label={labels.version}
      options={shown}
      value={current}
      onChange={choose}
      format={format}
    />
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
  support,
  bare = false,
  className = "",
}: {
  items?: LegendItem[];
  title?: string;
  /** Explain that thicker links were stated by more people. Defaults to the provider's style. */
  support?: boolean;
  /** Leave out the panel, to place it on the graph. */
  bare?: boolean;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const shown = items ?? [
    { label: labels.causes, color: "var(--cc-cause)" },
    { label: labels.effects, color: "var(--cc-effect)" },
  ];
  const weighted = support ?? Boolean(causal?.styleOptions?.weightBySupport);
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
        {weighted && (
          <li>
            <svg className="cc-weight" width="20" height="12" viewBox="0 0 20 12" aria-hidden="true">
              <line x1="0" y1="3" x2="20" y2="3" stroke="currentColor" strokeWidth="1" />
              <line x1="0" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="4" />
            </svg>
            {labels.supportLegend}
          </li>
        )}
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
  const evidence = (node.evidence ?? []).filter(({ text }) => text);
  return (
    <div className="cc-tooltip">
      <strong>{node.label}</strong>
      {evidence.length > 0 && (
        <ul className="cc-list">
          {evidence
            .filter(({ text }) => text)
            .slice(0, limit)
            .map(({ text }, index) => (
              <li key={index}>{text}</li>
            ))}
        </ul>
      )}
      {evidence.length > limit && <p className="cc-muted">{labels.seeAll(evidence.length)}</p>}
    </div>
  );
}
