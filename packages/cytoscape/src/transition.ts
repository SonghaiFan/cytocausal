import type { Snapshot } from "@cytocausal/core";
import type { Collection, Core, ElementDefinition, LayoutOptions, Layouts } from "cytoscape";
import { toElements } from "./elements.ts";
import { fcoseLayout } from "./layouts.ts";
import { resolveMotion } from "./motion.ts";
import { centre, type Position, type Positions } from "./positions.ts";
import type { CausalMotion } from "./theme.ts";

const SCRATCH_KEY = "cytocausalTransition";

interface Transition {
  layout?: Layouts;
}

export const isTransitioning = (cy: Core) => Boolean(cy.scratch(SCRATCH_KEY));

const fadeTo = (eles: Collection, opacity: number, duration: number) =>
  eles.forEach((ele) => {
    ele.animate({ style: { opacity } }, { duration });
  });

/**
 * Turns the graph on screen into `snapshot` without rebuilding it. Nodes with a
 * counterpart travel from where it was, new ones fade in, the rest fade out.
 * `positions` are the target positions when known; otherwise counterparts stay
 * pinned and fcose places the new nodes around them.
 */
export function transitionToSnapshot(
  cy: Core,
  snapshot: Snapshot,
  {
    counterparts,
    positions,
    motion,
    onSettled,
  }: {
    counterparts: Record<string, string[]>;
    positions?: Positions;
    motion?: CausalMotion;
    onSettled: () => void;
  },
) {
  const { fade, move } = resolveMotion(motion);
  const transition: Transition = {};
  const previous: Transition | undefined = cy.scratch(SCRATCH_KEY);
  // Stopping fires layoutstop, which must not count as that transition settling
  cy.scratch(SCRATCH_KEY, transition);
  previous?.layout?.stop();
  // Leftovers stay for this transition to reuse or fade out. Removing them and adding
  // an element with the same id would strand its animations: Cytoscape's animation
  // pool tracks elements by id, so it would still hold the removed one.
  cy.elements().stop(true, false);

  const sources: Record<string, Position[]> = {};
  cy.nodes().forEach((node) =>
    (counterparts[node.id()] ?? []).forEach((id) =>
      (sources[id] ||= []).push({ ...node.position() }),
    ),
  );

  const { nodes, edges } = toElements(snapshot);
  const incomingIds = new Set([...nodes, ...edges].map(({ data }) => data.id!));
  const outgoing = cy.elements().filter((ele) => !incomingIds.has(ele.id()));
  const replaced = outgoing.nodes().filter((node) => Boolean(counterparts[node.id()]));

  const added: Collection[] = [];
  cy.batch(() => {
    const addOrUpdate = (element: ElementDefinition, addition: Partial<ElementDefinition>) => {
      const existing = cy.getElementById(element.data.id!);
      if (existing.length > 0) {
        // An edge can keep its id while pointing at different nodes in this version
        const { source, target } = element.data;
        if (existing.isEdge() && (source !== existing.data("source") || target !== existing.data("target"))) {
          existing.move({ source, target });
        }
        existing.data(element.data);
        existing.removeStyle("opacity");
      } else {
        added.push(cy.add({ ...element, ...addition }));
      }
    };

    nodes.forEach((node) => {
      const id = node.data.id!;
      const start = sources[id] ? centre(sources[id]) : positions?.[id];
      addOrUpdate(node, {
        group: "nodes",
        position: start ?? { x: 0, y: 0 },
        style: sources[id] ? {} : { opacity: 0 },
      } as Partial<ElementDefinition>);
    });
    edges.forEach((edge) =>
      addOrUpdate(edge, { group: "edges", style: { opacity: 0 } } as Partial<ElementDefinition>),
    );
    replaced.style("opacity", 0);
  });

  const incoming = cy.elements().filter((ele) => incomingIds.has(ele.id()));
  const faded = added
    .reduce((all, ele) => all.union(ele), cy.collection())
    .filter((ele) => ele.isEdge() || !sources[ele.id()]);

  // New nodes start beside their neighbours rather than at the origin
  if (!positions) {
    faded.nodes().forEach((node) => {
      const placed = node.neighborhood("node").filter((neighbour) => !faded.has(neighbour));
      if (placed.length > 0) node.position(centre(placed.nodes().map((n) => n.position())));
    });
  }

  fadeTo(outgoing, 0, fade);
  fadeTo(faded, 1, fade);

  // Interrupted animations never complete, so cleaning up cannot rely on them
  setTimeout(() => {
    if (!cy.destroyed() && cy.scratch(SCRATCH_KEY) === transition) {
      outgoing.remove();
      faded.removeStyle("opacity");
    }
  }, fade + 50);

  const pinned = new Map<string, { nodeId: string; position: Position }>();
  Object.entries(sources).forEach(([nodeId, points]) => {
    const position = centre(points);
    const spot = `${position.x},${position.y}`;
    // A node split in two would pin both halves to one spot
    if (incomingIds.has(nodeId) && !pinned.has(spot)) pinned.set(spot, { nodeId, position });
  });

  transition.layout = incoming.layout(
    (positions
      ? {
          name: "preset",
          positions,
          animate: move > 0,
          animationDuration: move,
          animationEasing: "ease-in-out",
          fit: true,
          padding: 30,
        }
      : {
          ...fcoseLayout,
          animate: move > 0,
          animationDuration: move,
          fixedNodeConstraint: [...pinned.values()],
        }) as unknown as LayoutOptions,
  );
  transition.layout.one("layoutstop", () => {
    if (cy.scratch(SCRATCH_KEY) === transition) onSettled();
  });
  transition.layout.run();
}
