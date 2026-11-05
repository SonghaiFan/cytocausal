import type { FeedbackLoop } from "@cytocausal/core";
import type { Core } from "cytoscape";

const CLASSES = "dimmed focus cause effect cause-link effect-link";

/** Dims the graph except the given nodes and what directly causes or follows from them. */
export function highlightCausalNeighbours(cy: Core, ids: string[]) {
  cy.batch(() => {
    cy.elements().removeClass(CLASSES);
    if (ids.length === 0) return;
    cy.elements().addClass("dimmed");
    for (const id of ids) {
      const node = cy.getElementById(id);
      const causes = node.incomers();
      const effects = node.outgoers();
      causes.removeClass("dimmed");
      effects.removeClass("dimmed");
      causes.nodes().addClass("cause");
      causes.edges().addClass("cause-link");
      effects.nodes().addClass("effect");
      effects.edges().addClass("effect-link");
    }
    for (const id of ids) cy.getElementById(id).removeClass("dimmed cause effect").addClass("focus");
  });
}

/** Dims the graph except one feedback loop, or clears the highlight. */
export function highlightLoop(cy: Core, loop: FeedbackLoop | null) {
  cy.batch(() => {
    cy.elements().removeClass("dimmed loop-node loop-link");
    if (!loop) return;
    cy.elements().addClass("dimmed");
    loop.nodes.forEach((id) => cy.getElementById(id).removeClass("dimmed").addClass("loop-node"));
    loop.edges.forEach((id) => cy.getElementById(id).removeClass("dimmed").addClass("loop-link"));
  });
}
