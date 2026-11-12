"use client";
import { useEffect, useRef, type KeyboardEvent } from "react";
export type Direction = "cause" | "effect";
type Action = Direction | "rename" | "delete";

/** Off the node's edge by the same gap as the Explore menu, so both read as one ring. */
const GAP = 6;
const SLIT = 0.04;
const QUARTER = Math.PI / 4;
/**
 * The ring around a node of this radius, in screen pixels. It is thick enough that the middle of
 * each sector's bounding box is inside the sector, however wide the node.
 */
export const ringAround = (radius: number) => {
  const inner = radius + GAP;
  return { inner, outer: inner + Math.max(29, inner * 0.3) };
};

const sector = (at: number, inner: number, outer: number) => {
  const [from, to] = [at - QUARTER + SLIT, at + QUARTER - SLIT];
  const point = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  return `M ${point(outer, from)} A ${outer} ${outer} 0 0 1 ${point(outer, to)} L ${point(inner, to)} A ${inner} ${inner} 0 0 0 ${point(inner, from)} Z`;
};

/** Causes sit upstream on the left and effects downstream on the right, so the ring reads as … → this → … */
const items: { action: Action; at: number; label: string; name: string }[] = [
  { action: "cause", at: Math.PI, label: "Add cause", name: "Add cause: … → this" },
  { action: "effect", at: 0, label: "Add effect", name: "Add effect: this → …" },
  { action: "rename", at: -Math.PI / 2, label: "Rename", name: "Rename" },
  { action: "delete", at: Math.PI / 2, label: "Delete", name: "Delete node and its links" },
];
const byKey: Record<string, Action> = { ArrowLeft: "cause", ArrowRight: "effect", ArrowUp: "rename", ArrowDown: "delete" };

/**
 * The authoring ring: four sectors around the selected node, which stays visible as the hub. It is
 * the same shape Explore draws toward existing links, here offering the links that could exist.
 */
export function AuthorMenu({ x, y, radius, label, onConnect, onRename, onDelete, onClose }: {
  x: number; y: number; radius: number; label: string;
  /** `start` is where the pointer pressed, in client pixels, when the sector was pressed rather than activated from the keyboard. */
  onConnect: (direction: Direction, start?: { x: number; y: number }) => void; onRename: () => void; onDelete: () => void; onClose: () => void;
}) {
  const root = useRef<SVGSVGElement>(null);
  const plate = (action: Action) => root.current?.querySelector<SVGPathElement>(`[data-action="${action}"]`);
  useEffect(() => { plate("effect")?.focus(); }, []);
  const { inner, outer } = ringAround(radius);
  const middle = (inner + outer) / 2;
  const run = (action: Action) => action === "rename" ? onRename() : action === "delete" ? onDelete() : onConnect(action);
  const keys = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    else if (byKey[e.key]) { e.preventDefault(); plate(byKey[e.key])?.focus(); }
    else if (e.key === "Tab") {
      e.preventDefault();
      const i = items.findIndex(item => item.action === (document.activeElement as HTMLElement | null)?.dataset.action);
      plate(items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].action)?.focus();
    }
  };
  // The link a side sector would add: a new node and an arrow, always pointing downstream
  const link = (side: 1 | -1) => <>
    <path d={`M ${side * middle - (side > 0 ? 11 : -1)} 0 h 10 m -4 -3.5 l 4 3.5 l -4 3.5`} />
    <circle cx={side * (middle + 6)} cy="0" r="3.5" />
  </>;
  return <div className="author-menu" style={{ left: x, top: y }}>
    <svg ref={root} role="menu" aria-label={`Actions for ${label}`} width={outer * 2} height={outer * 2} viewBox={`${-outer} ${-outer} ${outer * 2} ${outer * 2}`} style={{ left: -outer, top: -outer }} onKeyDown={keys}>
      {items.map(({ action, at, label, name }) => {
        const [cx, cy] = [Math.cos(at), Math.sin(at)].map(v => Math.round(v));
        return <g key={action} className={`sector sector-${action}`}>
          <path className="sector-plate" role="menuitem" tabIndex={0} aria-label={name} data-action={action} d={sector(at, inner, outer)}
            // A link starts on the press, so it can be dragged straight out of its sector
            onPointerDown={e => { if (e.button === 0 && (action === "cause" || action === "effect")) { e.preventDefault(); onConnect(action, { x: e.clientX, y: e.clientY }); } }}
            onClick={() => run(action)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(action); } }} />
          <g className="sector-glyph" aria-hidden="true">
            {action === "cause" ? link(-1) : action === "effect" ? link(1)
              : action === "rename" ? <text x="0" y={-middle} textAnchor="middle" dominantBaseline="central">Aa</text>
              : <path d={`M -4 ${middle - 4} l 8 8 m 0 -8 l -8 8`} />}
          </g>
          <text className="sector-label" aria-hidden="true" x={cx * (outer + 8)} y={cy * (outer + 14)} textAnchor={cx > 0 ? "start" : cx < 0 ? "end" : "middle"} dominantBaseline="central">{label}</text>
        </g>;
      })}
    </svg>
  </div>;
}
