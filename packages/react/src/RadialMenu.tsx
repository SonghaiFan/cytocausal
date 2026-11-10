"use client";
import {
  linksInto,
  linksOutOf,
  type CausalNode,
  type FeedbackLoop,
  type LoopOptions,
  type Snapshot,
} from "@cytocausal/core";
import { sameRoute, type Route } from "@cytocausal/cytoscape";
import type { Core, EventObject } from "cytoscape";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useLoopSearch } from "./LoopSearch.tsx";
import { directionCells, distanceStep, directionRoute, directionBoundaries } from "./radial.ts";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";
import { menuArea, menuTarget, menuPointing, setMenuArea } from "./overlay.ts";
import type { useCausalGraph } from "./useCausalGraph.ts";

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
const LOOP = 10;
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
const MAX_LOOPS = 12;

/** The card beside the menu, in pixels: room it needs, and its gap from the rings. */
const CARD_WIDTH = 280;
const CARD_GAP = 8;


/** The button that starts tracing paths, sitting just outside the rings. */
const TRACE = 11;

/**
 * How far the menu reaches from the centre of a node of this radius, with a ring for each step
 * past the first and the trace button.
 */
const menuRadius = (node: number, rings: number) => node + GAP + rings * (STEP + SPACE) + LOOP + 2 + 2 * TRACE + SPACE;


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
 * and the outer band lists the feedback loops through the node. The space around the node is
 * split by direction, unseen: point anywhere toward a linked node to preview the link, and click
 * to walk there. It uses contrast only, so the accent stays on the node itself. Outside a
 * provider, pass `graph` and `snapshot`.
 */
export function RadialMenu({
  graph: given,
  snapshot: chosen,
  loopOptions,
  renderInfo,
  showDirections = false,
  className = "",
}: {
  graph?: Graph;
  snapshot?: Snapshot;
  /** Limits for finding loops through the node. Set these for large graphs. */
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
  const nearbySnapshot = useMemo(() => {
    if (!id) return null;
    const reached = reach(snapshot, id, graph.depth);
    reached.delete(id);
    return { ...snapshot, nodes: snapshot.nodes.filter(n => reached.has(n.id)),
      edges: snapshot.edges.filter(e => reached.has(e.source) && reached.has(e.target)) };
  }, [snapshot, id, graph.depth]);
  const throughSearch = useLoopSearch(id ? snapshot : null, { ...loopOptions, through: id ?? undefined });
  const nearbySearch = useLoopSearch(nearbySnapshot, loopOptions);
  const loops = { loops: [
    ...throughSearch.loops.map(loop => ({ loop, nearby: false })),
    ...nearbySearch.loops.map(loop => ({ loop, nearby: true })),
  ] };
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
    setMenuArea(cy, { x: geometry.x, y: geometry.y, radius, inner: geometry.radius, node: id, sectors });
  }, [cy, id, geometry, ordered, hitCells, graph.tracing, rings]);

  // The modal owns graph interaction: backdrop nodes cannot be dragged out from
  // under a fan. Panning and zooming the canvas remain available.
  useEffect(() => {
    if (!cy || cy.destroyed() || !id) return;
    const previous = cy.autoungrabify();
    const boxSelection = cy.boxSelectionEnabled();
    cy.autoungrabify(true);
    cy.boxSelectionEnabled(false);
    return () => {
      if (!cy.destroyed()) {
        cy.autoungrabify(previous);
        cy.boxSelectionEnabled(boxSelection);
      }
    };
  }, [cy, id]);

  const [markingFeedback, setMarkingFeedback] = useState<{ step: number; target: string | null; angle: number; distance: number; boundaries: number[] } | null>(null);
  const markingGraph = useLatest(graph);
  const markingSnapshot = useLatest(snapshot);
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let origin: { x: number; y: number; node: string } | null = null;
    let held = false;
    let suppressClick = false;
    let panEnabled = true;
    let target: string | null = null;
    let route: Route | null = null;
    let step: number | undefined;
    let trace = false;
    const cancelTimer = () => { clearTimeout(timer); timer = undefined; };
    const down = (event: EventObject) => {
      const mouse = event.originalEvent as MouseEvent | undefined;
      if (!mouse || mouse.button !== 0 || mouse.shiftKey || markingGraph.current.tracing) return;
      cancelTimer();
      origin = { x: mouse.clientX, y: mouse.clientY, node: event.target.id() };
      timer = setTimeout(() => {
        if (!origin || cy.destroyed()) return;
        held = true;
        target = null; route = null; step = undefined; trace = false;
        panEnabled = cy.userPanningEnabled();
        cy.userPanningEnabled(false);
        cy.stop(true, false);
        setMarkingFeedback({ step: 1, target: null, angle: 0, distance: 0, boundaries: [] });
        markingGraph.current.beginMarking(origin.node);
      }, 400);
    };
    const move = (event: MouseEvent) => {
      if (!held) {
        if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) {
          cancelTimer(); origin = null;
        }
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const g = markingGraph.current;
      const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-mark-route], [data-mark-trace]");
      target = null; route = null; step = undefined; trace = false;
      const area = menuArea(cy);
      let boundaries: number[] = [];
      if (hit && cy.container()!.parentElement?.contains(hit)) {
        if (hit.hasAttribute("data-mark-route")) route = JSON.parse(hit.getAttribute("data-mark-route")!) as Route;
        trace = hit.hasAttribute("data-mark-trace");
        setCaption(hit.getAttribute("aria-label"));
      } else if (area) {
        target = menuTarget(area, { x: event.clientX, y: event.clientY }, true);
        const sector = area.sectors?.find(s => s.node === target);
        if (sector) {
          const center = cy.getElementById(area.node).renderedPosition();
          boundaries = directionBoundaries(markingSnapshot.current.edges, area.node, sector.node, g.maxDepth, sector.reach, id => {
            const point = cy.getElementById(id).renderedPosition();
            return Math.hypot(point.x - center.x, point.y - center.y);
          });
          step = distanceStep(Math.hypot(event.clientX - area.x, event.clientY - area.y), boundaries);
          route = directionRoute(markingSnapshot.current.edges, area.node, sector.node, step);
        }
        setCaption(step === undefined ? null : `${target ? String(cy.getElementById(target).data("label")) + " · " : ""}${labels.depth}: ${step}`);
      }
      if (area) setMarkingFeedback({ step: step ?? g.depth, target, angle: Math.atan2(event.clientY - area.y, event.clientX - area.x), distance: Math.hypot(event.clientX - area.x, event.clientY - area.y), boundaries });
      g.previewDepth(step ?? null);
      g.previewRoute(route);
    };
    const release = (event?: MouseEvent) => {
      cancelTimer(); origin = null;
      if (!held) {
        if (event && cy.scratch("cytocausal-marking-release")) {
          suppressClick = true;
          setTimeout(() => { suppressClick = false; if (!cy.destroyed()) cy.removeScratch("cytocausal-marking-release"); }, 0);
        }
        return;
      }
      held = false;
      setMarkingFeedback(null);
      event?.preventDefault();
      // Let Cytoscape see mouseup to end its grab, but suppress the resulting tap.
      cy.scratch("cytocausal-marking-release", true);
      suppressClick = true;
      if (event) setTimeout(() => { suppressClick = false; if (!cy.destroyed()) cy.removeScratch("cytocausal-marking-release"); }, 0);
      cy.userPanningEnabled(panEnabled);
      markingGraph.current.finishMarking(target, route, step);
      if (trace) markingGraph.current.startTracing();
      setCaption(null);
    };
    const click = (event: MouseEvent) => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const blur = () => { target = null; route = null; step = undefined; trace = false; release(); };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelTimer(); origin = null;
      if (held) { event.preventDefault(); event.stopImmediatePropagation(); blur(); }
    };
    cy.on("mousedown", "node", down);
    window.addEventListener("mousemove", move, true);
    window.addEventListener("mouseup", release, true);
    window.addEventListener("click", click, true);
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", escape, true);
    return () => {
      cancelTimer();
      if (!cy.destroyed()) {
        cy.removeListener("mousedown", "node", down);
        if (held) cy.userPanningEnabled(panEnabled);
      }
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
  // Loops sit just outside the last ring, or the node when there are none
  const loopInner = (rings ? stepRing(steps[rings - 1])[1] : geometry.radius + GAP - SPACE) + SPACE;
  const loopOuter = loopInner + LOOP;
  const size = menuRadius(geometry.radius, rings);

  const shownLoops = (loops?.loops ?? []).slice(0, MAX_LOOPS);
  const loopWidth = (2 * Math.PI) / Math.max(shownLoops.length, 1);
  const loopRoute = (loop: FeedbackLoop): Route => loop;
  const loopText = (loop: FeedbackLoop, nearby: boolean) => {
    const mark = loop.type === "reinforcing" ? labels.reinforcingMark : loop.type === "balancing" ? labels.balancingMark : "";
    const kind = loop.type === "unknown" ? labels.loops : labels[loop.type];
    const path = [...loop.nodes, loop.nodes[0]].map(labelOf).join(" → ");
    return { mark, text: `${nearby ? `${labels.loopWithin(graph.depth)} · ` : ""}${kind}: ${path}` };
  };
  const center = labelOf(id);
  const node = snapshot.nodes.find((item) => item.id === id);

  const directions = showDirections && !graph.tracing && (
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
  );

  return (
    <>
    {directions}
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
          <g className="cc-marking-feedback" aria-hidden="true" data-step={markingFeedback.step}>
            {markingFeedback.boundaries.map((outer, index) => {
              const step = index + 1;
              const neighbour = ordered.find(n => n.id === markingFeedback.target);
              if (!neighbour) return null;
              const inner = index === 0 ? geometry.radius : markingFeedback.boundaries[index - 1];
              const active = step === markingFeedback.step;
              const cell = hitCells[ordered.findIndex(n => n.id === markingFeedback.target)];
              if (!cell) return null;
              const middle = (cell.from + cell.to) / 2;
              const labelRadius = (Math.max(size, inner) + outer) / 2;
              return <g key={step} data-active={active}>
                {active && cell && <path className="cc-marking-band" d={sector(cell.from, cell.to, inner, outer)} />}
                <path d={sector(cell.from, cell.to, inner, outer)} className="cc-marking-threshold" />
                <text x={labelRadius * Math.cos(middle)} y={labelRadius * Math.sin(middle)} textAnchor="middle">{labels.depth}: {step}</text>
              </g>;
            })}
            {markingFeedback.target && <line className="cc-marking-bearing" x1={geometry.radius * Math.cos(markingFeedback.angle)} y1={geometry.radius * Math.sin(markingFeedback.angle)} x2={markingFeedback.distance * Math.cos(markingFeedback.angle)} y2={markingFeedback.distance * Math.sin(markingFeedback.angle)} />}
          </g>
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

        {shownLoops.map(({ loop, nearby }, index) => {
          const from = -Math.PI / 2 + index * loopWidth;
          const { mark, text } = loopText(loop, nearby);
          const middle = from + loopWidth / 2;
          const radius = (loopInner + loopOuter) / 2;
          const active = sameRoute(graph.activeRoute, loop);
          return (
            <g
              key={loop.edges.join()}
              // Loops through the node come first; those only within reach are lighter
              className={`cc-radial-loop${nearby ? " cc-radial-nearby" : ""}`}
              data-mark-route={JSON.stringify(loopRoute(loop))}
              role="menuitemcheckbox"
              tabIndex={0}
              aria-checked={active}
              aria-label={text}
              onMouseEnter={() => {
                graph.previewRoute(loopRoute(loop));
                setCaption(text);
              }}
              onMouseLeave={() => {
                graph.previewRoute(null);
                setCaption(null);
              }}
              onFocus={() => { graph.previewRoute(loopRoute(loop)); setCaption(text); }}
              onBlur={() => { graph.previewRoute(null); setCaption(null); }}
              onClick={() => graph.toggleRoute(loopRoute(loop))}
              onKeyDown={keys(() => graph.toggleRoute(loopRoute(loop)), close)}
            >
              <path d={sector(from + 0.03, from + loopWidth - 0.03, loopInner, loopOuter)} />
              {mark && loopWidth > 0.35 && (
                <text
                  x={radius * Math.cos(middle)}
                  y={radius * Math.sin(middle)}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {mark}
                </text>
              )}
            </g>
          );
        })}
        {graph.canTrace && (
          <g
            className="cc-radial-trace"
            data-mark-trace="true"
            role="menuitemcheckbox"
            tabIndex={0}
            aria-checked={graph.tracing}
            aria-label={labels.tracePaths}
            transform={`translate(0 ${loopOuter + SPACE + TRACE})`}
            onMouseEnter={() => setCaption(labels.tracePaths)}
            onMouseLeave={() => setCaption(null)}
            onFocus={() => setCaption(labels.tracePaths)}
            onBlur={() => { graph.previewRoute(null); setCaption(null); }}
            onClick={() => (graph.tracing ? graph.stopTracing() : graph.startTracing())}
            onKeyDown={keys(() => (graph.tracing ? graph.stopTracing() : graph.startTracing()), close)}
          >
            <circle r={TRACE} />
            <text textAnchor="middle" dominantBaseline="central">
              ⤳
            </text>
          </g>
        )}
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
