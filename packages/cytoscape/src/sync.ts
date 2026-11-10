import type { Core, EventObject, NodeSingular, Position } from "cytoscape";
import { curveLinks } from "./positions.ts";

export interface SyncOptions {
  /** Which nodes of the second graph each node of the first stands for. Missing ids match by id. */
  counterparts?: Record<string, string[]>;
  /** The same, from the second graph to the first. */
  reverse?: Record<string, string[]>;
}

/**
 * Keeps two graphs of matching nodes moving together, such as two versions side by side:
 * panning or zooming one moves the other's view the same way, and dragging a node moves its
 * counterparts by the same distance. Their positions should already line up, as `alignPositions`
 * makes them. Returns a function that stops syncing.
 */
export function syncViews(first: Core, second: Core, { counterparts = {}, reverse = {} }: SyncOptions = {}) {
  let echoing = false;

  // A view change is copied once; the copy's own event is ignored rather than sent back
  const mirrorView = (from: Core, to: Core) => () => {
    if (echoing || to.destroyed()) return;
    echoing = true;
    to.viewport({ zoom: from.zoom(), pan: { ...from.pan() } });
    echoing = false;
  };

  const counterpartsOf = (map: Record<string, string[]>, to: Core, id: string) =>
    to.collection((map[id] ?? [id]).map((other) => to.getElementById(other)).filter((node) => node.length > 0));

  // A drag moves counterparts by the same distance, so a merged node and its sources stay together
  const mirrorDrags = (from: Core, to: Core, map: Record<string, string[]>) => {
    const last = new Map<string, Position>();
    const grab = (event: EventObject) => {
      const node = event.target as NodeSingular;
      last.set(node.id(), { ...node.position() });
    };
    const drag = (event: EventObject) => {
      const node = event.target as NodeSingular;
      const before = last.get(node.id());
      const now = node.position();
      last.set(node.id(), { ...now });
      if (!before || to.destroyed()) return;
      const [dx, dy] = [now.x - before.x, now.y - before.y];
      counterpartsOf(map, to, node.id()).forEach((other) => {
        const { x, y } = other.position();
        other.position({ x: x + dx, y: y + dy });
      });
    };
    // Moved counterparts get their link bends redone once the drag ends
    const free = () => {
      if (!to.destroyed()) curveLinks(to);
    };
    from.on("grab", "node", grab);
    from.on("drag", "node", drag);
    from.on("free", "node", free);
    return () => {
      from.removeListener("grab", "node", grab);
      from.removeListener("drag", "node", drag);
      from.removeListener("free", "node", free);
    };
  };

  const firstView = mirrorView(first, second);
  const secondView = mirrorView(second, first);
  first.on("viewport", firstView);
  second.on("viewport", secondView);
  const stopFirst = mirrorDrags(first, second, counterparts);
  const stopSecond = mirrorDrags(second, first, reverse);

  return () => {
    if (!first.destroyed()) first.removeListener("viewport", firstView);
    if (!second.destroyed()) second.removeListener("viewport", secondView);
    if (!first.destroyed()) stopFirst();
    if (!second.destroyed()) stopSecond();
  };
}
