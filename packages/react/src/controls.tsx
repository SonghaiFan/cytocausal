"use client";
import { versionSteps, type CausalDataset, type CausalNode } from "@cytocausal/core";
import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from "react";
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

/** How many nodes and links changed on the way into each version, the first counting none. */
function useChangeCounts(dataset: CausalDataset | undefined) {
  return useMemo(() => {
    if (!dataset) return {};
    const counts: Record<string, number> = {};
    for (const { to, counts: step } of versionSteps(dataset)) counts[to] = step.added + step.removed + step.changed;
    return counts;
  }, [dataset]);
}

/**
 * A timeline of snapshots, for a history too long for a row of buttons. It scrolls to keep the
 * shown version in view, steps with the arrow keys, Home and End, and marks under each version
 * how much changed since the one before. Outside a provider, pass `versions`, `value` and
 * `onChange`, and `changes` for the marks.
 */
export function VersionTimeline({
  versions,
  value,
  onChange,
  changes: given,
  format = (version) => version,
  className = "",
}: {
  versions?: string[];
  value?: string;
  onChange?: (version: string) => void;
  /** How many nodes and links changed on the way into each version, by id. */
  changes?: Record<string, number>;
  format?: (version: string) => string;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const counted = useChangeCounts(given ? undefined : causal?.dataset);
  const changes = given ?? counted;
  const shown = required(versions ?? causal?.dataset.snapshots.map(({ id }) => id), "VersionTimeline", "versions");
  const current = value ?? causal?.version;
  const choose = onChange ?? causal?.setVersion;
  const at = current ? shown.indexOf(current) : -1;
  const most = Math.max(1, ...Object.values(changes));

  const track = useRef<HTMLOListElement>(null);
  useEffect(() => {
    track.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  const go = (index: number) => {
    const next = shown[Math.max(0, Math.min(shown.length - 1, index))];
    if (next && next !== current) choose?.(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: shown.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    go(moves[event.key]);
  };
  if (shown.length < 2) return null;

  return (
    <nav aria-label={labels.version} className={`cc-timeline ${className}`} onKeyDown={onKeyDown}>
      <button type="button" className="cc-button" aria-label={labels.earlierVersion} disabled={at <= 0} onClick={() => go(at - 1)}>
        ‹
      </button>
      <ol ref={track} className="cc-timeline-track">
        {shown.map((version) => {
          const count = changes[version] ?? 0;
          const name = format(version);
          return (
            <li key={version}>
              <button
                type="button"
                className="cc-button cc-timeline-version"
                aria-current={version === current}
                title={count ? labels.changeCount(count) : undefined}
                onClick={() => go(shown.indexOf(version))}
              >
                {name}
                {/* How much changed since the version before, as a length */}
                <span className="cc-timeline-change" style={{ width: `${(count / most) * 100}%` }} />
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="cc-button"
        aria-label={labels.laterVersion}
        disabled={at < 0 || at >= shown.length - 1}
        onClick={() => go(at + 1)}
      >
        ›
      </button>
    </nav>
  );
}

/**
 * Buttons for moving between snapshots. With more than four, it's a `VersionTimeline` instead,
 * which scrolls and steps through a long history.
 */
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
  if (shown.length > 4) {
    const timeline = <VersionTimeline versions={shown} value={current} onChange={choose} format={format} />;
    if (bare) return <div className={className}>{timeline}</div>;
    return (
      <section className={`cc-panel ${className}`}>
        <h3 className="cc-heading">{labels.version}</h3>
        {timeline}
      </section>
    );
  }

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

const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/**
 * Chooses a layout from the provider's `layouts`, as joined buttons, or a menu when there are
 * more than four. Outside a provider, pass `layouts`, `value` and `onChange`.
 */
export function LayoutSwitcher({
  layouts: given,
  value,
  onChange,
  format = capitalise,
  bare = false,
  className = "",
}: {
  layouts?: string[];
  value?: string;
  onChange?: (name: string) => void;
  /** Turns a layout's name into text for its button. */
  format?: (name: string) => string;
  /** Leave out the panel and heading, to place it on the graph. */
  bare?: boolean;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const names = required(given ?? causal?.layoutNames, "LayoutSwitcher", "layouts");
  const current = value ?? causal?.layoutName;
  const choose = required(onChange ?? causal?.setLayoutName, "LayoutSwitcher", "onChange");
  if (names.length < 2) return null;

  const control =
    names.length > 4 ? (
      <select
        aria-label={labels.layout}
        className="cc-select cc-layout-select"
        value={current}
        onChange={(event) => choose(event.target.value)}
      >
        {names.map((name) => (
          <option key={name} value={name}>
            {format(name)}
          </option>
        ))}
      </select>
    ) : (
      <Segmented label={labels.layout} options={names} value={current} onChange={choose} format={format} />
    );
  if (bare) return <div className={className}>{control}</div>;
  return (
    <section className={`cc-panel ${className}`}>
      <h3 className="cc-heading">{labels.layout}</h3>
      {control}
    </section>
  );
}

export interface LegendItem {
  label: string;
  /** The swatch's colour, a CSS colour or variable. */
  color: string;
  /**
   * How the swatch draws it: `fill` (the default), `ring` for an outline, `dashed` or `dotted`
   * for a broken outline. Shapes and outlines say more without another hue.
   */
  mark?: "fill" | "ring" | "dashed" | "dotted";
  /** A character shown instead of a swatch, for what the graph marks with a glyph. */
  glyph?: string;
}

/** One legend swatch, filled or outlined. */
export function Swatch({
  color,
  mark = "fill",
  faded = false,
}: Pick<LegendItem, "color" | "mark"> & { faded?: boolean }) {
  const style = {
    ...(mark === "fill"
      ? { background: color }
      : { border: `2px ${mark === "ring" ? "solid" : mark} ${color}`, background: "var(--cc-node)" }),
    ...(faded ? { opacity: 0.2 } : {}),
  };
  return <span className="cc-swatch" style={style} aria-hidden="true" />;
}

/** A key to what's drawn. Shows what the selection looks like unless given other items. */
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
  // Causes and effects are shown by contrast and arrows, which need no key
  const shown: LegendItem[] = items ?? [{ label: labels.selected, color: "var(--cc-accent)" }];
  const weighted = support ?? Boolean(causal?.styleOptions?.weightBySupport);
  return (
    <section className={`${bare ? "" : "cc-panel"} ${className}`}>
      {title && <h3 className="cc-heading">{title}</h3>}
      <ul className="cc-legend">
        {shown.map(({ label, color, mark, glyph }) => (
          <li key={label}>
            {glyph && !mark ? (
              <span className="cc-glyph" aria-hidden="true">
                {glyph}
              </span>
            ) : (
              <Swatch color={color} mark={mark} />
            )}
            {label}
            {glyph && mark && <span className="cc-glyph" aria-hidden="true">{glyph}</span>}
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

/**
 * A node's first few pieces of evidence. The label is left out, as it's already on the node.
 * Renders nothing when the node has no evidence to show.
 */
export function NodeTooltip({ node, limit = 3 }: { node: CausalNode; limit?: number }): ReactNode {
  const labels = useCausalLabels();
  const evidence = (node.evidence ?? []).filter(({ text }) => text);
  if (evidence.length === 0) return null;
  return (
    <div className="cc-tooltip">
      <ul className="cc-list">
        {evidence.slice(0, limit).map(({ text }, index) => (
          <li key={index}>{text}</li>
        ))}
      </ul>
      {evidence.length > limit && <p className="cc-muted">{labels.seeAll(evidence.length)}</p>}
    </div>
  );
}
