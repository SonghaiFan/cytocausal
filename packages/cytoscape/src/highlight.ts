import { filterByContributors, type Snapshot } from "@cytocausal/core";
import type { Core } from "cytoscape";
import { resolveMotion } from "./motion.ts";
import type { CausalMotion } from "./theme.ts";

export interface Route {
  nodes: string[];
  edges: string[];
}

export interface FocusOptions {
  zoom?: number;
  motion?: CausalMotion;
}

const CLASSES = "dimmed focus cause effect cause-link effect-link";

/**
 * Dims the graph except the given nodes and what causes or follows from them, up to `depth`
 * links away.
 */
export function highlightCausalNeighbours(cy: Core, ids: string[], depth = 1) {
  cy.batch(() => {
    cy.elements().removeClass(CLASSES);
    if (ids.length === 0) return;
    cy.elements().addClass("dimmed");
    for (const id of ids) {
      let upstream = cy.getElementById(id).nodes();
      let downstream = upstream;
      for (let step = 0; step < depth; step++) {
        const causes = upstream.incomers();
        const effects = downstream.outgoers();
        causes.removeClass("dimmed");
        effects.removeClass("dimmed");
        causes.nodes().addClass("cause");
        causes.edges().addClass("cause-link");
        effects.nodes().addClass("effect");
        effects.edges().addClass("effect-link");
        upstream = causes.nodes();
        downstream = effects.nodes();
      }
    }
    for (const id of ids) cy.getElementById(id).removeClass("dimmed cause effect").addClass("focus");
  });
}

/** Dims the graph except one route through it, such as a loop or a path, or clears it. */
export function highlightRoute(cy: Core, route: Route | null) {
  cy.batch(() => {
    cy.elements().removeClass("dimmed route-node route-link");
    if (!route) return;
    cy.elements().addClass("dimmed");
    route.nodes.forEach((id) => cy.getElementById(id).removeClass("dimmed").addClass("route-node"));
    route.edges.forEach((id) => cy.getElementById(id).removeClass("dimmed").addClass("route-link"));
  });
}

/** Marks what's new or gone in this version. Pass empty lists to clear it. */
export function highlightChanges(cy: Core, added: string[], removed: string[]) {
  cy.batch(() => {
    cy.elements().removeClass("diff-added diff-removed");
    added.forEach((id) => cy.getElementById(id).addClass("diff-added"));
    removed.forEach((id) => cy.getElementById(id).addClass("diff-removed"));
  });
}

/**
 * Hides everything the given people didn't state, keeping every position so views stay
 * comparable. Pass null to show everyone's again.
 */
export function hideExceptContributors(cy: Core, snapshot: Snapshot, contributors: string[] | null) {
  cy.batch(() => {
    cy.elements().removeClass("contributor-hidden");
    if (!contributors) return;
    const { nodes, edges } = filterByContributors(snapshot, contributors);
    const kept = new Set([...nodes, ...edges].map(({ id }) => id));
    cy.elements()
      .filter((element) => !kept.has(element.id()))
      .addClass("contributor-hidden");
  });
}

/** Moves the view to a node. */
export function focusNode(cy: Core, id: string, { zoom = 2, motion }: FocusOptions = {}) {
  const node = cy.getElementById(id);
  if (node.length > 0) {
    cy.animate({ center: { eles: node }, zoom }, { duration: resolveMotion(motion).focus });
  }
}
