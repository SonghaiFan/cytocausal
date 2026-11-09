"use client";
import {
  contributorsOf,
  supportOf,
  type CausalEdge,
  type Evidence,
  type Snapshot,
} from "@cytocausal/core";
import type { ReactNode } from "react";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels, type CausalLabels } from "./labels.tsx";

const labelOf = (snapshot: Snapshot, id: string) =>
  snapshot.nodes.find((node) => node.id === id)?.label ?? id;

const polarityName = (labels: CausalLabels, link: CausalEdge) =>
  link.polarity ? labels[link.polarity] : null;

/** Evidence grouped by who gave it. Evidence with no contributor comes last. */
function byContributor(evidence: Evidence[] = []) {
  const groups = new Map<string, string[]>();
  for (const { contributor = "", text } of evidence) {
    if (!groups.has(contributor)) groups.set(contributor, []);
    if (text) groups.get(contributor)!.push(text);
  }
  return [...groups].sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1));
}

/** Who stated one link between two nodes, and what they said. */
function Statement({ link, labels }: { link: CausalEdge; labels: CausalLabels }) {
  const groups = byContributor(link.evidence);
  return (
    <div className="cc-block">
      <h4 className="cc-heading">
        {polarityName(labels, link) && (
          <span className="cc-badge">{polarityName(labels, link)}</span>
        )}
        {labels.support(supportOf(link))}
      </h4>
      {groups.length > 0 && (
        <ul className="cc-list" aria-label={labels.statedBy}>
          {groups.map(([contributor, texts]) => (
            <li key={contributor} className="cc-statement">
              {contributor && <strong>{contributor}</strong>}
              {texts.length > 0 && (
                <ul className="cc-evidence">
                  {texts.map((text, index) => (
                    <li key={index}>{text}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Shows who stated a link and on what grounds. Other links between the same two nodes are shown
 * too, so a disagreement on polarity is visible. Outside a provider, pass `snapshot`, `linkId`
 * and `onSelect`.
 */
export function LinkDetails({
  snapshot: given,
  linkId: chosen,
  onSelect: selectNode,
  onClose: closed,
  className = "",
}: {
  snapshot?: Snapshot;
  linkId?: string;
  /** Called with a node id when someone chooses one end of the link. */
  onSelect?: (id: string) => void;
  onClose?: () => void;
  className?: string;
}): ReactNode {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const snapshot = required(given ?? causal?.snapshot, "LinkDetails", "snapshot");
  const linkId = chosen ?? causal?.graph.selectedLink;
  const onSelect = required(selectNode ?? causal?.graph.focus, "LinkDetails", "onSelect");
  const onClose = closed ?? (() => causal?.graph.clear());
  const link = snapshot.edges.find(({ id }) => id === linkId);
  if (!link) return null;

  const between = snapshot.edges.filter(
    ({ source, target }) => source === link.source && target === link.target,
  );
  // The chosen link first, then any that disagree with it
  const statements = [link, ...between.filter((other) => other !== link)];

  return (
    <section className={`cc-panel ${className}`} aria-label={`${labels.link} ${link.id}`}>
      <div className="cc-spread">
        <div>
          <p className="cc-muted">{labels.link}</p>
          <h3 className="cc-heading">
            <button type="button" className="cc-link cc-end" onClick={() => onSelect(link.source)}>
              {labelOf(snapshot, link.source)}
            </button>
            {" → "}
            <button type="button" className="cc-link cc-end" onClick={() => onSelect(link.target)}>
              {labelOf(snapshot, link.target)}
            </button>
          </h3>
        </div>
        <button
          type="button"
          className="cc-close"
          aria-label={`${labels.close} ${labels.link.toLowerCase()}`}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {statements.length > 1 && <p className="cc-muted">{labels.disagreement}</p>}
      {statements.map((item) => (
        <Statement key={item.id} link={item} labels={labels} />
      ))}
    </section>
  );
}

/** A hover preview of a link: its ends and who stated it. */
export function LinkTooltip({ link, snapshot }: { link: CausalEdge; snapshot: Snapshot }) {
  const labels = useCausalLabels();
  const contributors = contributorsOf(link);
  return (
    <div className="cc-tooltip">
      <strong>
        {labelOf(snapshot, link.source)} → {labelOf(snapshot, link.target)}
      </strong>
      {contributors.length > 0 && (
        <p className="cc-muted">
          {labels.support(contributors.length)}: {contributors.join(", ")}
        </p>
      )}
    </div>
  );
}
