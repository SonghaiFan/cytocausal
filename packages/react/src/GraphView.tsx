"use client";
import type { CausalDataset, CausalNode } from "@cytocausal/core";
import {
  getCounterparts,
  isTransitioning,
  placeAround,
  snapshotPositions,
  toElements,
  transitionToSnapshot,
  type Positions,
} from "@cytocausal/cytoscape";
import cytoscape, { type Core, type LayoutOptions, type Layouts, type Stylesheet } from "cytoscape";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export type PositionCache = RefObject<Record<string, Positions>>;

export interface GraphViewProps {
  dataset: CausalDataset;
  snapshotId: string;
  layout: LayoutOptions;
  stylesheet: Stylesheet[];
  /** Shared between views, so every view of a snapshot agrees. */
  positionCache: PositionCache;
  /** Animate between snapshots of a dataset instead of rebuilding the graph. */
  animateSnapshots?: boolean;
  /** Skip the layout, staying hidden until `anchorPositions` arrive. */
  waitForAnchors?: boolean;
  anchorPositions?: Positions;
  onLayoutComplete?: (positions: Positions) => void;
  /** Gives access to each new Cytoscape instance, for custom interaction. */
  onReady?: (cy: Core) => void;
  renderTooltip?: (node: CausalNode) => ReactNode;
  className?: string;
}

const cacheKeyOf = (dataset: string, layout: LayoutOptions, snapshot: string) =>
  `${dataset}:${layout.name}:${snapshot}`;

export function GraphView({
  dataset,
  snapshotId,
  layout,
  stylesheet,
  positionCache,
  animateSnapshots = false,
  waitForAnchors = false,
  anchorPositions,
  onLayoutComplete,
  onReady,
  renderTooltip,
  className,
}: GraphViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const anchoredLayout = useRef<Layouts | null>(null);
  const shown = useRef<{ dataset: string; layout: LayoutOptions; snapshot: string } | null>(null);
  const [tooltip, setTooltip] = useState<{ node: CausalNode; x: number; y: number } | null>(null);

  const snapshot = useMemo(
    () => dataset.snapshots.find(({ id }) => id === snapshotId)!,
    [dataset, snapshotId],
  );
  const cacheKey = cacheKeyOf(dataset.id, layout, snapshotId);

  // Listeners outlive a snapshot change, so they read the latest values
  const latest = useRef({ cacheKey, snapshot, onLayoutComplete, onReady });
  useEffect(() => {
    latest.current = { cacheKey, snapshot, onLayoutComplete, onReady };
  });

  const rememberPositions = useCallback(() => {
    if (cy.current && !cy.current.destroyed()) {
      positionCache.current[latest.current.cacheKey] = snapshotPositions(
        cy.current,
        latest.current.snapshot,
      );
    }
  }, [positionCache]);

  useEffect(() => {
    const current = shown.current;
    if (
      animateSnapshots &&
      cy.current &&
      current?.dataset === dataset.id &&
      current.layout === layout &&
      current.snapshot !== snapshotId
    ) {
      setTooltip(null);
      transitionToSnapshot(cy.current, snapshot, {
        counterparts: getCounterparts(dataset, current.snapshot, snapshotId),
        positions: positionCache.current[cacheKey],
        onSettled: rememberPositions,
      });
      shown.current = { dataset: dataset.id, layout, snapshot: snapshotId };
      return;
    }

    cy.current?.destroy();
    setTooltip(null);

    // A first render has no earlier state to move from, so nothing animates
    const known = positionCache.current[cacheKey];
    const initialLayout: LayoutOptions = waitForAnchors
      ? { name: "grid" }
      : animateSnapshots && known
        ? ({ name: "preset", positions: known, fit: true, padding: 30 } as LayoutOptions)
        : ({ ...layout, animate: false } as LayoutOptions);

    container.current!.style.visibility = waitForAnchors ? "hidden" : "visible";

    const { nodes, edges } = toElements(snapshot);
    const instance = cytoscape({
      container: container.current,
      elements: [...nodes, ...edges],
      style: stylesheet,
      layout: { name: "preset" },
    });
    cy.current = instance;

    const showTooltip = (id: string, event: MouseEvent) => {
      const node = latest.current.snapshot.nodes.find((candidate) => candidate.id === id);
      if (node) setTooltip({ node, x: event.clientX, y: event.clientY });
    };
    const hideTooltip = () => setTooltip(null);

    instance.on("mouseover mousemove", "node", (event) =>
      showTooltip(event.target.id(), event.originalEvent as MouseEvent),
    );
    instance.on("mouseout", "node", hideTooltip);
    instance.on("zoom pan drag", hideTooltip);
    instance.on("tap", (event) => {
      if (event.target === instance) hideTooltip();
    });
    instance.on("click", "node", (event) => {
      instance.elements().removeClass("selected");
      event.target.addClass("selected");
    });

    const initial = instance.layout(initialLayout);
    if (!waitForAnchors) {
      initial.one("layoutstop", () => {
        if (instance.destroyed() || isTransitioning(instance)) return;
        rememberPositions();
        latest.current.onLayoutComplete?.(snapshotPositions(instance, latest.current.snapshot));
      });
    }
    initial.run();
    latest.current.onReady?.(instance);
    shown.current = { dataset: dataset.id, layout, snapshot: snapshotId };
    // cacheKey follows dataset, layout and snapshotId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dataset,
    snapshot,
    snapshotId,
    layout,
    stylesheet,
    animateSnapshots,
    waitForAnchors,
    positionCache,
    rememberPositions,
  ]);

  useEffect(() => {
    if (!waitForAnchors || !anchorPositions || !cy.current) return;
    anchoredLayout.current?.stop();
    anchoredLayout.current = placeAround(cy.current, anchorPositions);
    anchoredLayout.current?.one("layoutstop", rememberPositions);
    anchoredLayout.current?.run();
    container.current!.style.visibility = "visible";
  }, [anchorPositions, waitForAnchors, rememberPositions]);

  useEffect(
    () => () => {
      cy.current?.destroy();
      cy.current = null;
      shown.current = null;
    },
    [],
  );

  return (
    <>
      <div ref={container} className={className} style={{ width: "100%", height: "100%" }} />
      {tooltip && renderTooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, calc(-100% - 24px))",
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          {renderTooltip(tooltip.node)}
        </div>
      )}
    </>
  );
}
