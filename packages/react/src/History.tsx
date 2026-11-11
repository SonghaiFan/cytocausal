"use client";
import {
  linkHistory,
  nodeHistory,
  type CausalDataset,
  type CausalNode,
  type LinkHistoryEntry,
  type LinkPolarity,
  type NodeHistoryEntry,
  type NodeHistoryPart,
} from "@cytocausal/core";
import { useMemo, type ReactNode } from "react";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels, type CausalLabels } from "./labels.tsx";

/** Where to go when a version in a history is chosen, and what to select there. */
export type HistoryJump = (version: string, focus: { node?: string; link?: string }) => void;

interface HistoryProps {
  dataset?: CausalDataset;
  /** The version shown. Its row is marked, and the history is traced from it. */
  version?: string;
  /** Called when a version is chosen. Inside a provider, it moves there by default. */
  onJump?: HistoryJump;
  className?: string;
}

const names = (nodes: CausalNode[]) => nodes.map(({ label }) => label).join(", ");

/** What happened to one part of a node, in words. */
function describePart(part: NodeHistoryPart, labels: CausalLabels) {
  switch (part.change) {
    case "start":
      return labels.historyStart;
    case "added":
      return labels.historyAdded;
    case "removed":
      return labels.historyRemoved;
    case "unchanged":
      return labels.historyUnchanged;
    case "renamed":
      return labels.historyRenamed(names(part.before));
    case "merged":
      return labels.historyMerged(names(part.before));
    case "split":
      return labels.historySplit(names(part.nodes));
    case "regrouped":
      return labels.historyRegrouped(names(part.before), names(part.nodes));
  }
}

/** What happened in one version. Parts that didn't change are left out, unless nothing did. */
function describeNode(entry: NodeHistoryEntry, labels: CausalLabels) {
  const changed = entry.parts.filter(({ change }) => change !== "unchanged");
  if (changed.length === 0) return labels.historyUnchanged;
  // Several nodes, such as before a merge, are named, so it's clear which changed
  const several = entry.nodes.length > 1;
  return changed
    .map((part) => (several && part.nodes.length ? `${names(part.nodes)}: ${describePart(part, labels)}` : describePart(part, labels)))
    .join("; ");
}

const polarityName = (polarity: LinkPolarity | undefined, labels: CausalLabels) =>
  polarity === "positive" ? labels.positive : polarity === "negative" ? labels.negative : polarity === "mixed" ? labels.mixed : "";

function describeLink(entry: LinkHistoryEntry, labels: CausalLabels) {
  const polarity = polarityName(entry.polarity, labels);
  switch (entry.change) {
    case "start":
      return polarity ? `${labels.historyStart}, ${polarity.toLowerCase()}` : labels.historyStart;
    case "added":
      return polarity ? `${labels.historyAdded}, ${polarity.toLowerCase()}` : labels.historyAdded;
    case "flipped":
      return labels.historyFlipped(polarity.toLowerCase());
    case "removed":
      return labels.historyRemoved;
    case "unchanged":
      return labels.historyUnchanged;
  }
}

/**
 * The rows of a history: each version where something happened, and the one shown. Runs of
 * versions where nothing changed are left out, so a long history stays short.
 */
function HistoryList<T extends { version: string; change: string }>({
  title,
  entries,
  version,
  describe,
  focusOf,
  onJump,
  className,
}: {
  title: string;
  entries: T[];
  version: string;
  describe: (entry: T) => ReactNode;
  focusOf: (entry: T) => { node?: string; link?: string };
  onJump?: HistoryJump;
  className: string;
}) {
  const labels = useCausalLabels();
  const rows = entries.filter((entry) => entry.change !== "unchanged" || entry.version === version);
  return (
    <section className={`cc-panel ${className}`} aria-label={title}>
      <h3 className="cc-heading">{labels.history}</h3>
      <ol className="cc-history">
        {rows.map((entry) => {
          const current = entry.version === version;
          return (
            <li key={entry.version} aria-current={current || undefined}>
              {current || !onJump ? (
                <span className="cc-history-version">{entry.version}</span>
              ) : (
                <button
                  type="button"
                  className="cc-link cc-history-version"
                  aria-label={labels.goToVersion(entry.version)}
                  onClick={() => onJump(entry.version, focusOf(entry))}
                >
                  {entry.version}
                </button>
              )}
              <span className={entry.change === "unchanged" ? "cc-muted" : undefined}>{describe(entry)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Uses the provider's dataset, version and version switch where they aren't given. */
function useHistoryContext(props: HistoryProps, name: string) {
  const causal = useOptionalCausal();
  const dataset = required(props.dataset ?? causal?.dataset, name, "dataset");
  const version = required(props.version ?? causal?.version, name, "version");
  const onJump: HistoryJump | undefined =
    props.onJump ?? (causal ? (to, focus) => causal.setVersion(to, { focus }) : undefined);
  return { dataset, version, onJump };
}

/**
 * A node's history across the dataset's versions: where it started or was added, each rename,
 * merge and split, and where it was removed. Choosing a version moves there, with the node
 * selected as it is in that version. Renders nothing for a dataset with one version.
 */
export function NodeHistory({ nodeId, ...props }: HistoryProps & { nodeId: string }) {
  const labels = useCausalLabels();
  const { dataset, version, onJump } = useHistoryContext(props, "NodeHistory");
  const entries = useMemo(() => {
    const known = dataset.snapshots.find(({ id }) => id === version)?.nodes.some(({ id }) => id === nodeId);
    return dataset.snapshots.length > 1 && known ? nodeHistory(dataset, version, nodeId) : [];
  }, [dataset, version, nodeId]);
  if (entries.length === 0) return null;
  return (
    <HistoryList
      title={labels.historyOf(nodeId)}
      entries={entries}
      version={version}
      describe={(entry) => describeNode(entry, labels)}
      // The node as it is there; a removed one leaves nothing to select
      focusOf={(entry) => ({ node: entry.nodes[0]?.id })}
      onJump={onJump}
      className={props.className ?? ""}
    />
  );
}

/**
 * A link's history across the dataset's versions, following both its ends through renames and
 * merges: where it started or was added, each polarity flip, and where it was removed. Choosing a
 * version moves there, with the link selected. Renders nothing for a dataset with one version.
 */
export function LinkHistory({ linkId, ...props }: HistoryProps & { linkId: string }) {
  const labels = useCausalLabels();
  const { dataset, version, onJump } = useHistoryContext(props, "LinkHistory");
  const entries = useMemo(() => {
    const known = dataset.snapshots.find(({ id }) => id === version)?.edges.some(({ id }) => id === linkId);
    return dataset.snapshots.length > 1 && known ? linkHistory(dataset, version, linkId) : [];
  }, [dataset, version, linkId]);
  if (entries.length === 0) return null;
  return (
    <HistoryList
      title={labels.historyOf(linkId)}
      entries={entries}
      version={version}
      describe={(entry) => describeLink(entry, labels)}
      focusOf={(entry) => ({ link: entry.links[0]?.id })}
      onJump={onJump}
      className={props.className ?? ""}
    />
  );
}
