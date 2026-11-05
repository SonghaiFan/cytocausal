import { expect, test, type Page } from "@playwright/test";

const graph = (page: Page) =>
  page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    if (!div) return null;
    const cy = div._cyreg.cy;
    return {
      nodes: cy.nodes().length,
      animating: cy.elements().filter((ele: any) => ele.animated()).length,
      loopNodes: cy.nodes(".loop-node").length,
    };
  });

/** Lists each edge as source>target, as drawn on screen. */
const links = (page: Page) =>
  page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return div._cyreg.cy
      .edges()
      .map((edge: any) => `${edge.data("source")}>${edge.data("target")}`)
      .sort();
  });

test("links follow their nodes between versions, even when an edge keeps its id", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  const v1 = ["customers>queue", "queue>satisfaction", "satisfaction>customers"];
  const final = [
    "customer-satisfaction>customers",
    "customers>queue",
    "customers>revenue",
    "queue>customer-satisfaction",
    "revenue>staff",
    "staff>queue",
  ];
  const settled = async (expected: string[]) => {
    await expect.poll(async () => (await graph(page))?.animating).toBe(0);
    await expect.poll(() => links(page)).toEqual(expected);
  };

  await page.getByRole("button", { name: "final", exact: true }).click();
  await settled(final);
  await page.getByRole("button", { name: "V1", exact: true }).click();
  await settled(v1);

  for (const name of ["final", "V1", "final", "V1", "final"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(40);
  }
  await settled(final);
});

test("search finds nodes by label and evidence, and highlights the choice", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  const search = page.getByLabel("Search nodes");

  await search.fill("queue");
  await expect(page.getByRole("status").filter({ hasText: "1 match" })).toBeVisible();

  // Only the evidence says this, not the label
  await search.fill("people leave");
  await expect(page.getByText("“People leave when the line is long”")).toBeVisible();
  await page.locator(".cc-search").getByRole("button", { name: /^Satisfaction/ }).click();

  const classes = () =>
    page.evaluate(() => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      const ids = (selector: string) => div._cyreg.cy.nodes(selector).map((n: any) => n.id());
      return { focus: ids(".focus"), causes: ids(".cause"), effects: ids(".effect") };
    });
  await expect
    .poll(classes)
    .toEqual({ focus: ["satisfaction"], causes: ["queue"], effects: ["customers"] });

  // Choosing a node replaces a highlighted loop, and the other way round
  await page.getByRole("button", { name: /^Balancing/ }).click();
  await expect.poll(async () => (await graph(page))?.loopNodes).toBe(3);
  await search.fill("queue");
  await page.locator(".cc-search").getByRole("button", { name: "Queue length" }).click();
  await expect.poll(async () => (await graph(page))?.loopNodes).toBe(0);
  await expect.poll(async () => (await classes()).focus).toEqual(["queue"]);

  await search.fill("nothing like this");
  await expect(page.getByRole("status").filter({ hasText: "0 matches" })).toBeVisible();
});

test("changing theme restyles the same graph without moving it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);

  const read = () =>
    page.evaluate(() => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      const cy = div._cyreg.cy;
      return {
        positions: JSON.stringify(cy.nodes().map((node: any) => node.position())),
        nodeColor: cy.nodes()[0].style("background-color"),
        marked: cy.scratch("marked") ?? false,
        pageColor: getComputedStyle(document.querySelector("aside")!).backgroundColor,
      };
    });
  await page.evaluate(() => {
    [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy)._cyreg.cy.scratch("marked", true);
  });

  const light = await read();
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect.poll(async () => (await read()).nodeColor).not.toBe(light.nodeColor);
  const dark = await read();
  expect(dark.positions).toBe(light.positions);
  expect(dark.marked).toBe(true);
  expect(dark.pageColor).not.toBe(light.pageColor);
});

test("the system colour scheme is followed", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();
});

test("reduced motion skips animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "final", exact: true }).click();
  await page.waitForTimeout(150);
  const state = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    return { moving: cy.nodes().filter((node: any) => node.animated()).length };
  });
  expect(state.moving).toBe(0);
  await expect.poll(async () => (await graph(page))?.nodes).toBe(5);
});

test("nodes respond to hover and click, and the background clears them", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);

  const state = () =>
    page.evaluate(() => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      const ids = (selector: string) => div._cyreg.cy.nodes(selector).map((n: any) => n.id());
      return { focus: ids(".focus"), causes: ids(".cause"), effects: ids(".effect") };
    });
  const pointOf = (id: string) =>
    page.evaluate((node) => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      const { left, top } = div.getBoundingClientRect();
      const { x, y } = div._cyreg.cy.getElementById(node).renderedPosition();
      return { x: left + x, y: top + y };
    }, id);
  const none = { focus: [], causes: [], effects: [] };
  const queue = { focus: ["queue"], causes: ["customers"], effects: ["satisfaction"] };

  const { x, y } = await pointOf("queue");
  await page.mouse.move(x, y);
  await expect.poll(state).toEqual(queue);

  await page.mouse.move(5, 5);
  await expect.poll(state).toEqual(none);

  await page.mouse.click(x, y);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(200);
  expect(await state()).toEqual(queue);

  await page.mouse.click(5, 5);
  await expect.poll(state).toEqual(none);
});

test("selecting a node shows its details, and they link to its neighbours", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await page.getByLabel("Search nodes").fill("satisfaction");
  await page.locator(".cc-search").getByRole("button", { name: /^Satisfaction/ }).click();

  const details = page.getByLabel("Node satisfaction");
  await expect(details.getByText("Caused by (1)")).toBeVisible();
  await expect(details.getByText("Leads to (1)")).toBeVisible();
  await expect(details.getByText("People leave when the line is long")).toBeVisible();

  await details.getByRole("button", { name: "Customers", exact: true }).click();
  await expect(page.getByLabel("Node customers")).toBeVisible();
  await expect(details).toHaveCount(0);

  await page.getByRole("button", { name: "Close customers" }).click();
  await expect(page.getByLabel("Node customers")).toHaveCount(0);
});

const nodesInView = (page: Page) =>
  page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    const { width, height } = div.getBoundingClientRect();
    const inside = cy.nodes().filter((node: any) => {
      const { x, y } = node.renderedPosition();
      return x >= 0 && y >= 0 && x <= width && y <= height;
    });
    return { height: Math.round(height), inside: inside.length, total: cy.nodes().length };
  });

test("the graph shows on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);

  const view = await nodesInView(page);
  expect(view.height).toBeGreaterThan(300);
  expect(view.inside).toBe(view.total);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.getByLabel("Search nodes")).toBeAttached();
});

test("the graph stays in view when the window changes size", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);

  await page.setViewportSize({ width: 390, height: 800 });
  await expect.poll(async () => (await nodesInView(page)).inside).toBe(3);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await nodesInView(page)).inside).toBe(3);
});

test("the starter runs out of the box", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");

  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect(page.getByText("Feedback loops (1)")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Balancing/ })).toHaveCount(1);
  await expect(page.locator("aside [role=alert]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fit graph" })).toBeVisible();

  await page.getByRole("button", { name: "final", exact: true }).click();
  await expect(page.getByText("Feedback loops (2)")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reinforcing/ })).toHaveCount(1);
  await expect.poll(async () => await graph(page)).toMatchObject({ nodes: 5, animating: 0 });

  await page.getByRole("button", { name: /^Reinforcing/ }).click();
  await expect.poll(async () => (await graph(page))?.loopNodes).toBe(5);
  expect(errors).toEqual([]);
});
