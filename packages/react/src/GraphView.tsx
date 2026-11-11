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
  fcoseLayout,
  createCausalStyle,
  fitNodes,
  followNodes,
  isTransitioning,
  lightTheme,
  placeAround,
  curveLinks,
  refreshLabels,
  relayout,
  cancelRelayout,
  snapshotPositions,
  toElements,
  transitionToSnapshot,
  type CausalMotion,
  type Positions,
} from "@cytocausal/cytoscape";
import { layoutJob, startLayoutWorker, WORKER_LAYOUT_THRESHOLD } from "./layout-worker.ts";
import cytoscape, { type Core, type LayoutOptions, type Layouts, type Stylesheet } from "cytoscape";
import { menuArea, menuPointing, placementTransform, tooltipPlacement, type TooltipPlacement } from "./overlay.ts";
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
  /**
   * How long the pointer rests on a node or link before its tooltip shows, in milliseconds, so
   * sweeping across the graph doesn't flash tooltips. Defaults to 300.
   */
  tooltipDelay?: number;
  className?: string;
}

type Tooltip = { x: number; y: number; placement: TooltipPlacement } & (
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
  tooltipDelay = 300,
  className,
}: GraphViewProps) {
  const ownCache = useRef<Record<string, Positions>>({});
  const positionCache = sharedCache ?? ownCache;
  const container = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const anchoredLayout = useRef<Layouts | null>(null);
  const shown = useRef<{ dataset: string; layout: LayoutOptions; snapshot: string } | null>(null);
  const [layoutStatus, setLayoutStatus] = useState<"loading" | "ready" | "error" | "cancelled">("loading");
  const cancelJob = useRef<(() => void) | null>(null);
  const [retry, setRetry] = useState(0);
  const [instanceVersion, setInstanceVersion] = useState(0);
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
      curveLinks(cy.current);
      positionCache.current[latest.current.cacheKey] = snapshotPositions(
        cy.current,
        latest.current.snapshot,
      );
    }
  }, [positionCache]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeLayout: Layouts | null = null;
    let workerJob: ReturnType<typeof startLayoutWorker> | null = null;
    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      workerJob?.cancel(); workerJob = null;
      if (cy.current && !cy.current.destroyed()) cancelRelayout(cy.current);
      activeLayout?.stop();
    };
    cancelJob.current = () => { stop(); setLayoutStatus("cancelled"); };
    const calculate = (instance: Core, options: LayoutOptions): Promise<Positions | undefined> => {
      if (options.name === "preset" || instance.nodes(":visible").length < WORKER_LAYOUT_THRESHOLD) return Promise.resolve(undefined);
      workerJob = startLayoutWorker(layoutJob(instance, options));
      return workerJob.promise.finally(() => { workerJob = null; });
    };
    const finish = () => { if (!cancelled) setLayoutStatus("ready"); };
    setLayoutStatus("loading");
    setTooltip(null);
    const run = async () => {
      if (cancelled) return;
      try {
        const current = shown.current;
        if (
          animateLayouts &&
          !waitForAnchors &&
          cy.current &&
          current?.dataset === dataset.id &&
          current.snapshot === snapshotId &&
          (current.layout !== layout || retry > 0)
        ) {
          setTooltip(null);
          // A saved layout returns nodes to the positions in the data
          const saved =
            layout.name === "preset" && snapshot.nodes.every(({ position }) => position)
              ? Object.fromEntries(snapshot.nodes.map(({ id, position }) => [id, position!]))
              : undefined;
          const instance = cy.current;
          const positions = positionCache.current[cacheKey] ?? saved ?? await calculate(instance, layout);
          if (cancelled || instance.destroyed()) return;
          activeLayout = relayout(instance, layout, {
            positions,
            motion: latest.current.motion,
            onSettled: () => {
              if (cancelled) return;
              finish();
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
          let positions: Positions | undefined = positionCache.current[cacheKey];
          if (!positions && snapshot.nodes.length >= WORKER_LAYOUT_THRESHOLD) {
            const elements = toElements(snapshot);
            const probe = cytoscape({ headless: true, styleEnabled: true, elements: [...elements.nodes, ...elements.edges], style: latest.current.stylesheet, layout: { name: "preset" } });
            try {
              positions = await calculate(probe, { ...layout, boundingBox: { x1: 0, y1: 0, w: cy.current.width(), h: cy.current.height() } } as LayoutOptions);
            } finally { probe.destroy(); }
            if (cancelled) return;
          }
          transitionToSnapshot(cy.current, snapshot, {
            counterparts: followNodes(dataset, current.snapshot, snapshotId),
            positions,
            motion: latest.current.motion,
            onSettled: () => { if (!cancelled) { rememberPositions(); finish(); } },
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
        setInstanceVersion(value => value + 1);

        // Tooltips wait for the pointer to rest, keep out of the radial menu's way, and give way to it
        // over the selected node. Touch screens have no hover, so they show none
        const touch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
        let waiting: ReturnType<typeof setTimeout> | undefined;
        let resting = false;
        const placeTooltip = (kind: "node" | "link", event: cytoscape.EventObject) => {
          const id = event.target.id();
          const original = event.originalEvent as MouseEvent;
          const pointer = { x: original.clientX, y: original.clientY };
          // Around the radial menu, its caption names where pointing leads, and the faded backdrop
          // behind it says nothing
          const pointing = menuPointing(instance, event.target, event.renderedPosition);
          if (pointing.leadsTo || pointing.backdrop) return setTooltip(null);
          const placement = tooltipPlacement(menuArea(instance), pointer, kind === "node" ? id : undefined);
          const { nodes, edges } = latest.current.snapshot;
          const node = kind === "node" ? nodes.find((candidate) => candidate.id === id) : undefined;
          const link = kind === "link" ? edges.find((candidate) => candidate.id === id) : undefined;
          if (!placement || (!node && !link)) return setTooltip(null);
          setTooltip(node ? { node, ...pointer, placement } : { link: link!, ...pointer, placement });
        };
        const point = (kind: "node" | "link") => (event: cytoscape.EventObject) => {
          if (touch) return;
          if (resting) return placeTooltip(kind, event);
          clearTimeout(waiting);
          waiting = setTimeout(() => {
            resting = true;
            placeTooltip(kind, event);
          }, tooltipDelay);
        };
        const hideTooltip = () => {
          clearTimeout(waiting);
          resting = false;
          setTooltip(null);
        };

        instance.on("mouseover mousemove", "node", point("node"));
        instance.on("mouseover mousemove", "edge", point("link"));
        instance.on("mouseout", "node, edge", hideTooltip);
        instance.on("zoom pan drag", hideTooltip);
        // A dragged node changes its links' lengths, so their bends follow
        instance.on("free", "node", () => curveLinks(instance));
        // A committed click hands feedback to the selection/menu, never an old tooltip.
        instance.on("tap", hideTooltip);

        // Attach before awaiting the worker so the existing UI can cancel or switch layouts.
        latest.current.onReady?.(instance);
        shown.current = { dataset: dataset.id, layout, snapshot: snapshotId };
        const positions = !waitForAnchors ? await calculate(instance, initialLayout) : undefined;
        if (cancelled || instance.destroyed()) return;
        const initial = instance.layout(positions ? { name: "preset", positions, fit: true, padding: 30, animate: false } as LayoutOptions : initialLayout);
        activeLayout = initial;
        if (!waitForAnchors) {
          initial.one("layoutstop", () => {
            if (cancelled || instance.destroyed() || isTransitioning(instance)) return;
            finish();
            rememberPositions();
            latest.current.onLayoutComplete?.(snapshotPositions(instance, latest.current.snapshot));
          });
        }
        initial.run();
      } catch (error) {
        if (!cancelled) {
          console.error("Graph layout failed", error);
          shown.current = null;
          setLayoutStatus("error");
        }
      }
    };
    // Give React's status update a paint before a synchronous layout starts.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => { timer = setTimeout(run, 0); });
    });
    return () => { stop(); cancelJob.current = null; };
    // cacheKey follows dataset, layout and snapshotId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    retry,
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
    const instance = cy.current;
    if (!instance) return;
    const request = () => { delete positionCache.current[latest.current.cacheKey]; setRetry(value => value + 1); };
    instance.on("cytocausal-layout-request", request);
    return () => { if (!instance.destroyed()) instance.removeListener("cytocausal-layout-request", request); };
  }, [instanceVersion, positionCache]);

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
    const instance = cy.current;
    let cancelled = false;
    let worker: ReturnType<typeof startLayoutWorker> | null = null;
    anchoredLayout.current?.stop();
    const done = () => { if (!cancelled) { rememberPositions(); setLayoutStatus("ready"); } };
    const stop = () => { cancelled = true; worker?.cancel(); anchoredLayout.current?.stop(); };
    const arrange = async () => {
      try {
        setLayoutStatus("loading");
        if (instance.nodes().length >= WORKER_LAYOUT_THRESHOLD) {
          const fixedNodeConstraint = Object.entries(anchorPositions).filter(([id]) => instance.getElementById(id).length).map(([nodeId, position]) => ({ nodeId, position }));
          worker = startLayoutWorker(layoutJob(instance, { ...fcoseLayout, fixedNodeConstraint } as unknown as LayoutOptions));
          const positions = await worker.promise;
          worker = null;
          if (cancelled || instance.destroyed()) return;
          anchoredLayout.current = instance.layout({ name: "preset", positions, fit: true, padding: 30 });
        } else anchoredLayout.current = placeAround(instance, anchorPositions);
        anchoredLayout.current?.one("layoutstop", done);
        anchoredLayout.current?.run();
        if (!anchoredLayout.current) done();
        container.current!.style.visibility = "visible";
      } catch (error) { if (!cancelled) { console.error("Anchored layout failed", error); setLayoutStatus("error"); } }
    };
    cancelJob.current = () => { stop(); setLayoutStatus("cancelled"); };
    void arrange();
    return stop;
  }, [anchorPositions, waitForAnchors, rememberPositions, instanceVersion]);

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
      <div ref={container} className={className} aria-busy={layoutStatus === "loading"}
        style={{ width: "100%", height: "100%", pointerEvents: layoutStatus === "loading" ? "none" : undefined }} />
      {layoutStatus !== "ready" && <div className="cc-layout-status" role={layoutStatus === "error" ? "alert" : "status"}>
        {layoutStatus === "loading" ? <><span className="cc-layout-spinner" aria-hidden="true" /> Arranging graph…
          <button type="button" className="cc-link" onClick={() => cancelJob.current?.()}>Cancel layout</button>
        </> : layoutStatus === "cancelled" ? <>
          Layout cancelled.
          <button type="button" className="cc-link" onClick={() => setRetry(value => value + 1)}>Retry</button>
        </> : <>
          Could not arrange this graph.
          <button type="button" className="cc-link" onClick={() => setRetry(value => value + 1)}>Retry</button>
        </>}
      </div>}
      {tooltip && (tooltip.node ? renderTooltip : renderLinkTooltip) && (
        <div
          className="cc-floating"
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: placementTransform[tooltip.placement],
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
