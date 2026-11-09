"use client";
import {
  getSnapshot,
  type CausalDataset,
  type CausalEdge,
  type CausalNode,
  type Snapshot,
} from "@cytocausal/core";
import {
  autoLayout,
  createCausalStyle,
  fitNodes,
  getCounterparts,
  isTransitioning,
  lightTheme,
  placeAround,
  refreshLabels,
  relayout,
  snapshotPositions,
  toElements,
  transitionToSnapshot,
  type CausalMotion,
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
  /**
   * Defaults to an automatic layout. A new object rebuilds the graph, so define it outside your
   * component or memoise it.
   */
  layout?: LayoutOptions;
  /** Changing this restyles the graph in place, so nodes stay where they are. */
  stylesheet?: Stylesheet[];
  motion?: CausalMotion;
  /** Stops small graphs being blown up to fill the screen. */
  maxZoom?: number;
  /** Pass one to several views, so every view of a snapshot agrees. */
  positionCache?: PositionCache;
  /** Animate between snapshots of a dataset instead of rebuilding the graph. */
  animateSnapshots?: boolean;
  /**
   * Move nodes into a new `layout` instead of rebuilding the graph. Positions each layout gave
   * are kept, so switching back returns every node to where it was.
   */
  animateLayouts?: boolean;
  /** Skip the layout, staying hidden until `anchorPositions` arrive. */
  waitForAnchors?: boolean;
  anchorPositions?: Positions;
  onLayoutComplete?: (positions: Positions) => void;
  /** Gives access to each new Cytoscape instance, for custom interaction. */
  onReady?: (cy: Core) => void;
  renderTooltip?: (node: CausalNode) => ReactNode;
  /** A hover preview for links, such as who stated them. */
  renderLinkTooltip?: (link: CausalEdge, snapshot: Snapshot) => ReactNode;
  className?: string;
}

type Tooltip = { x: number; y: number } & (
  | { node: CausalNode; link?: undefined }
  | { link: CausalEdge; node?: undefined }
);

const defaultStylesheet = createCausalStyle(lightTheme);

// Two layouts can share a name, such as concentric by centrality and by degree, so each
// layout object gets its own key. Keep layouts stable between renders for the cache to work
const layoutIds = new WeakMap<LayoutOptions, number>();
let nextLayoutId = 1;
const layoutKey = (layout: LayoutOptions) => {
  if (!layoutIds.has(layout)) layoutIds.set(layout, nextLayoutId++);
  return `${layout.name}#${layoutIds.get(layout)}`;
};

const cacheKeyOf = (dataset: string, layout: LayoutOptions, snapshot: string) =>
  `${dataset}:${layoutKey(layout)}:${snapshot}`;

export function GraphView({
  dataset,
  snapshotId,
  layout = autoLayout,
  stylesheet = defaultStylesheet,
  motion,
  maxZoom = 2,
  positionCache: sharedCache,
  animateSnapshots = false,
  animateLayouts = false,
  waitForAnchors = false,
  anchorPositions,
  onLayoutComplete,
  onReady,
  renderTooltip,
  renderLinkTooltip,
  className,
}: GraphViewProps) {
  const ownCache = useRef<Record<string, Positions>>({});
  const positionCache = sharedCache ?? ownCache;
  const container = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const anchoredLayout = useRef<Layouts | null>(null);
  const shown = useRef<{ dataset: string; layout: LayoutOptions; snapshot: string } | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const snapshot = useMemo(
    () => getSnapshot(dataset, snapshotId),
    [dataset, snapshotId],
  );
  const cacheKey = cacheKeyOf(dataset.id, layout, snapshotId);

  // Listeners outlive a snapshot change, so they read the latest values
  const latest = useRef({ cacheKey, snapshot, stylesheet, motion, onLayoutComplete, onReady });
  useEffect(() => {
    latest.current = { cacheKey, snapshot, stylesheet, motion, onLayoutComplete, onReady };
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
      animateLayouts &&
      !waitForAnchors &&
      cy.current &&
      current?.dataset === dataset.id &&
      current.snapshot === snapshotId &&
      current.layout !== layout
    ) {
      setTooltip(null);
      // A saved layout returns nodes to the positions in the data
      const saved =
        layout.name === "preset" && snapshot.nodes.every(({ position }) => position)
          ? Object.fromEntries(snapshot.nodes.map(({ id, position }) => [id, position!]))
          : undefined;
      relayout(cy.current, layout, {
        positions: positionCache.current[cacheKey] ?? saved,
        motion: latest.current.motion,
        onSettled: () => {
          rememberPositions();
          if (cy.current) {
            latest.current.onLayoutComplete?.(snapshotPositions(cy.current, latest.current.snapshot));
          }
        },
      });
      shown.current = { dataset: dataset.id, layout, snapshot: snapshotId };
      return;
    }
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
        motion: latest.current.motion,
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
      style: latest.current.stylesheet,
      layout: { name: "preset" },
      maxZoom,
    });
    cy.current = instance;

    const showTooltip = (id: string, event: MouseEvent) => {
      const node = latest.current.snapshot.nodes.find((candidate) => candidate.id === id);
      if (node) setTooltip({ node, x: event.clientX, y: event.clientY });
    };
    const showLinkTooltip = (id: string, event: MouseEvent) => {
      const link = latest.current.snapshot.edges.find((candidate) => candidate.id === id);
      if (link) setTooltip({ link, x: event.clientX, y: event.clientY });
    };
    const hideTooltip = () => setTooltip(null);

    instance.on("mouseover mousemove", "node", (event) =>
      showTooltip(event.target.id(), event.originalEvent as MouseEvent),
    );
    instance.on("mouseover mousemove", "edge", (event) =>
      showLinkTooltip(event.target.id(), event.originalEvent as MouseEvent),
    );
    instance.on("mouseout", "node, edge", hideTooltip);
    instance.on("zoom pan drag", hideTooltip);
    instance.on("tap", (event) => {
      if (event.target === instance) hideTooltip();
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
    maxZoom,
    animateSnapshots,
    animateLayouts,
    waitForAnchors,
    positionCache,
    rememberPositions,
  ]);

  useEffect(() => {
    if (!cy.current) return;
    cy.current.style(stylesheet as unknown as Stylesheet);
    // A new style can change node sizes, such as a different zoom mode, so labels move with them
    refreshLabels(cy.current);
  }, [stylesheet]);

  // Keeps the graph in view when its space changes, such as on rotating a phone
  useEffect(() => {
    let previous = "";
    const observer = new ResizeObserver(([{ contentRect }]) => {
      const size = `${contentRect.width}x${contentRect.height}`;
      if (previous && previous !== size && cy.current && !cy.current.destroyed()) {
        cy.current.resize();
        fitNodes(cy.current);
      }
      previous = size;
    });
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);

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
      {tooltip && (tooltip.node ? renderTooltip : renderLinkTooltip) && (
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
          {tooltip.node
            ? renderTooltip!(tooltip.node)
            : renderLinkTooltip!(tooltip.link, latest.current.snapshot)}
        </div>
      )}
    </>
  );
}
