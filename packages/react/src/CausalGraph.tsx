"use client";
import type { CausalNode } from "@cytocausal/core";
import type { ReactNode } from "react";
import { useCausal } from "./CausalProvider.tsx";
import { NodeTooltip, ZoomControls } from "./controls.tsx";
import { GraphView } from "./GraphView.tsx";
import { useCausalLabels } from "./labels.tsx";

const defaultTooltip = (node: CausalNode) => <NodeTooltip node={node} />;

/** The graph of a `CausalProvider`, with zoom buttons. Children sit on top of the graph. */
export function CausalGraph({
  renderTooltip = defaultTooltip,
  maxZoom,
  className = "",
  children,
}: {
  renderTooltip?: (node: CausalNode) => ReactNode;
  /** Raise this on large graphs, so people can zoom in to read them. */
  maxZoom?: number;
  className?: string;
  children?: ReactNode;
}) {
  const labels = useCausalLabels();
  const { dataset, version, layout, stylesheet, theme, positionCache, graph } = useCausal();
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
        renderTooltip={renderTooltip}
        onReady={(instance) => {
          graph.attach(instance);
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
