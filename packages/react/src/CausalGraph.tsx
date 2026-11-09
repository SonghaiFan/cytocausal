"use client";
import { supportOf, type CausalEdge, type CausalNode, type Snapshot } from "@cytocausal/core";
import type { ReactNode } from "react";
import { useCausal } from "./CausalProvider.tsx";
import { NodeTooltip, ZoomControls } from "./controls.tsx";
import { GraphView } from "./GraphView.tsx";
import { useCausalLabels } from "./labels.tsx";
import { LinkTooltip } from "./LinkDetails.tsx";

const defaultTooltip = (node: CausalNode) => <NodeTooltip node={node} />;
// Only links with a known source have anything to add on hover
const defaultLinkTooltip = (link: CausalEdge, snapshot: Snapshot) =>
  supportOf(link) > 0 ? <LinkTooltip link={link} snapshot={snapshot} /> : null;

/** The graph of a `CausalProvider`, with zoom buttons. Children sit on top of the graph. */
export function CausalGraph({
  renderTooltip = defaultTooltip,
  renderLinkTooltip = defaultLinkTooltip,
  maxZoom,
  className = "",
  children,
}: {
  renderTooltip?: (node: CausalNode) => ReactNode;
  renderLinkTooltip?: (link: CausalEdge, snapshot: Snapshot) => ReactNode;
  /** Raise this on large graphs, so people can zoom in to read them. */
  maxZoom?: number;
  className?: string;
  children?: ReactNode;
}) {
  const labels = useCausalLabels();
  const { dataset, version, layout, stylesheet, theme, positionCache, graph, applyFilter } =
    useCausal();
  return (
    <div className={`cc-graph ${className}`}>
      <GraphView
        dataset={dataset}
        snapshotId={version}
        layout={layout}
        stylesheet={stylesheet}
        motion={theme.motion}
        positionCache={positionCache}
        maxZoom={maxZoom}
        animateSnapshots
        animateLayouts
        renderTooltip={renderTooltip}
        renderLinkTooltip={renderLinkTooltip}
        onReady={(instance) => {
          graph.attach(instance);
          applyFilter(instance);
          instance.container()!.setAttribute("aria-label", labels.graph);
        }}
      />
      {children}
      <ZoomControls />
      <p role="status" className="cc-sr-only">
        {graph.announcement}
      </p>
    </div>
  );
}
