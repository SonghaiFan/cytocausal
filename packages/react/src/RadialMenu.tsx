"use client";
import {
  linksInto,
  linksOutOf,
  type CausalNode,
  type LoopOptions,
  type Snapshot,
} from "@cytocausal/core";
import { type Route } from "@cytocausal/cytoscape";
import type { Core, EventObject } from "cytoscape";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { directionCells } from "./radial.ts";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";
import { menuArea, menuPointing, menuTarget, setMenuArea, type MenuArea } from "./overlay.ts";
import type { useCausalGraph } from "./useCausalGraph.ts";

import { markingRoute, type MarkingState } from "./marking.ts";

type Graph = ReturnType<typeof useCausalGraph>;
type Direction = "cause" | "effect" | "both";

interface Neighbour {
  id: string;
  label: string;
  direction: Direction;
  links: string[];
}

/** Ring sizes in screen pixels, out from the edge of the node. */
const GAP = 6;
const STEP = 8;
/**
 * How far a direction reaches either side of its node, so the space between linked nodes that
 * lie far apart stays plain background.
 */
const REACH = (60 * Math.PI) / 180;
/** How far past its node a direction reaches, and the least it reaches past the menu, in pixels. */
const OUTER_PAST = 32;
const OUTER_MIN = 48;

/** How far from the selected node, of this radius, a linked node this far away leads. */
const directionReach = (node: number, rings: number, distance: number) =>
  Math.max(menuRadius(node, rings) + OUTER_MIN, distance + OUTER_PAST);
const SPACE = 4;

/** The card beside the menu, in pixels: room it needs, and its gap from the rings. */
const CARD_WIDTH = 280;
const CARD_GAP = 8;


/** The button that starts tracing paths, sitting just outside the rings. */


/**
 * How far the menu reaches from the centre of a node of this radius, with a ring for each step
 * past the first and the trace button.
 */
const menuRadius = (node: number, rings: number) => node + GAP + rings * (STEP + SPACE) + SPACE;


/** The outline of a ring segment from one angle to another, in radians, centred on 0, 0. */
function sector(from: number, to: number, inner: number, outer: number) {
  const point = (radius: number, angle: number) =>
    `${(radius * Math.cos(angle)).toFixed(2)} ${(radius * Math.sin(angle)).toFixed(2)}`;
  const large = to - from > Math.PI ? 1 : 0;
  return [
    `M ${point(outer, from)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${point(outer, to)}`,
    `L ${point(inner, to)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${point(inner, from)}`,
    "Z",
  ].join(" ");
}

/** A full ring, drawn as two half rings, since one arc can't close on itself. */
const ring = (inner: number, outer: number) =>
  `${sector(0, Math.PI, inner, outer)} ${sector(Math.PI, 2 * Math.PI, inner, outer)}`;

/** A ref that always holds the latest value, for listeners added once. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** The nodes linked to one, each once, with whether it causes, follows from it, or both. */
function neighboursOf(snapshot: Snapshot, id: string): Neighbour[] {
  const found = new Map<string, Neighbour>();
  const add = (direction: "cause" | "effect") => (item: ReturnType<typeof linksInto>[number]) => {
    const existing = found.get(item.node.id);
    const links = item.links.map((link) => link.id);
    if (existing) {
      existing.direction = existing.direction === direction ? direction : "both";
      existing.links.push(...links);
    } else {
      found.set(item.node.id, { id: item.node.id, label: item.node.label, direction, links });
    }
  };
  linksInto(snapshot, id).forEach(add("cause"));
  linksOutOf(snapshot, id).forEach(add("effect"));
  found.delete(id);
  return [...found.values()];
}

/** The nodes the highlight reaches within some steps, causes and effects together, with the node. */
function reach(snapshot: Snapshot, id: string, steps: number) {
  const seen = new Set([id]);
  let [upstream, downstream] = [[id], [id]];
  for (let step = 0; step < steps; step++) {
    upstream = snapshot.edges.filter(({ target }) => upstream.includes(target)).map(({ source }) => source);
    downstream = snapshot.edges.filter(({ source }) => downstream.includes(source)).map(({ target }) => target);
    [...upstream, ...downstream].forEach((node) => seen.add(node));
  }
  return seen;
}

interface Geometry {
  x: number;
  y: number;
  /** Half the node's larger side, in screen pixels. */
  radius: number;
  /** Each neighbour's direction from the node, in radians. */
  bearings: Record<string, number>;
  /** How far each neighbour is from the node, in pixels. */
  distances: Record<string, number>;
}

/** Where the node is on screen, and which way each neighbour lies, updated as the view moves. */
function useGeometry(cy: Core | null, id: string | null, neighbours: Neighbour[]) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  useEffect(() => {
    if (!cy || !id) {
      setGeometry(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const node = cy.getElementById(id);
      if (cy.destroyed() || node.length === 0 || !node.visible()) return setGeometry(null);
      const box = cy.container()!.getBoundingClientRect();
      const { x, y } = node.renderedPosition();
      if (x < 0 || y < 0 || x > box.width || y > box.height) return setGeometry(null);
      const bearings: Record<string, number> = {};
      const distances: Record<string, number> = {};
      for (const { id: other } of neighbours) {
        const target = cy.getElementById(other);
        if (target.length === 0) continue;
        const point = target.renderedPosition();
        bearings[other] = Math.atan2(point.y - y, point.x - x);
        distances[other] = Math.hypot(point.x - x, point.y - y);
      }
      setGeometry({
        x: box.left + x,
        y: box.top + y,
        radius: Math.max(node.renderedOuterWidth(), node.renderedOuterHeight()) / 2,
        bearings,
        distances,
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    cy.on("viewport position resize render", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      if (!cy.destroyed()) cy.removeListener("viewport position resize render", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [cy, id, neighbours]);
  return geometry;
}

/** Runs a menu item from the keyboard, as a click does, and closes the menu on Escape. */
const keys = (run: () => void, close: () => void) => (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    run();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
};

/**
 * Where the node's card goes: beside the menu on whichever side has room within the graph, or
 * above it when neither does. Below is where the caption shows.
 */
const cardPlacement = (x: number, size: number, area?: DOMRect): CSSProperties => {
  const [left, right] = [area?.left ?? 0, area?.right ?? window.innerWidth];
  if (x + size + CARD_GAP + CARD_WIDTH <= right) return { left: size * 2 + CARD_GAP };
  if (x - size - CARD_GAP - CARD_WIDTH >= left) return { right: size * 2 + CARD_GAP };
  return { left: "50%", top: "auto", bottom: size * 2 + CARD_GAP, transform: "translateX(-50%)" };
};

/**
 * A ring menu around the selected node. Two thin rings set how many steps the highlight reaches,
 * while cycle selection lives in the sidebar. The space around the node is
 * split by direction, unseen: point anywhere toward a linked node to preview the link, and click
 * to walk there. It uses contrast only, so the accent stays on the node itself. Outside a
 * provider, pass `graph` and `snapshot`.
 */
export function RadialMenu({
  graph: given,
  snapshot: chosen,
  renderInfo,
  showDirections = false,
  className = "",
}: {
  graph?: Graph;
  snapshot?: Snapshot;
  /** @deprecated Cycle selection and configuration live in the sidebar. */
  loopOptions?: LoopOptions;
  /**
   * A card beside the menu about the node, such as its evidence, for pages without a sidebar.
   * Leave it out when `SelectionPanel` shows the node, so nothing is shown twice.
   */
  renderInfo?: (node: CausalNode) => ReactNode;
  /**
   * Draw the area around the node that leads to each linked node, for debugging: its angles, from
   * the node's edge to its reach, with a line along the linked node's true bearing.
   */
  showDirections?: boolean;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const graph = required(given ?? causal?.graph, "RadialMenu", "graph");
  const snapshot = required(chosen ?? causal?.snapshot, "RadialMenu", "snapshot");
  const [caption, setCaption] = useState<ReactNode>(null);
  const directionText = (neighbour: Neighbour) => {
    const verb =
      neighbour.direction === "cause" ? labels.causedBy : neighbour.direction === "effect" ? labels.leadsTo : labels.linkedBothWays;
    return `${verb}: ${neighbour.label}`;
  };

  const id =
    graph.menuVisible && graph.selected.length === 1 && !graph.multiSelecting && !graph.selectedLink && snapshot.nodes.some((node) => node.id === graph.selected[0])
      ? graph.selected[0]
      : null;
  const neighbours = useMemo(() => (id ? neighboursOf(snapshot, id) : []), [snapshot, id]);
  // A ring for each step past the first, up to the graph's limit
  const steps = Array.from({ length: Math.max(0, graph.maxDepth - 1) }, (_, index) => index + 2);
  const rings = steps.length;
  // The instance count changes when the graph is rebuilt, so the menu follows the new one
  const cy = useMemo(() => graph.cy.current, [graph.cy, graph.instanceCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const geometry = useGeometry(cy, id, neighbours);

  // The space around the node is split among linked nodes by direction: each gets the angles
  // nearest the way it lies
  const { ordered, hitCells } = useMemo(() => {
    if (!geometry) return { ordered: [], hitCells: [] };
    const ordered = neighbours
      .filter(({ id: other }) => geometry.bearings[other] !== undefined)
      .sort((a, b) => geometry.bearings[a.id] - geometry.bearings[b.id]);
    const bearings = ordered.map(({ id: other }) => geometry.bearings[other]);
    return {
      ordered,
      // Keep real bearings: enforcing a minimum width would make tightly
      // clustered neighbours point at the wrong node.
      hitCells: directionCells(bearings, { min: 0, reach: REACH }),
    };
  }, [geometry, neighbours]);
  // The linked node the pointer is in the direction of
  const [aimed, setAimed] = useState<string | null>(null);

  useEffect(() => setCaption(null), [id]);
  // While tracing, the caption says what to do next until a node is chosen
  const shownCaption = graph.tracing ? labels.tracingHint : caption;
  // Tooltips keep out of the circle the menu covers, and the empty graph in each linked node's
  // direction, from the node's edge to just past the linked one, leads there. Not while tracing,
  // when only a node will do
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    if (!id || !geometry) return setMenuArea(cy, null);
    const radius = menuRadius(geometry.radius, rings);
    const sectors = graph.tracing
      ? undefined
      : ordered.map(({ id: other, links }, index) => ({
          node: other,
          links,
          from: hitCells[index].from,
          to: hitCells[index].to,
          reach: directionReach(geometry.radius, rings, geometry.distances[other]),
        }));
    const area = { x: geometry.x, y: geometry.y, radius, inner: geometry.radius, node: id, sectors };
    setMenuArea(cy, area);
    // A locked fan is drawn from the latest area, which settles after the menu moves to a node
    setMarkingFeedback(current => {
      if (!current) return current;
      const fan = unwalked(area, walkedLinks.current);
      const chosen = current.levels[0]?.chosen;
      return { levels: [{ area: fan, chosen: fan.sectors?.find(sector => sector.node === chosen?.node) ?? null }] };
    });
  }, [cy, id, geometry, ordered, hitCells, graph.tracing, rings]);

  // The modal owns graph interaction: backdrop nodes cannot be dragged out from
  // under a fan, and links take no pointer at all, so only nodes and the fan answer a click.
  // Panning and zooming the canvas remain available.
  useEffect(() => {
    if (!cy || cy.destroyed() || !id) return;
    const previous = cy.autoungrabify();
    const boxSelection = cy.boxSelectionEnabled();
    cy.autoungrabify(true);
    cy.boxSelectionEnabled(false);
    cy.edges().addClass("menu-inert");
    // Links that arrive while the menu is open, such as from a version change, too
    const inert = (event: EventObject) => event.target.addClass("menu-inert");
    cy.on("add", "edge", inert);
    return () => {
      if (!cy.destroyed()) {
        cy.removeListener("add", "edge", inert);
        cy.edges().removeClass("menu-inert");
        cy.autoungrabify(previous);
        cy.boxSelectionEnabled(boxSelection);
      }
    };
  }, [cy, id]);

  const [markingFeedback, setMarkingFeedback] = useState<MarkingState | null>(null);
  // The locked menu's trail: the node it locked on, then each node committed after it, and the
  // nodes the pointer is steering toward now. Only a locked menu numbers its steps
  const [trail, setTrail] = useState<{ nodes: string[]; ahead: string[] } | null>(null);
  // Links the locked walk has taken. They aren't offered again, so the walk can't go back and
  // forth over one link; a loop can still close by another
  const walkedLinks = useRef<string[]>([]);
  const markingGraph = useLatest(graph);
  const markingSnapshot = useLatest(snapshot);
  // Leaves a locked menu without committing, when the menu closes some other way
  const leaveLock = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!id) leaveLock.current?.();
  }, [id]);
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    const container = cy.container()!;
    /** While set, Cytoscape's own taps do nothing: the locked menu has the clicks. */
    const RELEASE = "cytocausal-marking-release";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let origin: { x: number; y: number; node: string } | null = null;
    // A long press locks the menu open, like a modal. Moving then steers through it without
    // holding the button, a click in a direction commits, and a click outside the directions'
    // areas, outside the canvas, or Escape, leaves
    let locked = false;
    // Whether the pointer is beyond every area of the current fan, where a click leaves
    let outside = false;
    // Whether the press that locked the menu is still held
    let pressed = false;
    let navigation: MarkingState | null = null;
    let suppressClick = false;
    let panEnabled = true;
    let target: string | null = null;
    let route: Route | null = null;
    let step: number | undefined;
    // What earlier commits walked, and what the next one would add
    let walked: { nodes: string[]; edges: string[] } = { nodes: [], edges: [] };
    let ahead: { nodes: string[]; edges: string[] } = { nodes: [], edges: [] };
    const walkedRoute = (): Route | null => walked.edges.length ? { nodes: [...new Set(walked.nodes)], edges: [...new Set(walked.edges)] } : null;
    const cancelTimer = () => { clearTimeout(timer); timer = undefined; };
    /** Borders the node the locked menu is on, so it reads as chosen. */
    const markRoot = (node: string | null) => {
      cy.nodes(".menu-held").removeClass("menu-held");
      if (node) cy.getElementById(node).addClass("menu-held");
    };
    // The pointer moves far more often than what it shows changes, and each of these updates
    // renders the whole graph again. Built anew on every move, they kept React rendering until
    // it reported an update loop, so steering sets them only when what they show changes.
    // Undefined means unknown, such as after something else set them, so the next one is set
    let shownTrail: string | undefined;
    let shownFeedback: string | undefined;
    let shownRoute: string | undefined;
    let shownDepth: number | null | undefined;
    const showTrail = (next: { nodes: string[]; ahead: string[] } | null) => {
      const key = next ? `${next.nodes.join(",")}|${next.ahead.join(",")}` : "";
      if (key === shownTrail) return;
      shownTrail = key;
      setTrail(next);
    };
    const showFeedback = (next: MarkingState | null) => {
      const key = next
        ? JSON.stringify(next.levels.map(({ area, chosen }) => [
            area.node, area.x, area.y, area.radius, area.inner,
            area.sectors?.map(({ node, from, to, reach }) => [node, from, to, reach]),
            chosen?.node ?? null,
          ]))
        : "";
      if (key === shownFeedback) return;
      shownFeedback = key;
      setMarkingFeedback(next);
    };
    const showPreview = (depth: number | null, next: Route | null) => {
      const g = markingGraph.current;
      if (depth !== shownDepth) { shownDepth = depth; g.previewDepth(depth); }
      const key = next ? `${next.nodes.join(",")}|${next.edges.join(",")}` : "";
      if (key !== shownRoute) { shownRoute = key; g.previewRoute(next); }
    };
    const resetSteering = () => {
      target = null; route = null; step = undefined; outside = false;
      ahead = { nodes: [], edges: [] };
      navigation = null;
      shownTrail = shownFeedback = shownRoute = shownDepth = undefined;
      setMarkingFeedback({ levels: [] });
      setTrail({ nodes: [...walked.nodes], ahead: [] });
    };
    const down = (event: EventObject) => {
      // Inside a locked menu, a click commits instead
      if (locked) return;
      const mouse = event.originalEvent as MouseEvent | undefined;
      if (!mouse || mouse.button !== 0 || mouse.shiftKey || markingGraph.current.tracing) return;
      cancelTimer();
      origin = { x: mouse.clientX, y: mouse.clientY, node: event.target.id() };
      timer = setTimeout(() => {
        if (!origin || cy.destroyed()) return;
        locked = true;
        pressed = true;
        panEnabled = cy.userPanningEnabled();
        cy.userPanningEnabled(false);
        cy.stop(true, false);
        cy.scratch(RELEASE, true);
        walked = { nodes: [origin.node], edges: [] };
        walkedLinks.current = [];
        resetSteering();
        markRoot(origin.node);
        markingGraph.current.beginMarking(origin.node);
      }, 400);
    };
    const move = (event: MouseEvent) => {
      if (!locked) {
        if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) {
          cancelTimer(); origin = null;
        }
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const g = markingGraph.current;
      target = null; route = null; step = undefined;
      const shownArea = menuArea(cy);
      const area = shownArea && unwalked(shownArea, walked.edges);

      if (area) {
        // The fan stays on the last node committed. Pointing inside one of its areas chooses
        // that direction; anywhere else, past its reach too, chooses nothing, and the fan
        // doesn't move on until a click commits
        const pointer = { x: event.clientX, y: event.clientY };
        const aimedAt = menuTarget(area, pointer);
        const inCentre = Math.hypot(pointer.x - area.x, pointer.y - area.y) <= (area.inner ?? area.radius);
        outside = !inCentre && aimedAt === null;
        navigation = { levels: [{ area, chosen: area.sectors?.find(sector => sector.node === aimedAt) ?? null }] };
        const shown = navigation;
        const last = shown.levels[shown.levels.length - 1];
        step = shown.levels.length;
        // What's highlighted is what a click commits, so outside the areas nothing is
        if (outside) {
          ahead = { nodes: [], edges: [] };
        } else {
          const nodes = shown.levels.slice(1).map(level => level.area.node);
          if (last.chosen) nodes.push(last.chosen.node);
          ahead = { nodes, edges: markingRoute(shown).edges };
        }
        target = ahead.nodes[ahead.nodes.length - 1] ?? null;
        // The trail so far stays lit, with the way ahead added to it
        const lit = { nodes: [...walked.nodes, ...ahead.nodes], edges: [...walked.edges, ...ahead.edges] };
        route = lit.edges.length ? { nodes: [...new Set(lit.nodes)], edges: [...new Set(lit.edges)] } : null;
        showTrail({ nodes: [...walked.nodes], ahead: ahead.nodes });
        showFeedback(shown);
        setCaption(null);
      }
      showPreview(step === undefined ? null : Math.min(step, g.maxDepth), route);
    };
    /** Commits the direction pointed at: the menu moves to that node and stays locked. */
    const commit = () => {
      if (!target) return;
      const chosen = target;
      walked = { nodes: [...walked.nodes, ...ahead.nodes], edges: [...walked.edges, ...ahead.edges] };
      walkedLinks.current = walked.edges;
      markingGraph.current.previewRoute(null);
      markingGraph.current.finishMarking(chosen, walkedRoute(), undefined, { keepOpen: true });
      markRoot(chosen);
      resetSteering();
      setCaption(null);
    };
    /** Unlocks: panning and Cytoscape's taps come back, and the border goes. */
    const unlockQuietly = () => {
      if (!locked) return;
      locked = false;
      pressed = false;
      cancelTimer(); origin = null;
      if (!cy.destroyed()) {
        cy.userPanningEnabled(panEnabled);
        cy.removeScratch(RELEASE);
        markRoot(null);
      }
      walked = { nodes: [], edges: [] };
      ahead = { nodes: [], edges: [] };
      walkedLinks.current = [];
      setMarkingFeedback(null);
      setTrail(null);
      setCaption(null);
    };
    /** Leaves the locked menu: it closes, and the node and the walk to it stay selected. */
    const unlock = () => {
      if (!locked) return;
      // The walk committed so far stays lit after leaving; only what was being steered goes
      const kept = walkedRoute();
      unlockQuietly();
      const g = markingGraph.current;
      g.previewDepth(null);
      g.previewRoute(null);
      g.finishMarking(null, kept, undefined);
    };
    leaveLock.current = unlockQuietly;
    const release = (event?: MouseEvent) => {
      cancelTimer(); origin = null;
      if (!locked || !pressed) return;
      // The press that locked the menu ends here, and the menu stays. Having dragged to a
      // direction commits it, as before; its click must not commit again
      pressed = false;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      event?.preventDefault();
      commit();
    };
    const click = (event: MouseEvent) => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (!locked || !container.contains(event.target as Node)) return;
      // Where the click lands decides, even without a move before it
      move(event);
      event.preventDefault();
      event.stopImmediatePropagation();
      if (outside) unlock();
      else commit();
    };
    // Outside the canvas, a press leaves; the menu's own rings and buttons still work
    const pressOutside = (event: MouseEvent) => {
      if (!locked) return;
      const element = event.target as Element | null;
      if (!element || container.contains(element) || element.closest?.(".cc-radial")) return;
      unlock();
    };
    // Leaving the window lets go of the button, but the menu stays locked
    const blur = () => { cancelTimer(); origin = null; pressed = false; };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelTimer(); origin = null;
      if (locked) { event.preventDefault(); event.stopImmediatePropagation(); unlock(); }
    };
    cy.on("mousedown", "node", down);
    window.addEventListener("mousedown", pressOutside, true);
    window.addEventListener("mousemove", move, true);
    window.addEventListener("mouseup", release, true);
    window.addEventListener("click", click, true);
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", escape, true);
    return () => {
      cancelTimer();
      unlockQuietly();
      leaveLock.current = null;
      if (!cy.destroyed()) cy.removeListener("mousedown", "node", down);
      window.removeEventListener("mousedown", pressOutside, true);
      window.removeEventListener("mousemove", move, true);
      window.removeEventListener("mouseup", release, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", escape, true);
    };
  }, [cy, markingGraph, markingSnapshot, labels.depth]);

  // Pointing at the empty graph in a linked node's direction previews the link and names it
  const aim = useLatest((target: string | null) => {
    if (target === aimed) return;
    setAimed(target);
    const neighbour = target ? ordered.find(({ id: other }) => other === target) : undefined;
    if (!neighbour || !id) {
      graph.previewRoute(null);
      setCaption(null);
      return;
    }
    graph.previewRoute({ nodes: [id, neighbour.id], edges: neighbour.links });
    setCaption(directionText(neighbour));
  });
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    const container = cy.container()!;
    const onMove = (event: EventObject) => {
      const target = menuPointing(cy, event.target, event.renderedPosition).leadsTo;
      container.style.cursor = target ? "pointer" : "";
      aim.current(target);
    };
    const onLeave = () => {
      container.style.cursor = "";
      aim.current(null);
    };
    cy.on("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      if (!cy.destroyed()) cy.removeListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      container.style.cursor = "";
    };
  }, [cy, aim]);
  useEffect(() => { setAimed(null); setCaption(null); }, [id, graph.tracing, graph.activeRoute]);
  useEffect(() => () => void (cy && setMenuArea(cy, null)), [cy]);
  if (!id || !geometry) return null;

  const labelOf = (node: string) => snapshot.nodes.find((item) => item.id === node)?.label ?? node;
  // Escape stops tracing first, and clears the selection after
  const close = graph.dismiss;
  const stepRing = (step: number) => {
    const inner = geometry.radius + GAP + (step - 2) * (STEP + SPACE);
    return [inner, inner + STEP] as const;
  };
  const size = menuRadius(geometry.radius, rings);

  const center = labelOf(id);
  const node = snapshot.nodes.find((item) => item.id === id);

  // Only one step's fan is drawn at a time: the one steering is in, else the menu's own
  const level = markingFeedback?.levels[markingFeedback.levels.length - 1];
  const bearingFrom = (from: string, to: string) => {
    const a = cy!.getElementById(from).renderedPosition();
    const b = cy!.getElementById(to).renderedPosition();
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  const directions = showDirections && !graph.tracing && (level && cy && !cy.destroyed() ? (
    <DirectionsOverlay
      x={level.area.x}
      y={level.area.y}
      inner={level.area.inner ?? level.area.radius}
      areas={(level.area.sectors ?? []).map((sector) => ({
        label: labelOf(sector.node),
        from: sector.from,
        to: sector.to,
        reach: sector.reach,
        bearing: bearingFrom(level.area.node, sector.node),
      }))}
    />
  ) : (
    <DirectionsOverlay
      x={geometry.x}
      y={geometry.y}
      inner={geometry.radius}
      areas={ordered.map((neighbour, index) => ({
        label: neighbour.label,
        ...hitCells[index],
        bearing: geometry.bearings[neighbour.id],
        reach: directionReach(geometry.radius, rings, geometry.distances[neighbour.id]),
      }))}
    />
  ));

  return (
    <>
    {directions}
    {trail && cy && <TrailSteps cy={cy} nodes={trail.nodes} ahead={trail.ahead} />}
    <div
      className={`cc-radial ${className}`}
      style={{ left: geometry.x - size, top: geometry.y - size, width: size * 2, height: size * 2 }}
    >
      {node && renderInfo && (
        <div className="cc-radial-card" style={cardPlacement(geometry.x, size, cy?.container()?.getBoundingClientRect())}>
          {renderInfo(node)}
        </div>
      )}
      <svg
        role="menu"
        aria-label={`${labels.radialMenu}: ${center}`}
        width={size * 2}
        height={size * 2}
        viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`}
      >
        {markingFeedback && (
          <MarkingFeedback state={markingFeedback} x={geometry.x} y={geometry.y} showDirections={showDirections} />
        )}

        {!markingFeedback && steps.map((step) => {
          const [inner, outer] = stepRing(step);
          const count = reach(snapshot, id, step).size - 1;
          const text = labels.stepsReach(step, count);
          return (
            <path
              key={step}
              className="cc-radial-step"
              data-mark-step={step}
              role="menuitemradio"
              tabIndex={0}
              aria-checked={graph.depth >= step}
              aria-label={text}
              d={ring(inner, outer)}
              fillRule="evenodd"
              onMouseEnter={() => {
                graph.previewDepth(step);
                setCaption(text);
              }}
              onMouseLeave={() => {
                graph.previewDepth(null);
                setCaption(null);
              }}
              onFocus={() => { graph.previewDepth(step); setCaption(text); }}
              onBlur={() => { graph.previewDepth(null); setCaption(null); }}
              // Choosing the deepest ring shown goes back a step, so every depth can be reached
              onClick={() => graph.setDepth(graph.depth === step ? step - 1 : step)}
              onKeyDown={keys(() => graph.setDepth(graph.depth === step ? step - 1 : step), close)}
            />
          );
        })}

      </svg>
      {shownCaption && (
        <p className="cc-radial-caption cc-tooltip" role="status" style={{ top: size * 2 + 4 }}>
          {shownCaption}
        </p>
      )}
    </div>
    </>
  );
}

/** A fan without the directions whose every link the walk has already taken. */
function unwalked(area: MenuArea, links: string[]): MenuArea {
  if (!links.length || !area.sectors) return area;
  return { ...area, sectors: area.sectors.filter((sector) => !sector.links.every((link) => links.includes(link))) };
}

/**
 * Numbers each step of a locked menu's walk on the graph: the nodes committed after the one it
 * locked on, then, fainter, the ones the pointer is steering toward. A node reached twice shows
 * both numbers.
 */
function TrailSteps({ cy, nodes, ahead }: { cy: Core; nodes: string[]; ahead: string[] }) {
  // Follows the camera and the nodes, so each number stays on its node
  const [, redraw] = useState(0);
  useEffect(() => {
    if (cy.destroyed()) return;
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => redraw(n => n + 1)); };
    cy.on("viewport position", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      if (!cy.destroyed()) cy.removeListener("viewport position", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [cy]);
  if (cy.destroyed()) return null;
  const numbers = new Map<string, { step: number; ahead: boolean }[]>();
  [...nodes.slice(1), ...ahead].forEach((node, index) => {
    const list = numbers.get(node) ?? [];
    list.push({ step: index + 1, ahead: index >= nodes.length - 1 });
    numbers.set(node, list);
  });
  const box = cy.container()!.getBoundingClientRect();
  return (
    <div className="cc-trail-steps" aria-hidden="true">
      {[...numbers].map(([node, steps]) => {
        const element = cy.getElementById(node);
        if (element.empty()) return null;
        const { x, y } = element.renderedPosition();
        return (
          <span
            key={node}
            className="cc-trail-step"
            data-node={node}
            data-ahead={steps.every((item) => item.ahead)}
            style={{ left: box.left + x + element.renderedOuterWidth() / 2, top: box.top + y - element.renderedOuterHeight() / 2 }}
          >
            {steps.map(({ step }) => step).join(", ")}
          </span>
        );
      })}
    </div>
  );
}

/** One linked node's area, as `showDirections` draws it. */
interface DirectionArea {
  label: string;
  from: number;
  to: number;
  bearing: number;
  reach: number;
}

/**
 * Draws the area around a node that leads to each linked node, for debugging: each area's
 * angles out to its reach, a line along the linked node's true bearing, and its name. It takes
 * no pointer events, so it changes nothing it shows.
 */
function DirectionsOverlay({ x, y, inner, areas }: { x: number; y: number; inner: number; areas: DirectionArea[] }) {
  const size = Math.max(inner, ...areas.map(({ reach }) => reach)) + 2;
  return (
    <svg
      className="cc-radial-directions"
      aria-hidden="true"
      width={size * 2}
      height={size * 2}
      viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`}
      style={{ left: x - size, top: y - size }}
    >
      {areas.map(({ label, from, to, bearing, reach }, index) => {
        const middle = (from + to) / 2;
        const name = reach - 14;
        return (
          // Neighbouring areas alternate in shade, so their borders show
          <g key={label} className={index % 2 ? "cc-direction-even" : "cc-direction-odd"}>
            <path d={sector(from, to, inner, reach)} />
            <line x1={inner * Math.cos(bearing)} y1={inner * Math.sin(bearing)} x2={reach * Math.cos(bearing)} y2={reach * Math.sin(bearing)} />
            <text x={name * Math.cos(middle)} y={name * Math.sin(middle)} textAnchor="middle" dominantBaseline="central">
              {label} {Math.round(((to - from) * 180) / Math.PI)}°
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Visual presence follows navigation without delaying hit testing or the committed path. */
function MarkingFeedback({ state, x, y, showDirections }: {
  state: MarkingState; x: number; y: number; showDirections: boolean;
}) {
  const current = state.levels[state.levels.length - 1];
  const draw = ({ area, chosen }: MarkingState["levels"][number], index: number, exiting = false) => {
    const activeLevel = !exiting && index === state.levels.length - 1;
    const fans = activeLevel || exiting ? area.sectors ?? [] : [];
    return <g key={`${exiting ? "exit-" : ""}${area.node}`} transform={`translate(${area.x - x} ${area.y - y})`}
      data-center={area.node} data-level={index + 1} data-current={activeLevel} data-exiting={exiting}>
      <g className={`cc-marking-level ${exiting ? "cc-marking-leaving" : ""}`} style={{
        "--cc-retreat-x": `${(current?.area.x ?? area.x) - area.x}px`,
        "--cc-retreat-y": `${(current?.area.y ?? area.y) - area.y}px`,
      } as CSSProperties}>
        {fans.map(fan => {
          const active = fan.node === chosen?.node;
          return <g key={fan.node} data-active={active} data-target={fan.node}>
            {active && <path className="cc-marking-band" d={sector(fan.from, fan.to, area.inner ?? area.radius, fan.reach)} />}
            {(active || !chosen) && <path d={sector(fan.from, fan.to, area.inner ?? area.radius, fan.reach)} className="cc-marking-threshold" />}
          </g>;
        })}
      </g>
    </g>;
  };
  return <g className="cc-marking-feedback" aria-hidden="true" data-step={state.levels.length || 1}>
    {/* Only the current step's fan: it is the whole area a click acts in */}
    {showDirections && current && draw(current, state.levels.length - 1)}
    {current && <g className="cc-marking-center" data-node={current.area.node}
      style={{ transform: `translate(${current.area.x - x}px, ${current.area.y - y}px)` }}>
      <g className="cc-marking-sunburst">
        {(current.area.sectors ?? []).map(fan => {
          const gap = Math.min(0.04, (fan.to - fan.from) / 8);
          return <path key={fan.node} className="cc-marking-halo" data-target={fan.node}
            data-active={current.chosen?.node === fan.node}
            data-from={fan.from} data-to={fan.to}
            d={sector(fan.from + gap, fan.to - gap, (current.area.inner ?? 12) + 3, (current.area.inner ?? 12) + 20)} />;
        })}
      </g>
    </g>}
  </g>;
}
