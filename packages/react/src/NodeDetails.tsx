"use client";
import {
  causesOf,
  effectsOf,
  findFeedbackLoops,
  type CausalNode,
  type FeedbackLoop,
  type LoopOptions,
  type Snapshot,
} from "@cytocausal/core";
import type { Route } from "@cytocausal/cytoscape";
import { useMemo } from "react";
import { useCausalLabels } from "./labels.tsx";
import { LoopList } from "./LoopList.tsx";

export interface NodeDetailsProps {
  snapshot: Snapshot;
  nodeId: string;
  /** Called with a node id when someone chooses a cause or effect. */
  onSelect: (id: string) => void;
  onClose: () => void;
  activeLoop?: Route | null;
  onToggleLoop?: (loop: FeedbackLoop) => void;
  /** Limits for finding loops through this node. Set these for large graphs. */
  loopOptions?: LoopOptions;
  className?: string;
}

function NodeLinks({
  title,
  kind,
  nodes,
  onSelect,
}: {
  title: string;
  kind: "cause" | "effect";
  nodes: CausalNode[];
  onSelect: (id: string) => void;
}) {
  if (nodes.length === 0) return null;
  return (
    <div className="cc-block">
      <h4 className={`cc-heading cc-${kind}`}>
        {title} ({nodes.length})
      </h4>
      <ul className="cc-list">
        {nodes.map(({ id, label }) => (
          <li key={id}>
            <button type="button" className="cc-row" onClick={() => onSelect(id)}>
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shows a node's causes, effects, loops and evidence. */
export function NodeDetails({
  snapshot,
  nodeId,
  onSelect,
  onClose,
  activeLoop,
  onToggleLoop,
  loopOptions,
  className = "",
}: NodeDetailsProps) {
  const labels = useCausalLabels();
  const node = snapshot.nodes.find(({ id }) => id === nodeId);
  const search = useMemo(
    () => findFeedbackLoops(snapshot, { ...loopOptions, through: nodeId }),
    [snapshot, nodeId, loopOptions],
  );
  if (!node) return null;
  const evidence = node.evidence ?? [];

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
        nodes={causesOf(snapshot, nodeId)}
        onSelect={onSelect}
      />
      <NodeLinks
        title={labels.leadsTo}
        kind="effect"
        nodes={effectsOf(snapshot, nodeId)}
        onSelect={onSelect}
      />
      {onToggleLoop && search.loops.length > 0 && (
        <LoopList
          bare
          className="cc-block"
          snapshot={snapshot}
          loops={search.loops}
          complete={search.complete}
          active={activeLoop}
          onToggle={onToggleLoop}
        />
      )}
      {evidence.length > 0 && (
        <div className="cc-block">
          <h4 className="cc-heading">
            {labels.evidence} ({evidence.length})
          </h4>
          <ul className="cc-list cc-evidence">
            {evidence.map(({ id, text }, index) => (
              <li key={`${id}-${index}`}>{text}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
