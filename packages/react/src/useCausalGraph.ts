"use client";
import {
  fitNodes,
  centerView,
  focusNode,
  highlightCausalNeighbours,
  highlightRoute,
  keepLabelsReadable,
  refreshLabels,
  easeStyles,
  isTransitioning,
  resolveMotion,
  sameRoute,
  zoomBy,
  type CausalMotion,
  type Route,
} from "@cytocausal/cytoscape";
import { selectionPaths } from "./selection-paths.ts";
import type { Core, EventObject } from "cytoscape";
import { useCallback, useEffect, useRef, useState } from "react";
import { menuArea, menuPointing } from "./overlay.ts";

export interface CausalGraphOptions {
  /** Optional selection cap. Unlimited by default. */
  maxSelected?: number;
  /** Select and highlight nodes on tap and hover. Turn off to control selection yourself. */
  selectable?: boolean;
  /** Keep labels from overlapping. Needs `managedLabels` in `createCausalStyle`. */
  readableLabels?: boolean;
  /** Zoom level for `focus`. Without it, the zoom doesn't change. */
  focusZoom?: number;
  /** Nodes to start with selected, such as from a shared link. */
  initialSelected?: string[];
  /** A link to start with selected. It takes the place of `initialSelected`. */
  initialLink?: string | null;
  motion?: CausalMotion;
  /**
   * The most links away a highlight can reach, offered by the step buttons and the radial menu's
   * rings. Defaults to 2, as further than that a dense graph lights up almost everything.
   */
  maxDepth?: number;
}

/**
 * Sparse connections of selected nodes using directed shortest paths.
 * It searches the graph as drawn, so filters apply.
 */
function pathsBetween(cy: Core, selected: string[]): Route {
  const snapshot = {
    id: "shown",
    nodes: cy.nodes(":visible").map((node) => ({ id: node.id(), label: "" })),
    edges: cy.edges(":visible").map((edge) => ({
      id: edge.id(),
      source: edge.source().id(),
      target: edge.target().id(),
    })),
  };
  // Hover updates must not repeat the same pair searches on an unchanged graph.
  const key = JSON.stringify([selected, snapshot.nodes.map(n => n.id), snapshot.edges]);
  const cached = cy.scratch("cytocausal-selection-paths") as { key: string; route: Route } | undefined;
  if (cached?.key === key) return cached.route;
  const found = selectionPaths(snapshot, selected).flatMap(search => search.paths);
  const route = {
    nodes: [...new Set(found.flatMap((path) => path.nodes))],
    edges: [...new Set(found.flatMap((path) => path.edges))],
  };
  cy.scratch("cytocausal-selection-paths", { key, route });
  return route;
}

/**
 * Selection, hover, loop highlighting and view controls for one graph. Pass `attach` to the
 * `onReady` prop of `GraphView`. A loop takes priority over selected nodes, and selected nodes
 * over the hovered one.
 */
export function useCausalGraph({
  maxSelected = Infinity,
  selectable = true,
  readableLabels = false,
  focusZoom,
  initialSelected = [],
  initialLink = null,
  motion,
  maxDepth = 2,
}: CausalGraphOptions = {}) {
  const cy = useRef<Core | null>(null);
  const [selected, setSelected] = useState(initialLink ? [] : initialSelected);
  const [menuVisible, setMenuVisible] = useState(false);
  const [multiSelecting, setMultiSelecting] = useState(false);
  const [selectedLink, setSelectedLink] = useState<string | null>(initialLink);
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [previewedRoute, setPreviewedRoute] = useState<Route | null>(null);
  const [depth, setChosenDepth] = useState(1);
  // A depth past the limit is held to it
  const setDepth = useCallback(
    (steps: number) => {
      setPreviewedDepth(null);
      setChosenDepth(Math.max(1, Math.min(maxDepth, steps)));
    },
    [maxDepth],
  );
  const [previewedDepth, setPreviewedDepth] = useState<number | null>(null);
  // Counts each new Cytoscape instance, so overlays such as the radial menu can follow it
  const [instanceCount, setInstanceCount] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const cursor = useRef<string | null>(null);
  const keyHandler = useRef<((event: KeyboardEvent) => void) | null>(null);

  const latest = useRef({
    selected,
    multiSelecting,
    selectedLink,
    hovered,
    activeRoute,
    previewedRoute,
    depth: previewedDepth ?? depth,
  });

  /** The route that highlights a link, or null if the graph doesn't have it. */
  const routeOf = useCallback((id: string): Route | null => {
    const edge = cy.current?.getElementById(id);
    if (!edge || edge.length === 0 || !edge.isEdge()) return null;
    return { nodes: [edge.source().id(), edge.target().id()], edges: [id] };
  }, []);

  const applyHighlight = useCallback(() => {
    const instance = cy.current;
    if (!instance || instance.destroyed()) return;
    const { selected, hovered, activeRoute, previewedRoute, depth } = latest.current;
    const route = previewedRoute ?? activeRoute;
    const change = () => {
      if (route) {
        highlightCausalNeighbours(instance, []);
        highlightRoute(instance, route);
      } else if (selected.length >= 2) {
        // Union of the chosen shortest connections. Unconnected selected nodes
        // remain bright too; selection is not limited to endpoints of found paths.
        const paths = pathsBetween(instance, selected);
        instance.elements().removeClass("route-node route-link");
        if (paths.edges.length) {
          highlightCausalNeighbours(instance, []);
          highlightRoute(instance, paths);
          instance.batch(() => selected.forEach((id) => instance.getElementById(id).removeClass("dimmed").addClass("focus")));
        } else highlightCausalNeighbours(instance, selected, 0);
      } else {
        instance.elements().removeClass("route-node route-link");
        const ids = selected.length ? selected : hovered ? [hovered] : [];
        highlightCausalNeighbours(instance, ids, depth);
      }
    };
    // A snapshot change is animating these elements already
    if (isTransitioning(instance)) change();
    // Hover follows the pointer immediately. Hundreds of per-element fades are
    // otherwise cancelled and rebuilt at every node crossing (including during drag).
    else easeStyles(instance, change, selected.length === 0 && !route ? 0 : resolveMotion(motion).highlight);
  }, [motion]);

  useEffect(() => {
    latest.current = {
      selected,
      multiSelecting,
      selectedLink,
      hovered,
      activeRoute,
      previewedRoute,
      depth: previewedDepth ?? depth,
    };
    applyHighlight();
  }, [selected, multiSelecting, selectedLink, hovered, activeRoute, previewedRoute, depth, previewedDepth, applyHighlight]);

  const add = useCallback(
    (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id].slice(-maxSelected)),
    [maxSelected],
  );

  // Tracing is a child of a single-node selection, never a parallel selection mode.
  const [tracing, setTracing] = useState(false);
  const tracingNow = useRef(false);
  tracingNow.current = tracing;
  const canTrace = maxSelected > 1;
  const resetPreview = useCallback(() => {
    setHovered(null);
    setPreviewedRoute(null);
    setPreviewedDepth(null);
  }, []);
  const stopTracing = useCallback(() => {
    tracingNow.current = false;
    setTracing(false);
    resetPreview();
  }, [resetPreview]);
  const startTracing = useCallback(() => {
    if (!canTrace || latest.current.selected.length !== 1 || latest.current.selectedLink) return;
    resetPreview();
    setActiveRoute(null);
    tracingNow.current = true;
    setTracing(true);
  }, [canTrace, resetPreview]);

  const selectMultiple = useCallback((ids: string[], toggleOne = false) => {
    setMenuVisible(false);
    stopTracing();
    setMultiSelecting(true);
    setSelectedLink(null);
    setActiveRoute(null);
    setSelected((previous) => {
      if (toggleOne && previous.includes(ids[0])) return previous.filter((id) => id !== ids[0]);
      return ids.reduce((selection, id) => add(selection, id), previous);
    });
  }, [add, stopTracing]);

  // Cytoscape's native selection and the application's selection have one source of truth.
  useEffect(() => {
    const instance = cy.current;
    if (!instance || instance.destroyed()) return;
    instance.batch(() => {
      instance.elements(":selected").unselect();
      selected.forEach((id) => instance.getElementById(id).select());
      if (selectedLink) instance.getElementById(selectedLink).select();
    });
  }, [selected, selectedLink, multiSelecting, tracing, instanceCount]);

  /**
   * Selects a link and highlights it with the nodes it joins, or deselects it. It takes the
   * place of any selected nodes.
   */
  const toggleLink = useCallback(
    (id: string) => {
      stopTracing();
      setMenuVisible(false);
      setMultiSelecting(false);
      const route = latest.current.selectedLink === id ? null : routeOf(id);
      setSelectedLink(route ? id : null);
      setActiveRoute(route);
      if (route) setSelected([]);
    },
    [routeOf, stopTracing],
  );

  /** Selects a node, or deselects it if it's already selected. */
  const toggle = useCallback(
    (id: string) => {
      setSelectedLink(null);
      setActiveRoute(null);
      stopTracing();
      setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : add(ids, id)));
    },
    [add, stopTracing],
  );

  /**
   * Chooses a node. It becomes the only node selected, or is deselected if it was. While tracing
   * paths, or with `add` from code, it joins the selection instead, so the paths between the two
   * can be traced.
   */
  const choose = useCallback(
    (id: string, { add: adding = false }: { add?: boolean } = {}) => {
      // Cancelling endpoint picking at its origin preserves whichever menu state
      // initiated it (held menus close on release; keyboard menus stay open).
      if (!(tracingNow.current && latest.current.selected.length === 1 && latest.current.selected[0] === id)) setMenuVisible(false);
      setMultiSelecting(false);
      const joins = canTrace && (adding || tracingNow.current);
      stopTracing();
      setSelectedLink(null);
      setActiveRoute(null);
      setSelected((ids) => {
        if (joins) return add(ids, id);
        return ids.length === 1 && ids[0] === id && !latest.current.multiSelecting ? [] : [id];
      });
    },
    [add, canTrace, stopTracing],
  );

  /**
   * Selects a node and moves the view to it. It replaces the selection, unless `add` is set or
   * paths are being traced.
   */
  const focus = useCallback(
    (id: string, { add: adding = false }: { add?: boolean } = {}) => {
      // Cancelling endpoint picking at its origin preserves whichever menu state
      // initiated it (held menus close on release; keyboard menus stay open).
      if (!(tracingNow.current && latest.current.selected.length === 1 && latest.current.selected[0] === id)) setMenuVisible(false);
      setMultiSelecting(false);
      const joins = canTrace && (adding || tracingNow.current);
      stopTracing();
      setSelectedLink(null);
      setActiveRoute(null);
      setSelected((ids) => (joins ? add(ids, id) : [id]));
      if (cy.current) {
        focusNode(cy.current, id, { zoom: focusZoom ?? cy.current.zoom(), motion });
      }
    },
    [add, canTrace, focusZoom, motion, stopTracing],
  );

  /**
   * Makes a node the only one selected and centres the view on it, keeping the zoom, so people
   * can walk from node to node.
   */
  const walkTo = useCallback(
    (id: string) => {
      setMenuVisible(true);
      setMultiSelecting(false);
      stopTracing();
      setSelectedLink(null);
      setActiveRoute(null);
      setPreviewedRoute(null);
      setSelected([id]);
      if (cy.current) focusNode(cy.current, id, { zoom: cy.current.zoom(), motion });
    },
    [motion, stopTracing],
  );

  /** Clears the selection and any highlighted loop. */
  const clear = useCallback(() => {
    setMenuVisible(false);
    setMultiSelecting(false);
    stopTracing();
    cursor.current = null;
    cy.current?.nodes().removeClass("keyboard-cursor");
    setSelected([]);
    setSelectedLink(null);
    setActiveRoute(null);
  }, [stopTracing]);

  /** Long-press opens without moving the camera underneath the held pointer. */
  const beginMarking = useCallback((id: string) => {
    stopTracing();
    setMultiSelecting(false);
    setSelectedLink(null);
    setActiveRoute(null);
    setSelected([id]);
    setMenuVisible(true);
  }, [stopTracing]);
  /**
   * Commits a marked direction: the node it leads to becomes the selection, with the route there
   * kept. With `keepOpen`, as in a locked menu, the menu moves to that node instead of closing.
   */
  const finishMarking = useCallback((target: string | null, route: Route | null, steps?: number, { keepOpen = false } = {}) => {
    stopTracing();
    if (!keepOpen) setMenuVisible(false);
    if (target) setSelected([target]);
    setActiveRoute(route);
    if (steps !== undefined) setDepth(steps);
  }, [stopTracing, setDepth]);

  /** Escape leaves the current layer; Clear selection always leaves everything. */
  const dismiss = useCallback(() => {
    if (tracingNow.current) return stopTracing();
    resetPreview();
    if (latest.current.activeRoute && !latest.current.selectedLink) setActiveRoute(null);
    else clear();
  }, [clear, resetPreview, stopTracing]);

  /** Keeps only the selected nodes that pass a test, such as after filtering the graph. */
  const keepSelected = useCallback((test: (id: string) => boolean) => {
    stopTracing();
    setActiveRoute(null);
    setSelected((ids) => ids.filter(test));
  }, [stopTracing]);

  /** Highlights a loop or path, or removes the highlight if it's already showing. */
  const toggleRoute = useCallback((route: Route) => {
    stopTracing();
    setSelectedLink(null);
    setActiveRoute((current) => (sameRoute(current, route) ? null : route));
  }, [stopTracing]);

  const fit = useCallback(() => {
    if (cy.current) fitNodes(cy.current, resolveMotion(motion).view);
  }, [motion]);

  const zoomIn = useCallback(() => {
    if (cy.current) zoomBy(cy.current, 1.5, resolveMotion(motion).view);
  }, [motion]);

  const zoomOut = useCallback(() => {
    if (cy.current) zoomBy(cy.current, 1 / 1.5, resolveMotion(motion).view);
  }, [motion]);

  /** Moves the keyboard cursor to a node, and announces it to screen readers. */
  const moveCursor = useCallback(
    (instance: Core, id: string) => {
      const node = instance.getElementById(id);
      instance.nodes().removeClass("keyboard-cursor");
      node.addClass("keyboard-cursor");
      refreshLabels(instance);
      cursor.current = id;
      setHovered(id);
      setAnnouncement(String(node.data("label")));
      centerView(instance, node.position(), instance.zoom(), resolveMotion(motion).view);
    },
    [motion],
  );

  /** Connects a Cytoscape instance. A rebuilt graph brings a new one. */
  const attach = useCallback(
    (instance: Core) => {
      cy.current = instance;
      setInstanceCount((count) => count + 1);
      if (readableLabels) {
        fitNodes(instance);
        keepLabelsReadable(instance);
      }
      if (selectable) {
        // Plain clicks inspect; Shift gestures multi-select only outside the modal.
        // While the radial menu is open, pointing toward a linked node walks there, and a click
        // on its backdrop elsewhere closes it, like a modal: see menuPointing. A tap sent from
        // code has no position, so it does only what it names
        const tapped = (event: EventObject, own: () => void) => {
          if (instance.scratch("cytocausal-marking-release")) return;
          if (tracingNow.current) {
            if (event.target !== instance && event.target.isNode()) own();
            else stopTracing();
            return;
          }
          const pointing = event.renderedPosition
            ? menuPointing(instance, event.target, event.renderedPosition)
            : { leadsTo: null, backdrop: event.target === instance };
          if (pointing.leadsTo) walkTo(pointing.leadsTo);
          else if (pointing.backdrop || event.target === instance) clear();
          else own();
        };
        instance.on("tap", "node", (event) => tapped(event, () => {
          const shift = (event.originalEvent as MouseEvent | undefined)?.shiftKey;
          if (shift && !menuArea(instance) && !tracingNow.current) selectMultiple([event.target.id()], true);
          else choose(event.target.id());
        }));
        let boxNodes: Set<string> | null = null;
        instance.on("boxstart", (event) => {
          boxNodes = (event.originalEvent as MouseEvent | undefined)?.shiftKey && !menuArea(instance)
            ? new Set() : null;
        });
        instance.on("box", "node", (event) => boxNodes?.add(event.target.id()));
        instance.on("boxend", () => {
          // Cytoscape emits each element's box event after boxend, in the same turn.
          const collected = boxNodes;
          queueMicrotask(() => {
            boxNodes = null;
            if (instance.destroyed()) return;
            // Drop native edge picks and ignored box gestures as well as stale picks.
            instance.elements(":selected").unselect();
            latest.current.selected.forEach((id) => instance.getElementById(id).select());
            if (latest.current.selectedLink) instance.getElementById(latest.current.selectedLink).select();
            if (!instance.destroyed() && collected?.size && !menuArea(instance)) {
              selectMultiple([...collected].sort());
            }
          });
        });
        instance.on("tap", "edge", (event) => tapped(event, () => toggleLink(event.target.id())));
        instance.on("tap", (event) => {
          if (event.target === instance) tapped(event, clear);
        });
        instance.on("mouseover", "node", (event) => {
          const pointing = event.renderedPosition
            ? menuPointing(instance, event.target, event.renderedPosition)
            : { backdrop: false, leadsTo: null };
          setHovered(pointing.backdrop || pointing.leadsTo ? null : event.target.id());
        });
        instance.on("mouseout", "node", () => setHovered(null));
      }
      if (selectable) {
        const container = instance.container()!;
        const onKeyDown = (event: KeyboardEvent) => {
          const modal = menuArea(instance)?.sectors;
          const allowed = modal ? new Set([menuArea(instance)!.node, ...modal.map(({ node }) => node)]) : null;
          const nodes = instance.nodes(":visible").filter((node) => !allowed || allowed.has(node.id())).sort((a, b) => a.id().localeCompare(b.id()));
          const current = cursor.current ? instance.getElementById(cursor.current) : null;
          const here = current?.length && (!allowed || allowed.has(current.id())) ? current : null;
          const index = here ? nodes.toArray().findIndex((node) => node.id() === here.id()) : -1;
          const step = (offset: number) => nodes[(index + offset + nodes.length) % nodes.length];
          const first = allowed
            ? instance.getElementById(menuArea(instance)!.node)
            : instance.nodes(":visible").sort((a, b) => b.degree(false) - a.degree(false)).first();

          const menuOrigin = here?.id() ?? (latest.current.selected.length === 1 ? latest.current.selected[0] : null);
          if ((event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) && menuOrigin) {
            event.preventDefault();
            beginMarking(menuOrigin);
            return;
          }
          let next: { id(): string } | undefined;
          if (event.key === "ArrowRight") next = here ? here.outgoers("node").filter((node) => !allowed || allowed.has(node.id())).first() : first;
          else if (event.key === "ArrowLeft") next = here ? here.incomers("node").filter((node) => !allowed || allowed.has(node.id())).first() : first;
          else if (event.key === "ArrowDown") next = here ? step(1) : first;
          else if (event.key === "ArrowUp") next = here ? step(-1) : first;
          else if ((event.key === "Enter" || event.key === " ") && here) {
            if (allowed && here.id() !== menuArea(instance)!.node) walkTo(here.id());
            else choose(here.id());
          }
          else if (event.key === "Escape") {
            event.stopPropagation();
            dismiss();
          } else return;

          event.preventDefault();
          if (next && "length" in next && next.length === 0) return;
          if (next) moveCursor(instance, next.id());
        };
        if (keyHandler.current) container.removeEventListener("keydown", keyHandler.current);
        keyHandler.current = onKeyDown;
        container.addEventListener("keydown", onKeyDown);
        container.tabIndex = 0;
        if (!container.hasAttribute("aria-label")) container.setAttribute("aria-label", "Causal graph");
      }
      cursor.current = null;
      // A link chosen before the graph existed, such as from a shared address, needs its ends
      const pending = latest.current.selectedLink;
      if (pending) {
        const route = routeOf(pending);
        setActiveRoute(route);
        if (!route) setSelectedLink(null);
      }
      applyHighlight();
    },
    [applyHighlight, beginMarking, choose, clear, dismiss, moveCursor, readableLabels, routeOf, selectable, selectMultiple, stopTracing, toggleLink, walkTo],
  );

  return {
    attach,
    /** The connected Cytoscape instance, for anything this hook doesn't cover. */
    cy,
    selected,
    multiSelecting,
    menuVisible,
    beginMarking,
    finishMarking,
    /** The selected link's id, if a link rather than nodes is selected. */
    selectedLink,
    toggleLink,
    hovered,
    activeRoute,
    depth,
    setDepth,
    /** The most links away a highlight can reach. */
    maxDepth,
    /** Shows the highlight this many steps out while pointing at a control, without keeping it. */
    previewDepth: (steps: number | null) => { if (!tracingNow.current || steps === null) setPreviewedDepth(steps); },
    walkTo,
    choose,
    /** Whether a second node can be selected, to trace the paths between two. */
    canTrace,
    /** Whether the next node chosen will join the selection, to trace paths to it. */
    tracing,
    startTracing,
    stopTracing,
    /** Goes up by one each time a new Cytoscape instance is connected. */
    instanceCount,
    /** Text for a live region, so screen readers hear where the keyboard cursor is. */
    announcement,
    toggle,
    focus,
    clear,
    dismiss,
    keepSelected,
    toggleRoute,
    /** Shows a route while pointing at it, without changing the kept highlight. */
    previewRoute: (route: Route | null) => { if (!tracingNow.current || route === null) setPreviewedRoute(route); },
    fit,
    zoomIn,
    zoomOut,
  };
}
