import assert from "node:assert/strict";
import test from "node:test";
import cytoscape from "cytoscape";
import { analyzeSnapshot, stronglyConnectedComponents, type Snapshot } from "../src/index.ts";

/** A small random graph, with links from nodes to themselves, parallel links and loose parts. */
function randomSnapshot(seed: number): Snapshot {
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
  const size = 1 + Math.floor(random() * 14);
  const nodes = Array.from({ length: size }, (_, index) => ({ id: `n${index}`, label: `${index}` }));
  const links = Math.floor(random() * size * 2.5);
  const edges = Array.from({ length: links }, (_, index) => ({
    id: `e${index}`,
    source: nodes[Math.floor(random() * size)].id,
    target: nodes[Math.floor(random() * size)].id,
  }));
  return { id: `s${seed}`, nodes, edges };
}

/** What Cytoscape reports, which core used to depend on. */
function cytoscapeAnalysis({ nodes, edges }: Snapshot) {
  const cy = cytoscape({
    headless: true,
    elements: [
      ...nodes.map(({ id }) => ({ data: { id } })),
      ...edges.map(({ source, target }, index) => ({ data: { id: `edge-${index}`, source, target } })),
    ],
  });
  const centrality = cy.elements().betweennessCentrality({ directed: true });
  return {
    betweenness: Object.fromEntries(cy.nodes().map((node) => [node.id(), centrality.betweennessNormalized(node)])),
    groups: cy
      .elements()
      .tarjanStronglyConnected()
      .components.map((component) => component.nodes().map((node) => node.id()).sort()),
  };
}

const canonical = (groups: string[][]) => groups.map((group) => [...group].sort()).map(String).sort();

test("analysis matches Cytoscape on random graphs", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const snapshot = randomSnapshot(seed);
    const expected = cytoscapeAnalysis(snapshot);
    const actual = analyzeSnapshot(snapshot);
    for (const { id } of snapshot.nodes) {
      assert.ok(Math.abs(actual.betweenness[id] - expected.betweenness[id]) < 1e-9, `${snapshot.id} ${id}`);
    }
    assert.deepEqual(
      canonical(stronglyConnectedComponents(snapshot)),
      canonical(expected.groups),
      snapshot.id,
    );
  }
});

test("a long chain doesn't overflow the stack", () => {
  const size = 50_000;
  const nodes = Array.from({ length: size }, (_, index) => ({ id: `${index}`, label: "" }));
  const edges = nodes.map(({ id }, index) => ({ id: `e${id}`, source: id, target: `${(index + 1) % size}` }));
  const groups = stronglyConnectedComponents({ id: "ring", nodes, edges });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, size);
});
