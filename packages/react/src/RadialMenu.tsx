"use client";
import {
  findFeedbackLoops,
  linksInto,
  linksOutOf,
  type FeedbackLoop,
  type LoopOptions,
  type Snapshot,
} from "@cytocausal/core";
import { sameRoute, type Route } from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";
import { setMenuArea } from "./overlay.ts";
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
const WEDGE = 26;
const STEP = 8;
const LOOP = 10;
/** The widest a wedge gets, so a node with few links still shows which way each lies. */
const MAX_WEDGE = (70 * Math.PI) / 180;
/** The narrowest a wedge gets before wedges are nudged apart instead. */
const MIN_WEDGE = (20 * Math.PI) / 180;
const SPACE = 4;
const MAX_LOOPS = 12;
const STEPS = [2, 3] as const;

/** How far the menu reaches from the centre of a node of this radius. */
const menuRadius = (node: number) => node + GAP + WEDGE + SPACE + 2 * (STEP + SPACE) + LOOP + 2;

/**
 * A wedge's arrow lies along the way its node is, and follows the link as the graph draws it:
 * out to an effect, in from a cause, and both ways for a node that is both.
 */
const ARROW: Record<Direction, { mark: string; turn: number }> = {
  effect: { mark: "→", turn: 0 },
  cause: { mark: "→", turn: 180 },
  both: { mark: "↔", turn: 0 },
};

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

/**
 * Spreads wedges that point the same way, keeping each as close to its true direction as it can.
 * Angles are in radians, already sorted.
 */
function spread(angles: number[], width: number) {
  const placed = [...angles];
  for (let i = 1; i < placed.length; i++) placed[i] = Math.max(placed[i], placed[i - 1] + width);
  // Anything pushed past a full turn wraps into the first wedge, so the whole set shifts back
  const overflow = placed.length > 1 ? placed[placed.length - 1] - (placed[0] + 2 * Math.PI - width) : 0;
  return overflow > 0 ? placed.map((angle, index) => angle - (overflow * index) / (placed.length - 1)) : placed;
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

/**
 * The loops a reader can see from a node: those through it first, then those lying wholly
 * within the steps the highlight reaches, which the node feeds or is fed by.
 */
function loopsAround(snapshot: Snapshot, id: string, steps: number, options?: LoopOptions) {
  const through = findFeedbackLoops(snapshot, { ...options, through: id });
  const reached = reach(snapshot, id, steps);
  reached.delete(id);
  const within = findFeedbackLoops(
    {
      ...snapshot,
      nodes: snapshot.nodes.filter((node) => reached.has(node.id)),
      edges: snapshot.edges.filter(({ source, target }) => reached.has(source) && reached.has(target)),
    },
    options,
  );
  return {
    loops: [
      ...through.loops.map((loop) => ({ loop, nearby: false })),
      ...within.loops.map((loop) => ({ loop, nearby: true })),
    ],
    complete: through.complete && within.complete,
  };
}

interface Geometry {
  x: number;
  y: number;
  /** Half the node's larger side, in screen pixels. */
  radius: number;
  /** Each neighbour's direction from the node, in radians. */
  bearings: Record<string, number>;
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
      for (const { id: other } of neighbours) {
        const target = cy.getElementById(other);
        if (target.length === 0) continue;
        const point = target.renderedPosition();
        bearings[other] = Math.atan2(point.y - y, point.x - x);
      }
      setGeometry({
        x: box.left + x,
        y: box.top + y,
        radius: Math.max(node.renderedOuterWidth(), node.renderedOuterHeight()) / 2,
        bearings,
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
    close();
  }
};

/**
 * A ring menu around the selected node. Its inner ring has a wedge pointing at each linked
 * node: point at one to preview the link, and choose it to walk there. The two rings outside
 * set how many steps the highlight reaches. The outer band lists the feedback loops through the
 * node. It uses contrast only, so the accent stays on the node itself. Outside a provider, pass
 * `graph` and `snapshot`.
 */
export function RadialMenu({
  graph: given,
  snapshot: chosen,
  loopOptions,
  className = "",
}: {
  graph?: Graph;
  snapshot?: Snapshot;
  /** Limits for finding loops through the node. Set these for large graphs. */
  loopOptions?: LoopOptions;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const graph = required(given ?? causal?.graph, "RadialMenu", "graph");
  const snapshot = required(chosen ?? causal?.snapshot, "RadialMenu", "snapshot");
  const [caption, setCaption] = useState<ReactNode>(null);

  const id =
    graph.selected.length === 1 && !graph.selectedLink && snapshot.nodes.some((node) => node.id === graph.selected[0])
      ? graph.selected[0]
      : null;
  const neighbours = useMemo(() => (id ? neighboursOf(snapshot, id) : []), [snapshot, id]);
  const loops = useMemo(
    () => (id ? loopsAround(snapshot, id, graph.depth, loopOptions) : null),
    [snapshot, id, graph.depth, loopOptions],
  );
  // The instance count changes when the graph is rebuilt, so the menu follows the new one
  const cy = useMemo(() => graph.cy.current, [graph.cy, graph.instanceCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const geometry = useGeometry(cy, id, neighbours);

  useEffect(() => setCaption(null), [id]);
  // Tooltips keep out of the circle the menu covers
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    setMenuArea(cy, id && geometry ? { x: geometry.x, y: geometry.y, radius: menuRadius(geometry.radius), node: id } : null);
  }, [cy, id, geometry]);
  useEffect(() => () => void (cy && setMenuArea(cy, null)), [cy]);
  if (!id || !geometry) return null;

  const labelOf = (node: string) => snapshot.nodes.find((item) => item.id === node)?.label ?? node;
  const close = () => graph.clear();
  const wedgeInner = geometry.radius + GAP;
  const wedgeOuter = wedgeInner + WEDGE;
  const stepRing = (step: number) => {
    const inner = wedgeOuter + SPACE + (step - 2) * (STEP + SPACE);
    return [inner, inner + STEP] as const;
  };
  const loopInner = stepRing(3)[1] + SPACE;
  const loopOuter = loopInner + LOOP;
  const size = menuRadius(geometry.radius);

  // Wedges point at their nodes, spread apart where several lie the same way
  const ordered = neighbours
    .filter(({ id: other }) => geometry.bearings[other] !== undefined)
    .sort((a, b) => geometry.bearings[a.id] - geometry.bearings[b.id]);
  // Wedges narrow to the gap between neighbours that lie close together, so each can stay where
  // its node is; only below a usable width are they nudged apart
  const bearings = ordered.map(({ id: other }) => geometry.bearings[other]);
  const closest = bearings.reduce(
    (smallest, bearing, index) =>
      Math.min(smallest, index === 0 ? bearings[bearings.length - 1] - bearing + 2 * Math.PI : bearing - bearings[index - 1]),
    2 * Math.PI,
  );
  const width = Math.min(MAX_WEDGE, (2 * Math.PI) / Math.max(ordered.length, 1), Math.max(closest, MIN_WEDGE));
  const angles = spread(
    ordered.map(({ id: other }) => geometry.bearings[other]),
    width,
  );
  const gap = Math.min(width * 0.12, 0.05);

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

  return (
    <div
      className={`cc-radial ${className}`}
      style={{ left: geometry.x - size, top: geometry.y - size, width: size * 2, height: size * 2 }}
    >
      <svg
        role="menu"
        aria-label={`${labels.radialMenu}: ${center}`}
        width={size * 2}
        height={size * 2}
        viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`}
      >
        {STEPS.map((step) => {
          const [inner, outer] = stepRing(step);
          const count = reach(snapshot, id, step).size - 1;
          const text = labels.stepsReach(step, count);
          return (
            <path
              key={step}
              className="cc-radial-step"
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
              onFocus={() => setCaption(text)}
              onBlur={() => setCaption(null)}
              // Choosing the deepest ring shown goes back a step, so every depth can be reached
              onClick={() => graph.setDepth(graph.depth === step ? step - 1 : step)}
              onKeyDown={keys(() => graph.setDepth(graph.depth === step ? step - 1 : step), close)}
            />
          );
        })}

        {ordered.map((neighbour, index) => {
          const angle = angles[index];
          const [from, to] = [angle - width / 2 + gap, angle + width / 2 - gap];
          const middle = (wedgeInner + wedgeOuter) / 2;
          const verb = neighbour.direction === "cause" ? labels.causedBy : neighbour.direction === "effect" ? labels.leadsTo : labels.linkedBothWays;
          const text = `${verb}: ${neighbour.label}`;
          const route: Route = { nodes: [id, neighbour.id], edges: neighbour.links };
          const walk = () => graph.walkTo(neighbour.id);
          return (
            <g
              key={neighbour.id}
              className="cc-radial-wedge"
              role="menuitem"
              tabIndex={0}
              aria-label={text}
              onMouseEnter={() => {
                graph.previewRoute(route);
                setCaption(text);
              }}
              onMouseLeave={() => {
                graph.previewRoute(null);
                setCaption(null);
              }}
              onFocus={() => {
                graph.previewRoute(route);
                setCaption(text);
              }}
              onBlur={() => {
                graph.previewRoute(null);
                setCaption(null);
              }}
              onClick={walk}
              onKeyDown={keys(walk, close)}
            >
              <path d={sector(from, to, wedgeInner, wedgeOuter)} />
              <text
                x={middle * Math.cos(angle)}
                y={middle * Math.sin(angle)}
                textAnchor="middle"
                dominantBaseline="central"
                // The arrow keeps to the node's true bearing, even where its wedge was nudged
                transform={`rotate(${(geometry.bearings[neighbour.id] * 180) / Math.PI + ARROW[neighbour.direction].turn} ${middle * Math.cos(angle)} ${middle * Math.sin(angle)})`}
              >
                {ARROW[neighbour.direction].mark}
              </text>
            </g>
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
              onFocus={() => setCaption(text)}
              onBlur={() => setCaption(null)}
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
      </svg>
      {caption && (
        <p className="cc-radial-caption cc-tooltip" style={{ top: size * 2 + 4 }}>
          {caption}
        </p>
      )}
    </div>
  );
}
