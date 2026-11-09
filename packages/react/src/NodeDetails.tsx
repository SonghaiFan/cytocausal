"use client";
import {
  contributorsOf,
  findFeedbackLoops,
  linksInto,
  linksOutOf,
  type NeighbourLinks,
  type LoopOptions,
  type Snapshot,
} from "@cytocausal/core";
import type { Route } from "@cytocausal/cytoscape";
import { useMemo } from "react";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";
import { LoopList } from "./LoopList.tsx";

export interface NodeDetailsProps {
  snapshot?: Snapshot;
  nodeId: string;
  /** Called with a node id when someone chooses a cause or effect. */
  onSelect?: (id: string) => void;
  onClose?: () => void;
  activeRoute?: Route | null;
  onToggleRoute?: (route: Route) => void;
  /** Limits for finding loops through this node. Set these for large graphs. */
  loopOptions?: LoopOptions;
  /** Called with a link id to show that link, such as in `LinkDetails`. */
  onShowLink?: (id: string) => void;
  className?: string;
}

function NodeLinks({
  title,
  kind,
  here,
  neighbours,
  onSelect,
  onShowLink,
}: {
  title: string;
  kind: "cause" | "effect";
  here: string;
  neighbours: NeighbourLinks[];
  onSelect: (id: string) => void;
  onShowLink?: (id: string) => void;
}) {
  const labels = useCausalLabels();
  if (neighbours.length === 0) return null;
  return (
    <div className="cc-block">
      <h4 className={`cc-heading cc-${kind}`}>
        {title} ({neighbours.length})
      </h4>
      <ul className="cc-list">
        {neighbours.map(({ node, links }) => {
          const support = new Set(links.flatMap(contributorsOf)).size;
          const [from, to] = kind === "cause" ? [node.label, here] : [here, node.label];
          return (
            <li key={node.id} className="cc-neighbour">
              <button type="button" className="cc-row" onClick={() => onSelect(node.id)}>
                {node.label}
                {support > 0 && (
                  <span className="cc-support" title={labels.support(support)} aria-hidden="true">
                    {support}
                  </span>
                )}
              </button>
              {onShowLink && (
                <button
                  type="button"
                  className="cc-link"
                  aria-label={`${labels.showLink}: ${from} → ${to}${support > 0 ? `, ${labels.support(support).toLowerCase()}` : ""}`}
                  onClick={() => onShowLink(links[0].id)}
                >
                  {labels.link}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Shows a node's causes, effects, loops and evidence. */
export function NodeDetails({
  snapshot: given,
  nodeId,
  onSelect: chosen,
  onClose: closed,
  activeRoute,
  onToggleRoute,
  loopOptions,
  onShowLink: showLink,
  className = "",
}: NodeDetailsProps) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const snapshot = required(given ?? causal?.snapshot, "NodeDetails", "snapshot");
  const onSelect = required(chosen ?? causal?.graph.focus, "NodeDetails", "onSelect");
  const onClose = closed ?? (() => causal?.graph.toggle(nodeId));
  const onShowLink = showLink ?? causal?.graph.toggleLink;
  const node = snapshot.nodes.find(({ id }) => id === nodeId);
  const search = useMemo(
    () => findFeedbackLoops(snapshot, { ...loopOptions, through: nodeId }),
    [snapshot, nodeId, loopOptions],
  );
  if (!node) return null;
  const evidence = (node.evidence ?? []).filter(({ text }) => text);

  return (
    <section className={`cc-panel ${className}`} aria-label={`Node ${node.id}`}>
      <div className="cc-spread">
        <div>
          <p className="cc-muted">
            {labels.node} {node.id}
          </p>
          <h3 className="cc-heading">{node.label}</h3>
        </div>
        <button
          type="button"
          className="cc-close"
          aria-label={`${labels.close} ${node.id}`}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <NodeLinks
        title={labels.causedBy}
        kind="cause"
        here={node.label}
        neighbours={linksInto(snapshot, nodeId)}
        onSelect={onSelect}
        onShowLink={onShowLink}
      />
      <NodeLinks
        title={labels.leadsTo}
        kind="effect"
        here={node.label}
        neighbours={linksOutOf(snapshot, nodeId)}
        onSelect={onSelect}
        onShowLink={onShowLink}
      />
      {onToggleRoute && search.loops.length > 0 && (
        <LoopList
          bare
          className="cc-block"
          snapshot={snapshot}
          loops={search.loops}
          complete={search.complete}
          active={activeRoute}
          onToggle={onToggleRoute}
        />
      )}
      {evidence.length > 0 && (
        <div className="cc-block">
          <h4 className="cc-heading">
            {labels.evidence} ({evidence.length})
          </h4>
          <ul className="cc-list cc-evidence">
            {evidence
              .filter(({ text }) => text)
              .map(({ id, text, contributor }, index) => (
                <li key={`${id}-${index}`}>
                  {text}
                  {contributor && <span className="cc-support">{contributor}</span>}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
