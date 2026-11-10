import { filterByContributors, type ChangeMarks, type Snapshot } from "@cytocausal/core";
import type { Core } from "cytoscape";
import { centerView } from "./view.ts";
import { refreshLabels } from "./labels.ts";
import { resolveMotion } from "./motion.ts";
import type { CausalMotion } from "./theme.ts";

export interface Route {
  nodes: string[];
  edges: string[];
}

/**
 * Whether two routes are the same loop or path, by the links they follow. A loop found from
 * another of its nodes lists the same links in a rotated order, as the loop list and the radial
 * menu do, so order doesn't matter: a route never uses a link twice.
 */
export function sameRoute(a: Route | null | undefined, b: Route | null | undefined) {
  if (!a || !b || a.edges.length !== b.edges.length) return false;
  const links = new Set(a.edges);
  return b.edges.every((edge) => links.has(edge));
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
  refreshLabels(cy);
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
  refreshLabels(cy);
}

/**
 * Marks what's new, gone or changed in this version, such as from `changeMarks`. Pass empty
 * marks to clear them. Lists of added and removed ids alone still work.
 */
export function highlightChanges(
  cy: Core,
  marks: Partial<ChangeMarks> | string[],
  removed: string[] = [],
) {
  const { added = [], removed: gone = [], changed = [], flipped = [] } = Array.isArray(marks)
    ? { added: marks, removed }
    : marks;
  cy.batch(() => {
    cy.elements().removeClass("diff-added diff-removed diff-changed diff-flipped diff-context");
    // What didn't change becomes context, so the changes stand out by contrast
    const marked = new Set([...added, ...gone, ...changed]);
    if (marked.size > 0) {
      cy.elements()
        .filter((element) => !marked.has(element.id()))
        .addClass("diff-context");
    }
    added.forEach((id) => cy.getElementById(id).addClass("diff-added"));
    gone.forEach((id) => cy.getElementById(id).addClass("diff-removed"));
    changed.forEach((id) => cy.getElementById(id).addClass("diff-changed"));
    flipped.forEach((id) => cy.getElementById(id).addClass("diff-flipped"));
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
  refreshLabels(cy);
}

/** Moves the view to a node. */
export function focusNode(cy: Core, id: string, { zoom = 2, motion }: FocusOptions = {}) {
  const node = cy.getElementById(id);
  if (node.length > 0) {
    centerView(cy, node.position(), zoom, resolveMotion(motion).focus);
  }
}
