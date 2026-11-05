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
  await page.getByRole("button", { name: /^Satisfaction/ }).click();

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
  await page.getByRole("button", { name: /^balancing:/ }).click();
  await expect.poll(async () => (await graph(page))?.loopNodes).toBe(3);
  await search.fill("queue");
  await page.getByRole("button", { name: "Queue length", exact: true }).click();
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

test("the starter runs out of the box", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");

  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect(page.getByText("Feedback loops (1)")).toBeVisible();
  await expect(page.getByRole("button", { name: /^balancing:/ })).toHaveCount(1);
  await expect(page.locator("aside [role=alert]")).toHaveCount(0);

  await page.getByRole("button", { name: "final", exact: true }).click();
  await expect(page.getByText("Feedback loops (2)")).toBeVisible();
  await expect(page.getByRole("button", { name: /^reinforcing:/ })).toHaveCount(1);
  await expect.poll(async () => await graph(page)).toMatchObject({ nodes: 5, animating: 0 });

  await page.getByRole("button", { name: /^reinforcing:/ }).click();
  await expect.poll(async () => (await graph(page))?.loopNodes).toBe(5);
  expect(errors).toEqual([]);
});
