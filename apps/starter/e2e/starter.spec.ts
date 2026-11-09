import { expect, test, type Page } from "@playwright/test";

const graph = (page: Page) =>
  page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    if (!div) return null;
    const cy = div._cyreg.cy;
    return {
      nodes: cy.nodes().length,
      animating: cy.elements().filter((ele: any) => ele.animated()).length,
      routeNodes: cy.nodes(".route-node").length,
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
  await expect.poll(async () => (await graph(page))?.routeNodes).toBe(3);
  await search.fill("queue");
  await page.locator(".cc-search").getByRole("button", { name: "Queue length" }).click();
  await expect.poll(async () => (await graph(page))?.routeNodes).toBe(0);
  await expect.poll(async () => (await classes()).focus).toEqual(["queue", "satisfaction"]);

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
        linkText: cy.edges()[0].style("color"),
        marked: cy.scratch("marked") ?? false,
        pageColor: getComputedStyle(document.querySelector("aside")!).backgroundColor,
      };
    });
  await page.evaluate(() => {
    [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy)._cyreg.cy.scratch("marked", true);
  });

  const light = await read();
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect.poll(async () => (await read()).linkText).not.toBe(light.linkText);
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
  await expect(details).toBeVisible();

  await page.getByRole("button", { name: "Close customers" }).click();
  await expect(page.getByLabel("Node customers")).toHaveCount(0);
  await expect(details).toBeVisible();
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
  await expect.poll(async () => (await graph(page))?.routeNodes).toBe(5);
  expect(errors).toEqual([]);
});

const nodesWith = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return div._cyreg.cy.elements(selector).nodes().map((node: any) => node.id()).sort();
  }, selector);

const choose = async (page: Page, query: string, name: RegExp) => {
  await page.getByLabel("Search nodes").fill(query);
  await page.locator(".cc-search").getByRole("button", { name }).click();
};

const openFinal = async (page: Page) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await page.getByRole("button", { name: "final", exact: true }).click();
  await expect.poll(async () => (await graph(page))?.nodes).toBe(5);
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);
};

test("two selected nodes list the paths between them, and a path can be highlighted", async ({ page }) => {
  await openFinal(page);
  await choose(page, "customers", /^Customers/);
  await choose(page, "queue", /^Queue length/);

  const paths = page.getByLabel("Paths");
  await expect(paths.getByText("Paths from Customers to Queue length (2)")).toBeVisible();
  await expect(paths.getByText("Paths from Queue length to Customers (1)")).toBeVisible();

  const longest = paths.getByRole("button", { name: /Revenue/ });
  await longest.click();
  await expect(longest).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => nodesWith(page, ".route-node"))
    .toEqual(["customers", "queue", "revenue", "staff"]);

  await longest.click();
  await expect(longest).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual([]);
});

test("the highlight reaches further upstream and downstream on request", async ({ page }) => {
  await openFinal(page);
  await choose(page, "revenue", /^Revenue/);
  await expect.poll(() => nodesWith(page, ".cause")).toEqual(["customers"]);
  await expect.poll(() => nodesWith(page, ".effect")).toEqual(["staff"]);

  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect.poll(() => nodesWith(page, ".cause")).toEqual(["customer-satisfaction", "customers"]);
  await expect.poll(() => nodesWith(page, ".effect")).toEqual(["queue", "staff"]);
});

test("changes between versions are listed and marked on the graph", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  const changes = page.getByLabel("Changes");
  await expect(changes.getByText("Added (2)")).toBeVisible();
  await expect(changes.getByText("Renamed (1)")).toBeVisible();

  await changes.getByRole("button", { name: "Show on graph" }).click();
  await page.getByRole("button", { name: "final", exact: true }).click();
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);
  await expect.poll(() => nodesWith(page, ".diff-added")).toEqual(["revenue", "staff"]);

  await changes.getByRole("button", { name: "Show on graph" }).click();
  await expect.poll(() => nodesWith(page, ".diff-added")).toEqual([]);
});

test("the graph can be used from the keyboard", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);
  const surface = page.getByLabel(/^Causal graph/);
  await surface.focus();

  await page.keyboard.press("ArrowDown");
  const [start] = await nodesWith(page, ".keyboard-cursor");
  expect(start).toBeTruthy();

  await page.keyboard.press("ArrowRight");
  const [next] = await nodesWith(page, ".keyboard-cursor");
  expect(next).not.toBe(start);
  const label = await page.evaluate((id) => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return div._cyreg.cy.getElementById(id).data("label");
  }, next);
  await expect(page.locator("p.cc-sr-only")).toHaveText(label);

  await page.keyboard.press("Enter");
  await expect.poll(() => nodesWith(page, ".focus")).toEqual([next]);

  await page.keyboard.press("Escape");
  await expect.poll(() => nodesWith(page, ".focus")).toEqual([]);
  await expect.poll(() => nodesWith(page, ".keyboard-cursor")).toEqual([]);
});

test("a link reopens the same version and selection", async ({ page }) => {
  await openFinal(page);
  await choose(page, "revenue", /^Revenue/);
  await expect(page).toHaveURL(/version=final/);
  await expect(page).toHaveURL(/selected=revenue/);

  await page.reload();
  await expect.poll(async () => (await graph(page))?.nodes).toBe(5);
  await expect(page.getByLabel("Node revenue")).toBeVisible();
  await expect.poll(() => nodesWith(page, ".focus")).toEqual(["revenue"]);

  // A link from elsewhere can name things that don't exist
  await page.goto("/?version=nope&selected=nobody");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveCount(0);
  await expect(page.getByLabel(/^Node /)).toHaveCount(0);
});

test("the graph downloads as an image", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});

test("the sidebar says what to do next, and the selection can be cleared", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect(page.getByText("Click a node to see")).toBeVisible();

  await choose(page, "queue", /^Queue length/);
  await expect(page.getByText("Click a node to see")).toHaveCount(0);
  await expect(page.getByText("Select a second node")).toBeVisible();

  await choose(page, "customers", /^Customers/);
  await expect(page.getByText("Select a second node")).toHaveCount(0);

  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByText("Click a node to see")).toBeVisible();
  await expect.poll(() => nodesWith(page, ".focus")).toEqual([]);
});

test("hovering a loop previews it, and clicking keeps it", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  const loop = page.getByRole("button", { name: /^Balancing/ });

  await loop.hover();
  await expect.poll(async () => (await graph(page))?.routeNodes).toBe(3);
  await expect(loop).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("heading", { name: "cytocausal starter" }).hover();
  await expect.poll(async () => (await graph(page))?.routeNodes).toBe(0);

  await loop.click();
  await page.getByRole("heading", { name: "cytocausal starter" }).hover();
  await expect.poll(async () => (await graph(page))?.routeNodes).toBe(3);
});

const inPage = <T,>(page: Page, script: string) =>
  page.evaluate(`(async () => {
    const cy = [...document.querySelectorAll("div")].find((d) => d._cyreg?.cy)._cyreg.cy;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const opacity = (id) => +cy.getElementById(id).style("opacity");
    ${script}
  })()`) as Promise<T>;

test("highlights fade in and reverse from where they are", async ({ page }) => {
  await page.goto("/?version=final");
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);
  const box = (await page.locator(".cc-graph").boundingBox())!;
  const position = await inPage<{ x: number; y: number }>(
    page,
    `return cy.getElementById("revenue").renderedPosition();`,
  );

  // Staff is two steps from nothing: hovering Queue length leaves Revenue dimmed
  await page.mouse.move(box.x + position.x, box.y + position.y);
  const fading = await inPage<number[]>(
    page,
    `const samples = [];
     for (let i = 0; i < 12; i++) { samples.push(opacity("queue")); await wait(25); }
     return samples;`,
  );
  const partWay = fading.filter((value) => value > 0.2 && value < 0.95);
  expect(partWay.length, fading.join()).toBeGreaterThan(1);

  // Leaving half way turns the fade around, with no jump at the end
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await expect.poll(() => inPage<number>(page, `return opacity("queue");`)).toBe(1);
  await page.mouse.move(box.x + position.x, box.y + position.y);
  await page.waitForTimeout(60);
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  const reversing = await inPage<number[]>(
    page,
    `const samples = [];
     for (let i = 0; i < 14; i++) { await wait(25); samples.push(opacity("queue")); }
     return samples;`,
  );
  const steps = reversing.slice(1).map((value, index) => value - reversing[index]);
  expect(Math.min(...steps), reversing.join()).toBeGreaterThan(-0.02);
  expect(Math.max(...steps), reversing.join()).toBeLessThan(0.5);
  expect(reversing.at(-1)).toBe(1);
});

test("a fade cut off by a version change leaves nothing behind, and fades carry on", async ({ page }) => {
  await page.goto("/?version=final");
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);
  await choose(page, "customers", /^Customers/);
  await page.getByRole("button", { name: "V1", exact: true }).click();
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);
  await expect
    .poll(() =>
      inPage<number[]>(page, `return cy.elements().map((ele) => +ele.style("opacity"));`),
    )
    .toEqual([1, 1, 1, 1, 1, 1]);

  // Highlights keep fading after a version change
  await choose(page, "queue", /^Queue length/);
  const part = await inPage<number[]>(
    page,
    `const samples = [];
     for (let i = 0; i < 16; i++) { samples.push(opacity("satisfaction-customers")); await wait(20); }
     return samples;`,
  );
  expect(part.filter((value) => value > 0.2 && value < 0.95).length, part.join()).toBeGreaterThan(0);
});
