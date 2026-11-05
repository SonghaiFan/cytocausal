import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Node = {
  id: string;
  label: string;
  evidence: { text: string }[];
  metadata: { score: number; inFeedbackLoop: boolean };
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

const clickNode = async (page: Page, id: string) => {
  const { x, y } = await pointOf(page, id);
  await page.mouse.click(x, y);
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
  await clickNode(page, second.id);
  await expect(panels(page)).toHaveCount(2);
  await clickNode(page, third.id);
  await expect(panels(page)).toHaveCount(2);
  await expect(page.getByLabel(`Node ${first.id}`)).toHaveCount(0);

  await withCy(page, "cy.fit(); cy.panBy({ x: 3000, y: 0 });");
  await page.mouse.click(300, 450);
  await expect(panels(page)).toHaveCount(0);
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
       top: sorted[0].width(),
       zero: cy.nodes().filter((n) => n.data("score") === 0)[0].width(),
     };`,
  );
  expect(sizes.highest).toBe(first.id);
  expect(sizes.top).toBe(24);
  expect(sizes.zero).toBe(5);
});

test("feedback loops can be isolated", async ({ page }) => {
  await ready(page);
  await clickNode(page, outsideLoops.id);
  await expect(panels(page)).toHaveCount(1);
  await page.getByLabel("Show only feedback loops").check();
  await expect(page.getByText(new RegExp(`^${inLoops.length} nodes, \\d+ edges$`))).toBeVisible();
  await expect(panels(page)).toHaveCount(0);
  await expect
    .poll(() => withCy<number>(page, 'return cy.nodes(":visible").length;'))
    .toBe(inLoops.length);

  await search(page).fill(first.id);
  await expect(page.getByRole("status").filter({ hasText: "match" })).toBeVisible();

  await page.getByLabel("Show only feedback loops").uncheck();
  await expect(page.getByText(`${nodes.length} nodes, ${edges.length} edges`)).toBeVisible();
  await expect
    .poll(() => withCy<number>(page, 'return cy.nodes(":visible").length;'))
    .toBe(nodes.length);
});

test("a node lists its short feedback loops, and choosing one highlights it", async ({ page }) => {
  await ready(page);
  await clickNode(page, first.id);
  await expect(page.getByText(/^Short feedback loops \(\d+\+?\)$/)).toBeVisible();

  const panel = page.getByLabel(`Node ${first.id}`);
  const loop = panel.getByRole("button", { pressed: false }).filter({ hasText: "→" }).first();
  await loop.click();
  const counts = () =>
    withCy<{ nodes: number; links: number; causes: number }>(
      page,
      `return { nodes: cy.nodes(".loop-node").length, links: cy.edges(".loop-link").length,
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

test("hovering shows a preview", async ({ page }) => {
  await ready(page);
  const { x, y } = await pointOf(page, first.id);
  await page.mouse.move(x, y);
  await expect(page.getByText(`Click to see all ${first.evidence.length}`)).toBeVisible();
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
