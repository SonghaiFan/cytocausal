"use client";
import {
  fitNodes,
  focusNode,
  highlightCausalNeighbours,
  highlightRoute,
  keepLabelsReadable,
  easeStyles,
  isTransitioning,
  resolveMotion,
  zoomBy,
  type CausalMotion,
  type Route,
} from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";
import { useCallback, useEffect, useRef, useState } from "react";

export interface CausalGraphOptions {
  /** How many nodes can be selected at once, such as 2 to compare them. */
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
}

const firstNode = (cy: Core) =>
  cy
    .nodes(":visible")
    .sort((a, b) => b.degree(false) - a.degree(false))
    .first();

/**
 * Selection, hover, loop highlighting and view controls for one graph. Pass `attach` to the
 * `onReady` prop of `GraphView`. A loop takes priority over selected nodes, and selected nodes
 * over the hovered one.
 */
export function useCausalGraph({
  maxSelected = 1,
  selectable = true,
  readableLabels = false,
  focusZoom,
  initialSelected = [],
  initialLink = null,
  motion,
}: CausalGraphOptions = {}) {
  const cy = useRef<Core | null>(null);
  const [selected, setSelected] = useState(initialLink ? [] : initialSelected);
  const [selectedLink, setSelectedLink] = useState<string | null>(initialLink);
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [previewedRoute, setPreviewedRoute] = useState<Route | null>(null);
  const [depth, setDepth] = useState(1);
  const [announcement, setAnnouncement] = useState("");
  const cursor = useRef<string | null>(null);
  const keyHandler = useRef<((event: KeyboardEvent) => void) | null>(null);

  const latest = useRef({ selected, selectedLink, hovered, activeRoute, previewedRoute, depth });

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
      } else {
        highlightRoute(instance, null);
        const ids = selected.length ? selected : hovered ? [hovered] : [];
        highlightCausalNeighbours(instance, ids, depth);
      }
    };
    // A snapshot change is animating these elements already
    if (isTransitioning(instance)) change();
    else easeStyles(instance, change, resolveMotion(motion).highlight);
  }, [motion]);

  useEffect(() => {
    latest.current = { selected, selectedLink, hovered, activeRoute, previewedRoute, depth };
    applyHighlight();
  }, [selected, selectedLink, hovered, activeRoute, previewedRoute, depth, applyHighlight]);

  const add = useCallback(
    (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id].slice(-maxSelected)),
    [maxSelected],
  );

  /**
   * Selects a link and highlights it with the nodes it joins, or deselects it. It takes the
   * place of any selected nodes.
   */
  const toggleLink = useCallback(
    (id: string) => {
      const route = latest.current.selectedLink === id ? null : routeOf(id);
      setSelectedLink(route ? id : null);
      setActiveRoute(route);
      if (route) setSelected([]);
    },
    [routeOf],
  );

  /** Selects a node, or deselects it if it's already selected. */
  const toggle = useCallback(
    (id: string) => {
      setSelectedLink(null);
      setActiveRoute(null);
      setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : add(ids, id)));
    },
    [add],
  );

  /** Selects a node and moves the view to it. */
  const focus = useCallback(
    (id: string) => {
      setSelectedLink(null);
      setActiveRoute(null);
      setSelected((ids) => add(ids, id));
      if (cy.current) {
        focusNode(cy.current, id, { zoom: focusZoom ?? cy.current.zoom(), motion });
      }
    },
    [add, focusZoom, motion],
  );

  /** Clears the selection and any highlighted loop. */
  const clear = useCallback(() => {
    setSelected([]);
    setSelectedLink(null);
    setActiveRoute(null);
  }, []);

  /** Keeps only the selected nodes that pass a test, such as after filtering the graph. */
  const keepSelected = useCallback((test: (id: string) => boolean) => {
    setSelected((ids) => ids.filter(test));
  }, []);

  /** Highlights a loop or path, or removes the highlight if it's already showing. */
  const toggleRoute = useCallback((route: Route) => {
    setSelectedLink(null);
    setActiveRoute((current) => (current === route ? null : route));
  }, []);

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
      cursor.current = id;
      setHovered(id);
      setAnnouncement(String(node.data("label")));
      instance.animate({ center: { eles: node } }, { duration: resolveMotion(motion).view });
    },
    [motion],
  );

  /** Connects a Cytoscape instance. A rebuilt graph brings a new one. */
  const attach = useCallback(
    (instance: Core) => {
      cy.current = instance;
      if (readableLabels) {
        fitNodes(instance);
        keepLabelsReadable(instance);
      }
      if (selectable) {
        instance.on("tap", "node", (event) => toggle(event.target.id()));
        instance.on("tap", "edge", (event) => toggleLink(event.target.id()));
        instance.on("tap", (event) => {
          if (event.target === instance) clear();
        });
        instance.on("mouseover", "node", (event) => setHovered(event.target.id()));
        instance.on("mouseout", "node", () => setHovered(null));
      }
      if (selectable) {
        const container = instance.container()!;
        const onKeyDown = (event: KeyboardEvent) => {
          const nodes = instance.nodes(":visible").sort((a, b) => a.id().localeCompare(b.id()));
          const current = cursor.current ? instance.getElementById(cursor.current) : null;
          const here = current?.length ? current : null;
          const index = here ? nodes.toArray().findIndex((node) => node.id() === here.id()) : -1;
          const step = (offset: number) => nodes[(index + offset + nodes.length) % nodes.length];

          let next: { id(): string } | undefined;
          if (event.key === "ArrowRight") next = here ? here.outgoers("node").first() : firstNode(instance);
          else if (event.key === "ArrowLeft") next = here ? here.incomers("node").first() : firstNode(instance);
          else if (event.key === "ArrowDown") next = here ? step(1) : firstNode(instance);
          else if (event.key === "ArrowUp") next = here ? step(-1) : firstNode(instance);
          else if ((event.key === "Enter" || event.key === " ") && here) toggle(here.id());
          else if (event.key === "Escape") {
            instance.nodes().removeClass("keyboard-cursor");
            cursor.current = null;
            setHovered(null);
            clear();
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
    [applyHighlight, clear, moveCursor, readableLabels, routeOf, selectable, toggle, toggleLink],
  );

  return {
    attach,
    /** The connected Cytoscape instance, for anything this hook doesn't cover. */
    cy,
    selected,
    /** The selected link's id, if a link rather than nodes is selected. */
    selectedLink,
    toggleLink,
    hovered,
    activeRoute,
    depth,
    setDepth,
    /** Text for a live region, so screen readers hear where the keyboard cursor is. */
    announcement,
    toggle,
    focus,
    clear,
    keepSelected,
    toggleRoute,
    /** Shows a route while pointing at it, without changing the kept highlight. */
    previewRoute: setPreviewedRoute,
    fit,
    zoomIn,
    zoomOut,
  };
}
