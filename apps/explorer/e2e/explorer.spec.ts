import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Node = {
  id: string;
  label: string;
  evidence: { text: string }[];
  metadata: { score: number; inFeedbackLoop: boolean };
  position: { x: number; y: number };
};

// Expected values come from the data, so these tests also pass on a regenerated sample
const dataset: { id: string; snapshots: { nodes: Node[]; edges: unknown[] }[] } = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../public/dataset.json"), "utf8"),
);
const [{ nodes, edges }] = dataset.snapshots;
const byScore = [...nodes].sort((a, b) => b.metadata.score - a.metadata.score);
const [first, second, third] = byScore;
const inLoops = nodes.filter((node) => node.metadata.inFeedbackLoop);
const outsideLoops = nodes.find((node) => !node.metadata.inFeedbackLoop)!;

const labelHas = (word: string) => nodes.filter((n) => n.label.toLowerCase().includes(word)).length;
const matches = (word: string) =>
  nodes.filter(
    (node) =>
      node.label.toLowerCase().includes(word) ||
      node.evidence.some(({ text }) => text.toLowerCase().includes(word)),
  ).length;
const matchText = (count: number) => `${count} ${count === 1 ? "match" : "matches"}`;

// A word that only appears in descriptions, to prove search reaches them
const descriptionWord = nodes
  .flatMap((node) => node.evidence.flatMap(({ text }) => text.toLowerCase().split(/\W+/)))
  .find((word) => word.length > 4 && labelHas(word) === 0)!;

/** Waits for the graph to finish drawing and returns basic facts about it. */
async function ready(page: Page) {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
        return div?._cyreg.cy.nodes().length ?? 0;
      }),
    )
    .toBe(nodes.length);
}

/** Runs a function against the Cytoscape instance in the page. */
const withCy = <T>(page: Page, code: string): Promise<T> =>
  page.evaluate((body) => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return new Function("cy", "div", body)(div._cyreg.cy, div);
  }, code);

/** Moves a node into view and returns its position on the page. */
const pointOf = async (page: Page, id: string) => {
  await withCy(page, `cy.stop(); cy.zoom(3); cy.center(cy.getElementById("${id}"));`);
  await page.waitForTimeout(100);
  return withCy<{ x: number; y: number }>(
    page,
    `const { left, top } = div.getBoundingClientRect();
     const { x, y } = cy.getElementById("${id}").renderedPosition();
     return { x: left + x, y: top + y };`,
  );
};

/** Clicks a node; with `add`, first asks the menu to trace paths to it. */
const clickNode = async (page: Page, id: string, { add = false } = {}) => {
  if (add) await page.getByRole("menuitemcheckbox", { name: "Trace paths to another node" }).click();
  const { x, y } = await pointOf(page, id);
  await page.mouse.click(x, y);
  if (!add) {
    await page.getByLabel(/^Causal graph/).focus();
    await page.keyboard.press("Shift+F10");
  }
};

const search = (page: Page) => page.getByLabel("Search events and descriptions");
const panels = (page: Page) => page.locator('section[aria-label^="Node "]');

test("the published data stays a sample", () => {
  expect(dataset.id).toBe("access-sample");
  expect(nodes.length).toBeLessThanOrEqual(100);
  expect(Math.max(...nodes.map((node) => node.evidence.length))).toBeLessThanOrEqual(5);
});

test("shows the sample and says the full benchmark is on request", async ({ page }) => {
  await ready(page);
  await expect(page.getByText(`${nodes.length} nodes, ${edges.length} edges`)).toBeVisible();
  await expect(page.getByRole("link", { name: "available on request" })).toBeVisible();
});

test("search finds words anywhere in labels", async ({ page }) => {
  await ready(page);
  // Labels start with "a person", so these only match mid-label
  for (const word of ["place", "something"]) {
    expect(labelHas(word)).toBeGreaterThan(0);
    await search(page).fill(word);
    await expect(page.getByText(matchText(matches(word)), { exact: true })).toBeVisible();
  }
});

test("search reaches sentences and node ids", async ({ page }) => {
  await ready(page);
  await search(page).fill(descriptionWord);
  await expect(page.getByText(matchText(matches(descriptionWord)), { exact: true })).toBeVisible();
  await search(page).fill(first.id);
  await expect(page.getByRole("button", { name: first.label })).toBeVisible();
});

test("choosing a search result opens its sentences and zooms to it", async ({ page }) => {
  await ready(page);
  const before = await withCy<number>(page, "return cy.zoom();");
  await search(page).fill(first.id);
  await page.getByRole("button", { name: first.label, exact: true }).click();
  await expect(panels(page)).toHaveCount(1);
  await expect(page.getByText(`Descriptions (${first.evidence.length})`)).toBeVisible();
  await expect.poll(() => withCy<number>(page, "return cy.zoom();")).toBeGreaterThan(before);
});

test("sentences stay open after the mouse leaves", async ({ page }) => {
  await ready(page);
  await clickNode(page, first.id);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  await expect(page.getByText(`Descriptions (${first.evidence.length})`)).toBeVisible();
});

test("two nodes can be compared, and clicking the background clears them", async ({ page }) => {
  await ready(page);
  await clickNode(page, first.id);
  // Tracing adds a node to compare; a plain click on a third starts again from it
  await clickNode(page, second.id, { add: true });
  await expect(panels(page)).toHaveCount(2);
  await clickNode(page, third.id);
  await expect(panels(page)).toHaveCount(1);
  await expect(page.getByLabel(`Node ${third.id}`)).toHaveCount(1);

  await withCy(page, "cy.fit(); cy.panBy({ x: 3000, y: 0 });");
  await page.mouse.click(300, 450);
  await expect(panels(page)).toHaveCount(0);
});

test("dense neighbour fans follow real bearings without a minimum width", async ({ page }) => {
  await ready(page);
  const id = await withCy<string>(page,
    `return cy.nodes().sort((a, b) => b.neighborhood("node").length - a.neighborhood("node").length)[0].id();`);
  await clickNode(page, id);
  await expect(page.locator(".cc-radial")).toBeVisible();
  await expect.poll(() => withCy<boolean>(page, `
    const area = cy.scratch("cytocausal-radial-area");
    if (!area?.sectors?.length) return false;
    const centre = cy.getElementById(area.node).renderedPosition();
    return area.sectors.every((sector) => {
      const point = cy.getElementById(sector.node).renderedPosition();
      const bearing = Math.atan2(point.y - centre.y, point.x - centre.x);
      const along = ((bearing - sector.from) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      return along <= sector.to - sector.from + 1e-8;
    });
  `)).toBe(true);
});

test("faded links don't block pointing toward a linked node", async ({ page }) => {
  await ready(page);
  // A node with a handful of links, in the middle of the view, at the zoom people see it
  const id = await withCy<string>(
    page,
    `const node = cy.nodes().filter((n) => { const k = n.neighborhood("node").length; return k >= 4 && k <= 6; })[0];
     return node.id();`,
  );
  await clickNode(page, id);
  await expect(page.locator(".cc-radial")).toBeVisible();
  await page.waitForTimeout(800);

  // A point in one of the node's directions where the link under the pointer is an unrelated,
  // faded one, as a dense graph has almost everywhere
  const spot = await withCy<{ x: number; y: number; link: string } | null>(
    page,
    `const area = cy.scratch("cytocausal-radial-area");
     const box = div.getBoundingClientRect();
     const pan = cy.pan(), zoom = cy.zoom();
     const centre = cy.getElementById(area.node).renderedPosition();
     for (const sector of area.sectors) {
       for (let r = area.radius + 20; r < sector.reach - 10; r += 6) {
         for (let f = 0.2; f <= 0.8; f += 0.1) {
           const angle = sector.from + (sector.to - sector.from) * f;
           const x = centre.x + r * Math.cos(angle), y = centre.y + r * Math.sin(angle);
           const hit = cy.renderer().findNearestElement((x - pan.x) / zoom, (y - pan.y) / zoom, true, false);
           if (hit && hit.isEdge() && hit.hasClass("dimmed") && !sector.links.includes(hit.id()))
             return { x: box.left + x, y: box.top + y, link: hit.id(), node: sector.node };
         }
       }
     }
     return null;`,
  );
  expect(spot, "a faded link inside a direction").not.toBeNull();
  const label = nodes.find((node) => node.id === (spot as any).node)!.label;

  await page.mouse.move(spot!.x, spot!.y);
  await expect(page.locator(".cc-radial-caption")).toContainText(`: ${label}`);
  await page.waitForTimeout(600);
  await expect(page.locator(".cc-floating")).toHaveCount(0);

  // Clicking walks there, rather than choosing the faded link
  await page.mouse.click(spot!.x, spot!.y);
  await expect(page.getByLabel(`Node ${(spot as any).node}`)).toBeVisible();
});

test("causes and effects follow edge direction", async ({ page }) => {
  await ready(page);
  await clickNode(page, first.id);
  const result = await withCy<Record<string, string[]>>(
    page,
    `const node = cy.getElementById("${first.id}");
     const ids = (eles) => eles.map((e) => e.id()).sort();
     return {
       causes: ids(cy.nodes(".cause")), effects: ids(cy.nodes(".effect")),
       incomers: ids(node.incomers("node")), outgoers: ids(node.outgoers("node")),
       focus: ids(cy.nodes(".focus")),
     };`,
  );
  expect(result.focus).toEqual([first.id]);
  expect(result.causes).toEqual(result.incomers);
  expect(result.effects).toEqual(result.outgoers);
  expect(result.causes.length).toBeGreaterThan(0);
  expect(result.effects.length).toBeGreaterThan(0);
});

test("node size shows directed centrality", async ({ page }) => {
  await ready(page);
  const sizes = await withCy<{ top: number; zero: number; highest: string }>(
    page,
    `const sorted = cy.nodes().sort((a, b) => b.data("score") - a.data("score"));
     return {
       highest: sorted[0].id(),
       top: sorted[0].renderedWidth(),
       zero: cy.nodes().filter((n) => n.data("score") === 0)[0].renderedWidth(),
     };`,
  );
  expect(sizes.highest).toBe(first.id);
  // In pixels on screen, which spread zoom keeps constant
  expect(sizes.top).toBeCloseTo(24, 1);
  expect(sizes.zero).toBeCloseTo(5, 1);
});

test("feedback loops can be isolated", async ({ page }) => {
  await ready(page);
  await clickNode(page, outsideLoops.id);
  await expect(panels(page)).toHaveCount(1);
  await page.getByLabel("Show only cyclic events").check();
  await expect(page.getByText(new RegExp(`^${inLoops.length} nodes, \\d+ edges$`))).toBeVisible();
  await expect(panels(page)).toHaveCount(0);
  await expect
    .poll(() => withCy<number>(page, 'return cy.nodes(":visible").length;'))
    .toBe(inLoops.length);

  await search(page).fill(first.id);
  await expect(page.getByRole("status").filter({ hasText: "match" })).toBeVisible();

  await page.getByLabel("Show only cyclic events").uncheck();
  await expect(page.getByText(`${nodes.length} nodes, ${edges.length} edges`)).toBeVisible();
  await expect
    .poll(() => withCy<number>(page, 'return cy.nodes(":visible").length;'))
    .toBe(nodes.length);
});

test("a node lists its short feedback loops, and choosing one highlights it", async ({ page }) => {
  await ready(page);
  await clickNode(page, first.id);
  await expect(page.getByText(/^Event cycles \(\d+\+?\)$/)).toBeVisible();

  const panel = page.getByLabel(`Node ${first.id}`);
  const loop = panel.getByRole("button", { pressed: false }).filter({ hasText: "→" }).first();
  await loop.click();
  const counts = () =>
    withCy<{ nodes: number; links: number; causes: number }>(
      page,
      `return { nodes: cy.nodes(".route-node").length, links: cy.edges(".route-link").length,
                causes: cy.nodes(".cause").length };`,
    );
  await expect.poll(async () => (await counts()).nodes).toBeGreaterThan(1);
  const { nodes, links, causes } = await counts();
  expect(links).toBe(nodes);
  expect(causes).toBe(0);

  await panel.getByRole("button", { pressed: true }).click();
  await expect.poll(async () => (await counts()).nodes).toBe(0);
  expect((await counts()).causes).toBeGreaterThan(0);
});

test("hovering a node only highlights it", async ({ page }) => {
  await ready(page);
  const { x, y } = await pointOf(page, first.id);
  await page.mouse.move(x, y);
  await page.waitForTimeout(600);
  await expect(page.locator(".cc-floating")).toHaveCount(0);
  await expect.poll(() => withCy<string[]>(page, "return cy.nodes('.focus').map((n) => n.id());")).toEqual([first.id]);
});

test("labels stay readable at every zoom level", async ({ page }) => {
  await ready(page);
  const measure = () =>
    withCy<{ labels: number; overlapping: number; fontSize: number }>(
      page,
      `const boxes = cy.nodes(".labelled").map((n) =>
         n.boundingBox({ includeNodes: false, includeEdges: false, includeOverlays: false }));
       let overlapping = 0;
       boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
         if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) overlapping++;
       }));
       const size = parseFloat(cy.nodes()[0].style("font-size"));
       return { labels: boxes.length, overlapping, fontSize: size * cy.zoom() };`,
    );

  const base = await withCy<number>(page, "return cy.zoom();");
  for (const steps of [0, 1, 2, 3, 2]) {
    await withCy(page, `cy.zoom({ level: ${base * 1.5 ** steps}, renderedPosition: { x: 500, y: 450 } });`);
    await page.waitForTimeout(300);
    const { labels, overlapping, fontSize } = await measure();
    expect(labels, `labels at step ${steps}`).toBeGreaterThan(0);
    expect(labels).toBeLessThanOrEqual(60);
    expect(overlapping, `overlaps at step ${steps}`).toBe(0);
    expect(fontSize).toBeCloseTo(12, 0);
  }
});

test("fitting the graph is stable", async ({ page }) => {
  await ready(page);
  const zoom = () => withCy<number>(page, "return cy.zoom();");
  const levels = [await zoom()];
  for (let press = 0; press < 3; press++) {
    await page.getByLabel("Fit graph").click();
    await page.waitForTimeout(500);
    levels.push(await zoom());
  }
  for (const level of levels) expect(level).toBeCloseTo(levels[0], 3);
});

test("zoom controls work", async ({ page }) => {
  await ready(page);
  const zoom = () => withCy<number>(page, "return cy.zoom();");
  const before = await zoom();
  await page.getByLabel("Zoom in").click();
  await expect.poll(zoom).toBeGreaterThan(before);
  await page.getByLabel("Fit graph").click();
  await expect.poll(async () => Math.abs((await zoom()) - before)).toBeLessThan(0.01);
});

test("the header links back to the docs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Docs" })).toHaveAttribute(
    "href",
    "http://localhost:3200/en/case-explorer/",
  );
});

test("a highlight labels what it reaches without stacking labels", async ({ page }) => {
  await ready(page);
  await clickNode(page, first.id);
  await withCy(page, "cy.fit();");
  const measure = () =>
    withCy<{ labels: number; overlapping: number; dimmed: number; selected: number; outline: number }>(
      page,
      `const shown = cy.nodes(".labelled");
       const boxes = shown.map((n) =>
         n.renderedBoundingBox({ includeNodes: false, includeEdges: false, includeOverlays: false }));
       let overlapping = 0;
       boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
         if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) overlapping++;
       }));
       return {
         labels: shown.length,
         overlapping,
         dimmed: cy.nodes(".dimmed.labelled").length,
         selected: cy.nodes(".focus.labelled").length,
         outline: parseFloat(shown[0].style("text-outline-width")) * cy.zoom(),
       };`,
    );

  for (const depth of ["1", "2"]) {
    await page.getByRole("button", { name: depth, exact: true }).click();
    await page.waitForTimeout(300);
    const { labels, overlapping, dimmed, selected, outline } = await measure();
    expect(labels, `labels at depth ${depth}`).toBeGreaterThan(1);
    expect(overlapping, `overlaps at depth ${depth}`).toBe(0);
    expect(dimmed).toBe(0);
    expect(selected).toBe(1);
    expect(outline).toBeCloseTo(2, 1);
  }

  // Zoomed in, links and outlines stay as thin as they were
  await withCy(page, `cy.zoom({ level: cy.zoom() * 4, renderedPosition: cy.getElementById("${first.id}").renderedPosition() });`);
  await page.waitForTimeout(400);
  const widths = await withCy<number[]>(
    page,
    "return cy.edges().map((edge) => parseFloat(edge.style('width')) * cy.zoom());",
  );
  expect(Math.max(...widths)).toBeLessThanOrEqual(3.01);
  // Arrows too, sized as Cytoscape's renderer does: 0.3 × max((width × 13.37) ^ 0.9, 29) × scale
  const arrows = await withCy<number[]>(
    page,
    `return cy.edges().map((edge) => {
       const width = parseFloat(edge.style("width"));
       const size = Math.max(Math.pow(width * 13.37, 0.9), 29) * parseFloat(edge.style("arrow-scale"));
       return 0.3 * size * cy.zoom();
     });`,
  );
  expect(Math.min(...arrows)).toBeGreaterThanOrEqual(5);
  expect(Math.max(...arrows)).toBeLessThanOrEqual(8);
  // The keyboard cursor's outline stays three pixels, and the selection needs no ring at all
  const sizes = await withCy<{ outline: number; border: number }>(
    page,
    `const node = cy.getElementById("${first.id}").addClass("keyboard-cursor");
     const result = {
       outline: parseFloat(node.style("outline-width")) * cy.zoom(),
       border: parseFloat(node.style("border-width")),
     };
     node.removeClass("keyboard-cursor");
     return result;`,
  );
  expect(sizes.outline).toBeCloseTo(3, 0);
  expect(sizes.border).toBe(0);
  expect((await measure()).overlapping).toBe(0);
});

test("each zoom mode changes marks by its own rule", async ({ page }) => {
  await ready(page);
  const sizes = () =>
    withCy<{ dot: number; line: number; text: number }>(
      page,
      `const node = cy.nodes().max((n) => n.data("score")).ele;
       const labelled = cy.nodes(".labelled")[0];
       return {
         dot: node.renderedWidth(),
         line: parseFloat(cy.edges()[0].style("width")) * cy.zoom(),
         text: parseFloat(labelled.style("font-size")) * cy.zoom(),
       };`,
    );
  const zoomedBy = async (factor: number) => {
    await withCy(page, "cy.fit();");
    await page.waitForTimeout(300);
    const before = await sizes();
    await withCy(page, `cy.zoom({ level: cy.zoom() * ${factor}, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });`);
    await page.waitForTimeout(300);
    const after = await sizes();
    return { dot: after.dot / before.dot, line: after.line / before.line, text: after.text / before.text };
  };

  // Spread is the default: nothing changes size on screen
  const spread = await zoomedBy(4);
  expect(spread.dot).toBeCloseTo(1, 1);
  expect(spread.line).toBeCloseTo(1, 1);

  await page.getByRole("button", { name: "Balanced", exact: true }).click();
  const balanced = await zoomedBy(4);
  expect(balanced.dot).toBeCloseTo(2, 1);
  expect(balanced.line).toBeCloseTo(2, 1);

  await page.getByRole("button", { name: "Magnify", exact: true }).click();
  const magnify = await zoomedBy(4);
  expect(magnify.dot).toBeCloseTo(4, 1);
  expect(magnify.line).toBeCloseTo(4, 1);

  // Managed labels stay readable in every mode
  for (const mode of [spread, balanced, magnify]) expect(mode.text).toBeCloseTo(1, 1);
});

/** Node positions once nothing is moving. */
const settledPositions = async (page: Page) => {
  let previous = "";
  await expect
    .poll(
      async () => {
        const now = await withCy<string>(
          page,
          `return cy.nodes().filter((n) => n.animated()).length > 0 ? "moving" :
             JSON.stringify(cy.nodes().map((n) => [n.id(), Math.round(n.position().x), Math.round(n.position().y)]));`,
        );
        const stable = now !== "moving" && now === previous;
        previous = now;
        return stable;
      },
      { timeout: 15_000, intervals: [300] },
    )
    .toBe(true);
  return new Map<string, [number, number]>(
    (JSON.parse(previous) as [string, number, number][]).map(([id, x, y]) => [id, [x, y]]),
  );
};

test("layouts can be switched on the same graph, and the original comes back exactly", async ({ page }) => {
  await ready(page);
  await withCy(page, `cy.scratch("same-graph", true);`);
  const original = await settledPositions(page);
  const fromData = new Map(nodes.map((node) => [node.id, node.position]));
  const [id, [x, y]] = [...original][0];
  expect(Math.abs(x - fromData.get(id)!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(y - fromData.get(id)!.y)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Force", exact: true }).click();
  const force = await settledPositions(page);
  const moved = [...force].filter(([node, [fx, fy]]) => {
    const [ox, oy] = original.get(node)!;
    return Math.hypot(fx - ox, fy - oy) > 5;
  });
  expect(moved.length).toBeGreaterThan(nodes.length / 2);

  // The most central events ring the most central one closely, and the least central lie outside
  await page.getByRole("button", { name: "By centrality", exact: true }).click();
  const rings = await settledPositions(page);
  const [cx, cy] = rings.get(first.id)!;
  const distance = (node: string) => Math.hypot(rings.get(node)![0] - cx, rings.get(node)![1] - cy);
  const average = (ids: string[]) => ids.reduce((sum, id) => sum + distance(id), 0) / ids.length;
  const ranked = byScore.map((node) => node.id).slice(1);
  expect(average(ranked.slice(0, 10))).toBeLessThan(average(ranked.slice(-50)));

  await page.getByRole("button", { name: "Original", exact: true }).click();
  const back = await settledPositions(page);
  for (const [node, [ox, oy]] of original) {
    expect(Math.hypot(back.get(node)![0] - ox, back.get(node)![1] - oy), node).toBeLessThanOrEqual(1);
  }
  expect(await withCy<boolean>(page, `return cy.scratch("same-graph") === true;`)).toBe(true);

  // Labels are placed again once the nodes arrive
  const overlapping = await withCy<number>(
    page,
    `const boxes = cy.nodes(".labelled").map((n) =>
       n.renderedBoundingBox({ includeNodes: false, includeEdges: false, includeOverlays: false }));
     let count = 0;
     boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
       if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) count++;
     }));
     return count;`,
  );
  expect(overlapping).toBe(0);
});

test("with a computed layout, showing only loops lays out what's left", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Force", exact: true }).click();
  const all = await settledPositions(page);
  await page.getByLabel("Show only cyclic events").check();
  const loops = await settledPositions(page);
  const hidden = nodes.filter((node) => !node.metadata.inFeedbackLoop).map((node) => node.id);
  const shown = nodes.filter((node) => node.metadata.inFeedbackLoop).map((node) => node.id);
  // Hidden nodes stay put, and the loops move into a layout of their own
  for (const node of hidden) expect(loops.get(node)).toEqual(all.get(node));
  const movedLoops = shown.filter((node) => {
    const [ax, ay] = all.get(node)!;
    const [lx, ly] = loops.get(node)!;
    return Math.hypot(lx - ax, ly - ay) > 5;
  });
  expect(movedLoops.length).toBeGreaterThan(0);
});

test("nodes stay on screen while they move between layouts", async ({ page }) => {
  await ready(page);
  for (const name of ["Force", "By centrality", "Original", "By centrality", "Force", "Original"]) {
    await page.getByRole("button", { name, exact: true }).click();
    // Sample the whole move, not just where it ends
    const worst = await withCy<number>(
      page,
      `return new Promise((resolve) => {
         let worst = 0;
         const started = performance.now();
         const sample = () => {
           const box = cy.nodes().renderedBoundingBox({ includeLabels: false });
           worst = Math.max(worst, -box.x1, -box.y1, box.x2 - cy.width(), box.y2 - cy.height());
           if (performance.now() - started < 1500) requestAnimationFrame(sample);
           else resolve(worst);
         };
         sample();
       });`,
    );
    expect(worst, `pixels off screen switching to ${name}`).toBeLessThanOrEqual(2);
  }
});

test("the flow layout runs causes into effects, and the address keeps the layout", async ({ page }) => {
  await ready(page);
  const forwards = () =>
    withCy<number>(
      page,
      `const edges = cy.edges();
       return edges.filter((e) => e.target().position("x") > e.source().position("x")).length / edges.length;`,
    );
  const before = await forwards();
  await page.getByRole("button", { name: "Flow", exact: true }).click();
  await expect(page).toHaveURL(/layout=flow/);
  await settledPositions(page);
  // Loops mean some links must run backwards, but far more go left to right than before
  const after = await forwards();
  expect(after).toBeGreaterThan(0.6);
  expect(after - before).toBeGreaterThan(0.1);

  await page.reload();
  await expect(page.getByRole("button", { name: "Flow", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("cycle searches run in workers, can be cancelled, and restart with the selected length", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const tracker = { started: 0, terminated: 0, hold: true };
    (window as any).cycleWorkers = tracker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        tracker.started++;
      }
      postMessage(message: any) {
        // Keep work pending deterministically, including fast sample graphs.
        if (!tracker.hold) super.postMessage(message);
      }
      terminate() { tracker.terminated++; super.terminate(); }
    };
  });
  await ready(page);
  await clickNode(page, first.id);
  const panel = page.getByLabel(`Node ${first.id}`);
  await expect(panel.getByText("Calculating…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel calculation", exact: true })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Maximum cycle length" })).toHaveValue("4");
  const previous = await page.evaluate(() => (window as any).cycleWorkers.terminated);
  await page.getByRole("spinbutton", { name: "Maximum cycle length" }).fill("5");
  await expect.poll(() => page.evaluate(() => (window as any).cycleWorkers.terminated)).toBeGreaterThan(previous);
  await expect(panel.getByText("Calculating…")).toBeVisible();
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(panel.getByText("Calculation cancelled.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const t = (window as any).cycleWorkers; return t.started === t.terminated;
  })).toBe(true);
  await page.getByRole("spinbutton", { name: "Maximum cycle length" }).fill("6");
  await expect(panel.getByText("Calculation cancelled.")).toBeVisible();
  await page.evaluate(() => { (window as any).cycleWorkers.hold = false; });
  await page.getByRole("button", { name: "Resume calculation" }).click();
  await expect(panel.getByRole("heading", { name: /^Event cycles \(\d+\+?\)$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel calculation", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("status")).toContainText(/\d+\+? cycles · [\d.]+ (ms|s)/);
  await expect(page.locator(".cc-loop-settings").getByRole("status")).toContainText(/\d+\+? cycles · Longest search: [\d.]+ (ms|s)/);
  await page.getByRole("spinbutton", { name: "Maximum cycle length" }).fill("1");
  await expect(panel.getByText("No event cycles found within this range")).toBeVisible();
});

test("a failed worker is reported instead of claiming there are no cycles", async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class { constructor() { throw new Error("Worker unavailable for test"); } } as any;
  });
  await ready(page);
  await clickNode(page, first.id);
  const panel = page.getByLabel(`Node ${first.id}`);
  await expect(panel.getByText("Worker unavailable for test")).toBeVisible();
  await expect(panel.getByText("No event cycles found within this range")).toHaveCount(0);
});
