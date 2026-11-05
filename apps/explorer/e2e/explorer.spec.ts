import { expect, test, type Page } from "@playwright/test";

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
    .toBe(725);
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

const search = (page: Page) => page.getByLabel("Search nodes and sentences");
const panels = (page: Page) => page.locator('section[aria-label^="Node "]');

test("shows the whole network", async ({ page }) => {
  await ready(page);
  await expect(page.getByText("725 nodes, 1494 edges")).toBeVisible();
});

test("search finds words anywhere in labels", async ({ page }) => {
  await ready(page);
  await search(page).fill("sleep");
  await expect(page.getByText("2 matches")).toBeVisible();
  await search(page).fill("buy");
  await expect(page.getByText(/^3\d matches$|^2\d matches$/)).toBeVisible();
});

test("search reaches sentences and node ids", async ({ page }) => {
  await ready(page);
  await search(page).fill("dog");
  await expect(page.getByText("3 matches")).toBeVisible();
  await search(page).fill("622");
  await expect(page.getByText("1 match", { exact: true })).toBeVisible();
});

test("choosing a search result opens its sentences and zooms to it", async ({ page }) => {
  await ready(page);
  const before = await withCy<number>(page, "return cy.zoom();");
  await search(page).fill("622");
  await page.getByRole("button", { name: "a person go to a place", exact: true }).click();
  await expect(panels(page)).toHaveCount(1);
  await expect(page.getByText("Sentences (65)")).toBeVisible();
  await expect.poll(() => withCy<number>(page, "return cy.zoom();")).toBeGreaterThan(before);
});

test("sentences stay open after the mouse leaves", async ({ page }) => {
  await ready(page);
  await clickNode(page, "622");
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  await expect(page.getByText("Sentences (65)")).toBeVisible();
});

test("two nodes can be compared, and clicking the background clears them", async ({ page }) => {
  await ready(page);
  await clickNode(page, "622");
  await clickNode(page, "7");
  await expect(panels(page)).toHaveCount(2);
  await clickNode(page, "200");
  await expect(panels(page)).toHaveCount(2);
  await expect(page.getByLabel("Node 622")).toHaveCount(0);

  await withCy(page, "cy.fit(); cy.panBy({ x: 3000, y: 0 });");
  await page.mouse.click(300, 450);
  await expect(panels(page)).toHaveCount(0);
});

test("causes and effects follow edge direction", async ({ page }) => {
  await ready(page);
  await clickNode(page, "622");
  const result = await withCy<Record<string, string[]>>(
    page,
    `const node = cy.getElementById("622");
     const ids = (eles) => eles.map((e) => e.id()).sort();
     return {
       causes: ids(cy.nodes(".cause")), effects: ids(cy.nodes(".effect")),
       incomers: ids(node.incomers("node")), outgoers: ids(node.outgoers("node")),
       focus: ids(cy.nodes(".focus")),
     };`,
  );
  expect(result.focus).toEqual(["622"]);
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
  expect(sizes.highest).toBe("622");
  expect(sizes.top).toBe(24);
  expect(sizes.zero).toBe(5);
});

test("feedback loops can be isolated", async ({ page }) => {
  await ready(page);
  await clickNode(page, "703");
  await expect(panels(page)).toHaveCount(1);
  await page.getByLabel("Show only feedback loops").check();
  await expect(page.getByText(/^213 nodes, \d+ edges$/)).toBeVisible();
  await expect(panels(page)).toHaveCount(0);
  await expect.poll(() => withCy<number>(page, 'return cy.nodes(":visible").length;')).toBe(213);

  await search(page).fill("622");
  await expect(page.getByRole("status").filter({ hasText: "match" })).toBeVisible();

  await page.getByLabel("Show only feedback loops").uncheck();
  await expect(page.getByText("725 nodes, 1494 edges")).toBeVisible();
  await expect.poll(() => withCy<number>(page, 'return cy.nodes(":visible").length;')).toBe(725);
});

test("hovering shows a preview", async ({ page }) => {
  await ready(page);
  const { x, y } = await pointOf(page, "622");
  await page.mouse.move(x, y);
  await expect(page.getByText("Click to see all 65")).toBeVisible();
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

  for (const steps of [0, 1, 2, 3, 2]) {
    await withCy(page, `cy.fit(undefined, 30); cy.zoom({ level: cy.zoom() * ${1.5 ** steps}, renderedPosition: { x: 500, y: 450 } });`);
    await page.waitForTimeout(300);
    const { labels, overlapping, fontSize } = await measure();
    expect(labels, `labels at step ${steps}`).toBeGreaterThan(0);
    expect(labels).toBeLessThanOrEqual(60);
    expect(overlapping, `overlaps at step ${steps}`).toBe(0);
    expect(fontSize).toBeCloseTo(12, 0);
  }
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
