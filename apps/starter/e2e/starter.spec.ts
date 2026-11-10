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
  await page.getByRole("button", { name: /^B Balancing/ }).click();
  await expect.poll(async () => (await graph(page))?.routeNodes).toBe(3);
  await search.fill("queue");
  await page.locator(".cc-search").getByRole("button", { name: "Queue length" }).click();
  await expect.poll(async () => (await graph(page))?.routeNodes).toBe(0);
  // A choice replaces the selection
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

  // Choosing a neighbour walks to it, as a plain click on the graph does
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
  await expect(page.getByText("Coffee shop cycles (1)")).toBeVisible();
  await expect(page.getByRole("button", { name: /^B Balancing/ })).toHaveCount(1);
  await expect(page.locator("aside [role=alert]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fit graph" })).toBeVisible();

  await page.getByRole("button", { name: "final", exact: true }).click();
  await expect(page.getByText("Coffee shop cycles (2)")).toBeVisible();
  await expect(page.getByRole("button", { name: /^R Reinforcing/ })).toHaveCount(1);
  await expect.poll(async () => await graph(page)).toMatchObject({ nodes: 5, animating: 0 });

  await page.getByRole("button", { name: /^R Reinforcing/ }).click();
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
  // Tests that inspect menu controls explicitly open the keyboard equivalent.
  await page.getByLabel(/^Causal graph/).focus();
  await page.keyboard.press("Shift+F10");
};

/** Traces the paths from the selected node to another, with the menu's ⤳ button. */
const chooseAlso = async (page: Page, query: string, name: RegExp) => {
  await page.getByRole("menuitemcheckbox", { name: "Trace paths to another node" }).click();
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
  await chooseAlso(page, "queue", /^Queue length/);

  const paths = page.getByLabel("Paths");
  await expect(paths.getByText("Paths from Customers to Queue length (2)")).toBeVisible();
  await expect(paths.getByText("Paths from Queue length to Customers (1)")).toBeVisible();

  const longest = paths.getByRole("button", { name: /Revenue/ });
  await longest.click();
  await expect(longest).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => nodesWith(page, ".route-node"))
    .toEqual(["customers", "queue", "revenue", "staff"]);

  // Letting go of one path goes back to every path between the two
  await longest.click();
  await expect(longest).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() => nodesWith(page, ".route-node"))
    .toEqual(["customer-satisfaction", "customers", "queue", "revenue", "staff"]);
  await expect.poll(() => nodesWith(page, ".focus")).toEqual(["customers", "queue"]);
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
  // The renamed node is still there, so it's marked as changed rather than added
  await expect.poll(() => nodesWith(page, ".diff-changed")).toEqual(["customer-satisfaction"]);
  await expect(changes.getByText("Changed", { exact: true })).toBeVisible();

  // The first version shows the same node, under its old name, as changed
  await page.getByRole("button", { name: "V1", exact: true }).click();
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);
  await expect.poll(() => nodesWith(page, ".diff-changed")).toEqual(["satisfaction"]);

  await changes.getByRole("button", { name: "Show on graph" }).click();
  await expect.poll(() => nodesWith(page, ".diff-added")).toEqual([]);
  await expect.poll(() => nodesWith(page, ".diff-changed")).toEqual([]);
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
  await expect(page.getByText("Choose ⤳ in the node's menu")).toBeVisible();

  await chooseAlso(page, "customers", /^Customers/);
  await expect(page.getByText("Choose ⤳ in the node's menu")).toHaveCount(0);

  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByText("Click a node to see")).toBeVisible();
  await expect.poll(() => nodesWith(page, ".focus")).toEqual([]);
});

test("hovering a loop previews it, and clicking keeps it", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  const loop = page.getByRole("button", { name: /^B Balancing/ });

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

/** What the graph shows of each link: whether it's hidden, highlighted, and how wide. */
const linkState = (page: Page) =>
  page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return Object.fromEntries(
      div._cyreg.cy.edges().map((edge: any) => [
        edge.id(),
        {
          hidden: edge.hasClass("contributor-hidden"),
          route: edge.hasClass("route-link"),
          width: parseFloat(edge.style("width")),
        },
      ]),
    ) as Record<string, { hidden: boolean; route: boolean; width: number }>;
  });

const positionsOf = (page: Page) =>
  page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return Object.fromEntries(div._cyreg.cy.nodes().map((n: any) => [n.id(), { ...n.position() }]));
  });

test("clicking a link shows who stated it, and a shared address reopens it", async ({ page }) => {
  await openFinal(page);
  const point = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const { left, top } = div.getBoundingClientRect();
    const { x, y } = div._cyreg.cy.getElementById("staff-queue").renderedMidpoint();
    return { x: left + x, y: top + y };
  });
  await page.mouse.click(point.x, point.y);

  const details = page.getByLabel("Link staff-queue");
  await expect(details.getByText("Stated by 2 people")).toBeVisible();
  await expect(details.getByText("barista")).toBeVisible();
  await expect(details.getByText("A second person on the till halves the wait")).toBeVisible();
  await expect.poll(async () => (await linkState(page))["staff-queue"].route).toBe(true);
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual(["queue", "staff"]);
  await expect(page).toHaveURL(/link=staff-queue/);

  await page.reload();
  await expect(page.getByLabel("Link staff-queue")).toBeVisible();
  await expect.poll(async () => (await linkState(page))["staff-queue"].route).toBe(true);

  // Either end leads to its node, which takes the link's place
  await page.getByLabel("Link staff-queue").getByRole("button", { name: "Staff on shift" }).click();
  await expect(page.getByLabel("Node staff")).toBeVisible();
  await expect(page.getByLabel(/^Link /)).toHaveCount(0);
  await expect(page).not.toHaveURL(/link=/);
});

test("a link can be opened from a node's details with the keyboard", async ({ page }) => {
  await openFinal(page);
  await choose(page, "customers", /^Customers/);
  const show = page.getByRole("button", { name: "Show link: Customers → Queue length, stated by 2 people" });
  await show.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Link customers-queue").getByText("The line doubles in the morning rush")).toBeVisible();
  await page.getByRole("button", { name: "Close link" }).click();
  await expect(page.getByLabel(/^Link /)).toHaveCount(0);
});

test("links are as thick as their support, and the filter shows one person's view in place", async ({ page }) => {
  await openFinal(page);
  const before = await linkState(page);
  expect(before["customers-queue"].width).toBeGreaterThan(before["queue-satisfaction"].width);
  await expect(page.getByText("Thicker links: stated by more people")).toBeVisible();
  const positions = await positionsOf(page);

  const filter = page.getByLabel("Contributors");
  await filter.getByLabel(/barista/).check();
  await expect
    .poll(async () => Object.entries(await linkState(page)).filter(([, s]) => s.hidden).map(([id]) => id).sort())
    .toEqual(["customers-revenue", "revenue-staff", "satisfaction-customers"]);
  expect(await nodesWith(page, ".contributor-hidden")).toEqual(["revenue"]);
  expect(await positionsOf(page)).toEqual(positions);

  // The filter stays when the version changes, and Everyone brings the rest back
  await page.getByRole("button", { name: "V1", exact: true }).click();
  await expect.poll(async () => (await graph(page))?.nodes).toBe(3);
  await expect.poll(async () => Object.values(await linkState(page)).every((s) => s.hidden)).toBe(true);
  await filter.getByRole("button", { name: "Everyone" }).click();
  await expect.poll(async () => Object.values(await linkState(page)).some((s) => s.hidden)).toBe(false);
});

test("layouts can be switched, and flow runs causes into effects", async ({ page }) => {
  await openFinal(page);
  const positions = () =>
    page.evaluate(() => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      return Object.fromEntries(div._cyreg.cy.nodes().map((n: any) => [n.id(), { ...n.position() }])) as Record<
        string,
        { x: number; y: number }
      >;
    });
  const force = await positions();

  await page.getByRole("button", { name: "Flow", exact: true }).click();
  await expect(page).toHaveURL(/layout=flow/);
  await expect.poll(async () => (await graph(page))?.animating).toBe(0);
  await page.waitForTimeout(900);
  const flow = await positions();
  expect(flow.customers.x).toBeLessThan(flow.revenue.x);
  expect(flow.revenue.x).toBeLessThan(flow.staff.x);

  // Back to force, every node returns to where it was
  await page.getByRole("button", { name: "Force", exact: true }).click();
  await page.waitForTimeout(1200);
  const back = await positions();
  for (const [id, { x, y }] of Object.entries(force)) {
    expect(Math.hypot(back[id].x - x, back[id].y - y), id).toBeLessThan(1);
  }
});

/** What makes the drawn graph hard to read: overlapping nodes, and links running through nodes. */
const clutter = (page: Page) =>
  page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    const boxes = cy.nodes(":visible").map((n: any) => ({ n, b: n.boundingBox({ includeLabels: false }) }));
    let overlaps = 0;
    boxes.forEach((a: any, i: number) =>
      boxes.slice(i + 1).forEach((c: any) => {
        if (a.b.x1 < c.b.x2 && c.b.x1 < a.b.x2 && a.b.y1 < c.b.y2 && c.b.y1 < a.b.y2) overlaps++;
      }),
    );
    let through = 0;
    cy.edges().forEach((e: any) => {
      const s = e.sourceEndpoint();
      const t = e.targetEndpoint();
      const c = e.controlPoints()?.[0];
      const points = Array.from({ length: 17 }, (_, i) => {
        const k = i / 16;
        const u = 1 - k;
        return c
          ? { x: u * u * s.x + 2 * u * k * c.x + k * k * t.x, y: u * u * s.y + 2 * u * k * c.y + k * k * t.y }
          : { x: s.x + (t.x - s.x) * k, y: s.y + (t.y - s.y) * k };
      });
      const hit = boxes.some(
        ({ n, b }: any) =>
          n !== e.source() && n !== e.target() && points.some((p) => p.x > b.x1 && p.x < b.x2 && p.y > b.y1 && p.y < b.y2),
      );
      if (hit) through++;
    });
    return { overlaps, through };
  });

const settle = async (page: Page) => {
  let previous = "";
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => {
        const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
        const cy = div._cyreg.cy;
        if (cy.animated() || cy.nodes().some((n: any) => n.animated())) return "moving";
        return JSON.stringify(cy.nodes().map((n: any) => [Math.round(n.position().x), Math.round(n.position().y)]));
      });
      const done = now !== "moving" && now === previous;
      previous = now;
      return done;
    })
    .toBe(true);
};

test("no layout packs nodes into each other, however they're switched", async ({ page }) => {
  await openFinal(page);
  // Each order matters: a layout used to be squeezed into the space the last one filled
  for (const name of ["Flow", "Hubs", "Flow", "Force", "Hubs", "Force"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await settle(page);
    const { overlaps, through } = await clutter(page);
    expect(overlaps, `${name}: overlapping nodes`).toBe(0);
    // Rings can't keep every link clear of the nodes between them. Force starts from random
    // positions, so now and then one link ends up across a node; picking the best of several
    // runs by layoutQuality would rule that out
    if (name === "Flow") expect(through, `${name}: links through nodes`).toBe(0);
    if (name === "Force") expect(through, `${name}: links through nodes`).toBeLessThanOrEqual(1);
  }
});


test("the radial menu walks to linked nodes, sets the steps and picks loops", async ({ page }) => {
  await openFinal(page);
  await choose(page, "customers", /^Customers/);
  const menu = page.getByRole("menu", { name: "Linked nodes and loops: Customers" });
  await expect(menu).toBeVisible();
  // No visible target for each link: the space around the node is split by direction instead
  await expect(menu.getByRole("menuitem")).toHaveCount(0);

  // Pointing toward a linked node previews that link, and clicking walks there
  const toward = await aimToward(page, "customers", "queue");
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual(["customers", "queue"]);
  await page.mouse.click(toward.x, toward.y);
  await expect(page.getByLabel("Node queue")).toBeVisible();
  await expect(page.getByLabel("Node customers")).toHaveCount(0);
  const next = page.getByRole("menu", { name: "Linked nodes and loops: Queue length" });
  await expect(next).toBeVisible();

  // The rings set how far the highlight reaches
  const highlighted = () =>
    page.evaluate(() => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      return div._cyreg.cy.nodes(":visible").not(".dimmed").length;
    });
  const one = await highlighted();
  // A ring's middle is the node, so click on the ring itself rather than its centre
  // Steps stop at 2 by default: one ring, and buttons for 1 and 2
  await expect(next.getByRole("menuitemradio")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "3", exact: true })).toHaveCount(0);
  await next.getByRole("menuitemradio", { name: /^2 steps/ }).dispatchEvent("click");
  await expect(page.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(highlighted).toBeGreaterThan(one);

  // A loop arc highlights the loop, and the loop list shows it chosen
  await next.getByRole("menuitemcheckbox", { name: /^Balancing/ }).dispatchEvent("click");
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual(["customer-satisfaction", "customers", "queue"]);
  await expect(page.getByRole("button", { name: /^B Balancing/ })).toHaveAttribute("aria-pressed", "true");
});

test("the radial menu works from the keyboard", async ({ page }) => {
  await openFinal(page);
  await choose(page, "revenue", /^Revenue/);
  const menu = page.getByRole("menu", { name: "Linked nodes and loops: Revenue" });
  const two = menu.getByRole("menuitemradio", { name: /^2 steps/ });
  await two.focus();
  await expect(page.locator(".cc-radial-caption")).toHaveText(/^2 steps/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-pressed", "true");

  await two.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByLabel(/^Node /)).toHaveCount(0);
});

test("the space around a node is split by direction, so pointing anywhere picks the nearest linked node", async ({ page }) => {
  await openFinal(page);
  await choose(page, "customers", /^Customers/);
  await expect(page.getByRole("menu", { name: /Customers$/ })).toBeVisible();
  await stillOnScreen(page, "customers");

  const { samples, bearings } = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    const box = div.getBoundingClientRect();
    const at = (id: string) => {
      const { x, y } = cy.getElementById(id).renderedPosition();
      return { x: box.left + x, y: box.top + y };
    };
    const centre = at("customers");
    const bearings: Record<string, number> = {};
    for (const node of cy.getElementById("customers").neighborhood("node").toArray()) {
      const point = at(node.id());
      bearings[node.data("label")] = Math.atan2(point.y - centre.y, point.x - centre.x);
    }
    // Just outside the menu, on the graph, all the way round
    const radius = document.querySelector(".cc-radial")!.getBoundingClientRect().width / 2 + 12;
    const samples = Array.from({ length: 36 }, (_, index) => {
      const angle = (index * 10 * Math.PI) / 180 - Math.PI;
      return { angle, x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
    });
    return { samples, bearings };
  });

  let named = 0;
  for (const { angle, x, y } of samples) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(40);
    const caption = (await captionText(page)) ?? "";
    const label = /^(Leads to|Caused by|Causes and follows from): (.+)$/.exec(caption)?.[2];
    // Over a link, or outside every direction, nothing is named
    if (!label) continue;
    named++;
    const distances = Object.entries(bearings)
      .map(([name, bearing]) => {
        const turn = Math.abs(angle - bearing) % (2 * Math.PI);
        return [name, Math.min(turn, 2 * Math.PI - turn)] as const;
      })
      .sort((a, b) => a[1] - b[1]);
    const margin = (distances[1]?.[1] ?? Math.PI) - distances[0][1];
    // The nearest node owns the point, except right on a border between two
    expect(label === distances[0][0] || margin < 0.1, `${label} at ${Math.round((angle * 180) / Math.PI)}°`).toBe(true);
  }
  expect(named).toBeGreaterThan(9);
});

test("the empty graph toward a linked node leads there, out to just past it", async ({ page }) => {
  await openFinal(page);
  await choose(page, "customers", /^Customers/);
  const menu = page.getByRole("menu", { name: /Customers$/ });
  await expect(menu).toBeVisible();
  await page.waitForTimeout(500);

  // Points just outside the menu, either side of each linked node's bearing, plus one far corner
  const { candidates, far } = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    const box = div.getBoundingClientRect();
    const at = (id: string) => {
      const { x, y } = cy.getElementById(id).renderedPosition();
      return { x: box.left + x, y: box.top + y };
    };
    const centre = at("customers");
    const circle = document.querySelector(".cc-radial")!.getBoundingClientRect();
    const radius = circle.width / 2;
    const neighbours: { label: string; bearing: number; distance: number }[] = cy
      .getElementById("customers")
      .neighborhood("node")
      .toArray()
      .map((node: any) => {
      const point = at(node.id());
      return {
        label: node.data("label") as string,
        bearing: Math.atan2(point.y - centre.y, point.x - centre.x),
        distance: Math.hypot(point.x - centre.x, point.y - centre.y),
      };
    });
    const candidates = neighbours.flatMap(({ label, bearing, distance }) =>
      [-12, 12, -6, 6].flatMap((offset) =>
        [radius + 16, (radius + distance) / 2].map((reach) => {
          const angle = bearing + (offset * Math.PI) / 180;
          return { label, x: centre.x + reach * Math.cos(angle), y: centre.y + reach * Math.sin(angle) };
        }),
      ),
    );
    const corners = [
      [box.left + 40, box.top + box.height / 2],
      [box.right - 40, box.top + box.height / 2],
      [box.left + box.width / 2, box.top + 80],
      [box.right - 40, box.top + 80],
      [box.left + 40, box.top + 80],
    ];
    const longest = Math.max(...neighbours.map(({ distance }) => distance)) + 60;
    const [x, y] = corners.find(([x, y]) => Math.hypot(x - centre.x, y - centre.y) > longest)!;
    return { candidates, far: { x, y } };
  });

  // Somewhere off any node or link, pointing that way previews the link
  let walked: string | null = null;
  for (const { label, x, y } of candidates) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(80);
    const caption = await captionText(page);
    if (!caption?.endsWith(`: ${label}`)) continue;
    await expect.poll(() => nodesWith(page, ".route-node")).toContain(label === "Revenue" ? "revenue" : label === "Queue length" ? "queue" : "customer-satisfaction");
    await page.mouse.click(x, y);
    walked = label;
    break;
  }
  expect(walked).not.toBeNull();
  await expect(page.getByRole("menu", { name: new RegExp(`${walked}$`) })).toBeVisible();

  // Past every direction's reach, the background clears as before
  await page.mouse.click(far.x, far.y);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect.poll(() => nodesWith(page, ".focus")).toEqual([]);
});

test("the linked node, and the link to it, lead there too", async ({ page }) => {
  await openFinal(page);
  await choose(page, "customers", /^Customers/);
  await expect(page.getByRole("menu", { name: /Customers$/ })).toBeVisible();
  const at = await stillOnScreen(page, "customers");
  const caption = page.locator(".cc-radial-caption");

  // Pointing at the linked node itself names it, as pointing that way does
  const revenue = await pagePoint(page, "revenue");
  await page.mouse.move(revenue.x, revenue.y);
  await expect(caption).toHaveText("Leads to: Revenue");
  await page.mouse.move(5, 5);
  await expect(caption).toHaveCount(0);

  // So does a point on the link to it, outside the menu, without a tooltip of its own
  const onLink = await page.evaluate(
    ({ at }) => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      const cy = div._cyreg.cy;
      const box = div.getBoundingClientRect();
      const radius = document.querySelector(".cc-radial")!.getBoundingClientRect().width / 2;
      const link = cy.getElementById("customers").edgesWith(cy.getElementById("revenue"))[0];
      const from = link.midpoint();
      const to = link.targetEndpoint();
      const pan = cy.pan();
      const zoom = cy.zoom();
      // Walk along from the middle toward the end until the renderer finds the link under the
      // point. It works in graph coordinates; the page in rendered ones
      for (let step = 0; step <= 20; step++) {
        const x = from.x + ((to.x - from.x) * step) / 20;
        const y = from.y + ((to.y - from.y) * step) / 20;
        const [pageX, pageY] = [box.left + pan.x + x * zoom, box.top + pan.y + y * zoom];
        if (Math.hypot(pageX - at.x, pageY - at.y) <= radius + 4) continue;
        const hit = cy.renderer().findNearestElement(x, y, true, false);
        if (hit && hit.id() === link.id()) return { x: pageX, y: pageY, id: link.id() };
      }
      return null;
    },
    { at },
  );
  expect(onLink).not.toBeNull();
  await page.mouse.move(onLink!.x, onLink!.y);
  await expect(caption).toHaveText("Leads to: Revenue");
  await page.waitForTimeout(600);
  await expect(tooltip(page)).toHaveCount(0);

  // Clicking the link walks there, rather than choosing the link
  await page.mouse.click(onLink!.x, onLink!.y);
  await expect(page.getByRole("menu", { name: /Revenue$/ })).toBeVisible();
  await expect(page.getByLabel("Node revenue")).toBeVisible();
});

test("while the menu is open, faded nodes are backdrop, as behind a modal", async ({ page }) => {
  await openFinal(page);
  await choose(page, "staff", /^Staff on shift/);
  const menu = page.getByRole("menu", { name: /Staff on shift$/ });
  await expect(menu).toBeVisible();
  await stillOnScreen(page, "staff");

  // Customer satisfaction isn't linked to staff, so it's faded behind the menu
  expect(await nodesWith(page, ".dimmed")).toContain("customer-satisfaction");
  const faded = await pagePoint(page, "customer-satisfaction");
  const leadsTo = await page.evaluate(({ x, y }) => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    const area = cy.scratch("cytocausal-radial-area");
    const centre = cy.getElementById(area.node).renderedPosition();
    const box = div.getBoundingClientRect();
    const [dx, dy] = [x - box.left - centre.x, y - box.top - centre.y];
    const angle = Math.atan2(dy, dx);
    const distance = Math.hypot(dx, dy);
    const sector = area.sectors.find((s: any) => {
      const along = (((angle - s.from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return along <= s.to - s.from && distance <= s.reach;
    });
    return sector?.node ?? null;
  }, faded);

  // Hover does not expose this faded node's tooltip or remember it as a hover target.
  await page.mouse.move(faded.x, faded.y);
  await page.waitForTimeout(600);
  await expect(tooltip(page)).toHaveCount(0);
  // Clicking it doesn't choose it: it walks the way it lies, or closes the menu
  await page.mouse.click(faded.x, faded.y);
  if (leadsTo) {
    await expect(page.getByLabel(`Node ${leadsTo}`)).toBeVisible();
  } else {
    await expect(page.getByRole("menu")).toHaveCount(0);
    // A backdrop hover must not become a node highlight when the menu closes.
    await expect.poll(() => nodesWith(page, ".focus")).toEqual([]);
  }
  await expect(page.getByLabel("Node customer-satisfaction")).toHaveCount(0);

  // With the menu closed, the same node can be chosen
  const clear = page.getByRole("button", { name: "Clear selection" });
  if (await clear.count()) await clear.click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  const again = await pagePoint(page, "customer-satisfaction");
  await page.mouse.click(again.x, again.y);
  await expect(page.getByLabel("Node customer-satisfaction")).toBeVisible();
});

test("the radial menu shows loops within reach", async ({ page }) => {
  await openFinal(page);
  await choose(page, "staff", /^Staff on shift/);
  const menu = page.getByRole("menu", { name: "Linked nodes and loops: Staff on shift" });
  await expect(menu).toBeVisible();

  // At one step only the loop through the node shows; at two, the balancing loop it feeds too
  await expect(menu.locator(".cc-radial-loop")).toHaveCount(1);
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(menu.getByRole("menuitemcheckbox", { name: /^Within 2 steps · Balancing/ })).toHaveCount(1);
});

/** Waits for a node to stop moving on screen, as the view settles after choosing it. */
const stillOnScreen = async (page: Page, id: string) => {
  // A cubic camera animation can barely move in its first frame; a small delta
  // alone does not mean it has settled.
  await expect.poll(() => page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return div._cyreg.cy.animated();
  })).toBe(false);
  let last = await pagePoint(page, id);
  for (let tries = 0; tries < 30; tries++) {
    await page.waitForTimeout(100);
    const now = await pagePoint(page, id);
    if (Math.hypot(now.x - last.x, now.y - last.y) < 0.5) return now;
    last = now;
  }
  return last;
};

/**
 * Points toward a linked node, on empty graph between the two, until the menu names it. Returns
 * where the pointer is. Points over a link are passed by, as those keep their own hover.
 */
const aimToward = async (page: Page, from: string, to: string) => {
  await stillOnScreen(page, from);
  const { label, candidates } = await page.evaluate(
    ([from, to]) => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      const cy = div._cyreg.cy;
      const box = div.getBoundingClientRect();
      const a = cy.getElementById(from).renderedPosition();
      const b = cy.getElementById(to).renderedPosition();
      const bearing = Math.atan2(b.y - a.y, b.x - a.x);
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const radius = document.querySelector(".cc-radial")!.getBoundingClientRect().width / 2;
      const candidates = [radius + 16, (radius + distance) / 2, distance * 0.6].flatMap((reach) =>
        [10, -10, 18, -18, 5, -5].map((offset) => {
          const angle = bearing + (offset * Math.PI) / 180;
          return { x: box.left + a.x + reach * Math.cos(angle), y: box.top + a.y + reach * Math.sin(angle) };
        }),
      );
      return { label: cy.getElementById(to).data("label") as string, candidates };
    },
    [from, to],
  );
  for (const point of candidates) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(60);
    const caption = await captionText(page);
    if (caption?.endsWith(`: ${label}`)) return point;
  }
  throw new Error(`Nowhere toward ${to} named it`);
};

/** The radial menu's caption as it is now, or null when it shows none. Doesn't wait for one. */
const captionText = (page: Page) =>
  page.evaluate(() => document.querySelector(".cc-radial-caption")?.textContent ?? null);

/** The tooltip that follows the pointer, not the radial menu's caption or card. */
const tooltip = (page: Page) => page.locator(".cc-floating");

/** Where a node is on the page. */
const pagePoint = (page: Page, id: string) =>
  page.evaluate((node) => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const { left, top } = div.getBoundingClientRect();
    const { x, y } = div._cyreg.cy.getElementById(node).renderedPosition();
    return { x: left + x, y: top + y };
  }, id);

test("hovering a node only highlights, and a link's tooltip waits for the pointer to rest", async ({ page }) => {
  await openFinal(page);
  const { x, y } = await pagePoint(page, "revenue");
  await page.mouse.move(x, y);
  await page.waitForTimeout(600);
  await expect(tooltip(page)).toHaveCount(0);
  await expect.poll(() => nodesWith(page, ".focus")).toEqual(["revenue"]);

  const middle = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const { left, top } = div.getBoundingClientRect();
    const { x, y } = div._cyreg.cy.edges()[0].renderedMidpoint();
    return { x: left + x, y: top + y };
  });
  await page.mouse.move(5, 5);
  await page.mouse.move(middle.x, middle.y);
  await page.waitForTimeout(100);
  await expect(tooltip(page)).toHaveCount(0);
  await expect(tooltip(page)).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(tooltip(page)).toHaveCount(0);
});

test("selecting a node opens its menu, and its details are only in the sidebar", async ({ page }) => {
  await openFinal(page);
  const menu = page.locator(".cc-radial");

  // The sidebar has the node's evidence, so the menu doesn't repeat it in a card
  await choose(page, "satisfaction", /^Customer satisfaction/);
  await expect(menu).toBeVisible();
  await expect(page.getByText("Renamed from Satisfaction after review")).toHaveCount(1);
  await expect(page.locator(".cc-radial-card")).toHaveCount(0);

  // Toward a linked node, the caption names it; no other tooltip appears
  await aimToward(page, "customer-satisfaction", "customers");
  await page.waitForTimeout(600);
  await expect(page.locator(".cc-radial-caption")).toHaveText("Leads to: Customers");
  await expect(tooltip(page)).toHaveCount(0);

  // A long loop's caption wraps inside its box rather than running past it
  const caption = page.locator(".cc-radial-caption");
  const loops = page.locator(".cc-radial-loop");
  expect(await loops.count()).toBeGreaterThan(0);
  for (let index = 0; index < (await loops.count()); index++) {
    await loops.nth(index).focus();
    await expect(caption).toContainText("→");
    const fits = await caption.evaluate((element) => element.scrollWidth <= element.clientWidth);
    expect(fits).toBe(true);
  }

  await loops.first().press("Escape");
  await expect(menu).toHaveCount(0);
});

test("a plain click replaces selection and tracing explicitly chooses an endpoint", async ({ page }) => {
  await openFinal(page);
  const point = (id: string) =>
    page.evaluate((node) => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      const { left, top } = div.getBoundingClientRect();
      const { x, y } = div._cyreg.cy.getElementById(node).renderedPosition();
      return { x: left + x, y: top + y };
    }, id);
  const click = async (id: string, modifiers: ("Shift")[] = []) => {
    const { x, y } = await point(id);
    for (const key of modifiers) await page.keyboard.down(key);
    await page.mouse.click(x, y);
    for (const key of modifiers) await page.keyboard.up(key);
  };

  await click("revenue");
  await expect.poll(() => nodesWith(page, ".focus")).toEqual(["revenue"]);
  // Another plain click moves the selection, and the menu goes with it
  await click("staff");
  await expect.poll(() => nodesWith(page, ".focus")).toEqual(["staff"]);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByLabel(/^Causal graph/).focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu", { name: /Staff on shift$/ })).toBeVisible();

  // Customers is faded behind Staff's menu. Close it before choosing an unrelated node.
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await stillOnScreen(page, "customers");
  // A plain click selects; the keyboard menu command opens the menu explicitly.
  await click("customers");
  await expect.poll(() => nodesWith(page, ".focus")).toEqual(["customers"]);

  // The menu's trace button adds a second node, and the paths between them are listed
  await expect.poll(() => nodesWith(page, ".focus")).toEqual(["customers"]);
  await page.getByLabel(/^Causal graph/).focus();
  await page.keyboard.press("Shift+F10");
  const trace = page.getByRole("menuitemcheckbox", { name: "Trace paths to another node" });
  await trace.click();
  await expect(trace).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".cc-radial-caption")).toHaveText("Choose a node to trace paths to. Escape cancels");
  await click("queue");
  await expect.poll(() => nodesWith(page, ".focus")).toEqual(["customers", "queue"]);
  await expect(page.getByText("Paths from Customers to Queue length (2)")).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);

  // Escape while tracing cancels only the tracing
  await click("revenue");
  await page.getByLabel(/^Causal graph/).focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitemcheckbox", { name: "Trace paths to another node" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Trace paths to another node" }).press("Escape");
  await expect(page.getByRole("menuitemcheckbox", { name: "Trace paths to another node" })).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => nodesWith(page, ".focus")).toEqual(["revenue"]);
});

test("two selected nodes show the paths between them, not their own neighbours", async ({ page }) => {
  await openFinal(page);
  await choose(page, "revenue", /^Revenue/);
  await chooseAlso(page, "staff", /^Staff on shift/);
  // Revenue leads to staff directly, and staff back to revenue round the loop through every node
  await expect
    .poll(() => nodesWith(page, ".route-node"))
    .toEqual(["customer-satisfaction", "customers", "queue", "revenue", "staff"]);
  await expect.poll(() => nodesWith(page, ".cause, .effect")).toEqual([]);
});


test("rapid camera choices replace the old destination and settle on the latest node", async ({ page }) => {
  await openFinal(page);
  await choose(page, "revenue", /^Revenue/);
  await choose(page, "staff", /^Staff on shift/);
  await choose(page, "customers", /^Customers/);
  // One focus duration is 600ms. Queued destinations would keep the camera moving
  // beyond this budget after the last choice.
  await expect.poll(() => page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    const point = cy.getElementById("customers").renderedPosition();
    return !cy.animated() && Math.hypot(point.x - cy.width() / 2, point.y - cy.height() / 2) < 1;
  }), { timeout: 1000, intervals: [50] }).toBe(true);
  await expect(page.getByRole("menu", { name: /Customers$/ })).toBeVisible();
});


test("tracing cancels back to its origin from backdrop, source, or Escape", async ({ page }) => {
  await openFinal(page);
  await choose(page, "customers", /^Customers/);
  const trace = page.getByRole("menuitemcheckbox", { name: "Trace paths to another node" });
  for (const cancel of ["backdrop", "source", "escape"]) {
    await trace.click();
    await expect(trace).toHaveAttribute("aria-checked", "true");
    if (cancel === "escape") await page.getByLabel("Search nodes").press("Escape");
    else if (cancel === "source") {
      const p = await stillOnScreen(page, "customers");
      await page.mouse.click(p.x, p.y);
    } else {
      await page.evaluate(() => {
        const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
        div._cyreg.cy.emit("tap");
      });
    }
    await expect(trace).toHaveAttribute("aria-checked", "false");
    await expect.poll(() => nodesWith(page, ":selected")).toEqual(["customers"]);
    await expect(page.getByRole("menu", { name: /Customers$/ })).toBeVisible();
    await expect(page.getByLabel("Node customers")).toBeVisible();
  }
  // Once back at the menu, Escape closes the whole node selection.
  await page.getByLabel("Search nodes").press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByLabel("Node customers")).toHaveCount(0);
  await expect.poll(() => nodesWith(page, ".route-node, .focus")).toEqual([]);
});

test("Escape removes a pinned loop first, then closes the node menu without leftover previews", async ({ page }) => {
  await openFinal(page);
  await choose(page, "staff", /^Staff on shift/);
  const loop = page.getByRole("menu").locator(".cc-radial-loop").first();
  await loop.focus();
  await loop.press("Enter");
  await expect(loop).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Search nodes").press("Escape");
  await expect(loop).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("menu", { name: /Staff on shift$/ })).toBeVisible();
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual([]);
  await page.getByLabel("Search nodes").press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect.poll(() => nodesWith(page, ".route-node, .focus")).toEqual([]);
});

test("the modal keyboard cursor cannot select unrelated background nodes", async ({ page }) => {
  await openFinal(page);
  await choose(page, "staff", /^Staff on shift/);
  const draggingBlocked = () => page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return { drag: div._cyreg.cy.autoungrabify(), box: div._cyreg.cy.boxSelectionEnabled() };
  });
  await expect.poll(draggingBlocked).toEqual({ drag: true, box: false });
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByLabel(/^Causal graph/).focus();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("ArrowDown");
    const [id] = await nodesWith(page, ".keyboard-cursor");
    expect(["staff", "revenue", "queue"]).toContain(id);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect.poll(draggingBlocked).toEqual({ drag: false, box: true });
});

test("pill sizing and snapshot fades emit no deprecated size or creation bypass warnings", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (/style value of `label` is deprecated|style.*bypass at element creation/.test(message.text())) warnings.push(message.text());
  });
  await openFinal(page);
  for (const version of ["V1", "final"]) {
    await page.getByRole("button", { name: version, exact: true }).click();
    await expect.poll(async () => (await graph(page))?.animating).toBe(0);
  }
  const sizes = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return div._cyreg.cy.nodes().map((node: any) => {
      const body = node.boundingBox({ includeLabels: false });
      const labelled = node.boundingBox({ includeLabels: true });
      return { width: node.width(), height: node.height(), overflow: Math.max(labelled.w - body.w, labelled.h - body.h) };
    });
  });
  for (const size of sizes) {
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    expect(size.overflow).toBeLessThanOrEqual(2);
  }
  expect(warnings).toEqual([]);
});


test("Shift-click toggles multi-selection and the keyboard command opens the modal", async ({ page }) => {
  await openFinal(page);
  const click = async (id: string, shift = true) => {
    const p = await pagePoint(page, id);
    if (shift) await page.keyboard.down("Shift");
    await page.mouse.click(p.x, p.y);
    if (shift) await page.keyboard.up("Shift");
    await page.mouse.move(5, 5);
  };
  await click("customers");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByLabel("Node customers")).toBeVisible();
  await click("queue");
  await expect(page.getByLabel("Node queue")).toBeVisible();
  await expect(page.getByText("Paths from Customers to Queue length (2)")).toBeVisible();
  await expect.poll(() => nodesWith(page, ":selected")).toEqual(["customers", "queue"]);
  await click("queue");
  await expect(page.getByLabel("Node queue")).toHaveCount(0);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await click("customers", false);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByLabel(/^Causal graph/).focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu", { name: /Customers$/ })).toBeVisible();
  // Shift cannot turn a modal navigation click into an additive selection.
  await stillOnScreen(page, "customers");
  await click("revenue");
  await expect(page.getByRole("menu", { name: /Revenue$/ })).toBeVisible();
  await expect(page.getByLabel("Node customers")).toHaveCount(0);
  await expect(page.getByLabel("Node revenue")).toBeVisible();
});

test("Shift box selection updates native selection, details and paths", async ({ page }) => {
  await openFinal(page);
  // Use fixed separated positions to make the gesture deterministic.
  const box = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    cy.stop(true, false);
    cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
    cy.nodes().positions((node: any, i: number) => ({ x: 600 + i * 60, y: 600 }));
    cy.getElementById("customers").position({ x: 200, y: 250 });
    cy.getElementById("queue").position({ x: 350, y: 250 });
    const r = div.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 140, box.y + 190);
  await page.mouse.down();
  await page.mouse.move(box.x + 410, box.y + 310, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect.poll(() => nodesWith(page, ":selected")).toEqual(["customers", "queue"]);
  await expect(page.getByLabel("Node customers")).toBeVisible();
  await expect(page.getByLabel("Node queue")).toBeVisible();
  await expect(page.getByText("Paths from Customers to Queue length (2)")).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("three Shift-selected nodes retain every detail and every pair of paths", async ({ page }) => {
  await openFinal(page);
  for (const id of ["customers", "queue", "staff"]) {
    const p = await pagePoint(page, id);
    await page.keyboard.down("Shift");
    await page.mouse.click(p.x, p.y);
    await page.keyboard.up("Shift");
  }
  await page.mouse.move(5, 5);
  await expect.poll(() => nodesWith(page, ":selected")).toEqual(["customers", "queue", "staff"]);
  await expect(page.getByLabel(/^Node /)).toHaveCount(3);
  await expect(page.getByRole("region", { name: "Paths", exact: true }).getByRole("heading")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: /^Paths from Staff on shift to Queue length/ })).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
  const p = await pagePoint(page, "queue");
  await page.keyboard.down("Shift");
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up("Shift");
  await expect(page.getByLabel(/^Node /)).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Paths", exact: true }).getByRole("heading")).toHaveCount(2);
  await expect.poll(() => nodesWith(page, ":selected")).toEqual(["customers", "staff"]);
});

test("Shift box selection keeps all five nodes and all twenty directed pairs", async ({ page }) => {
  await openFinal(page);
  const origin = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find(d => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    cy.stop(true, false);
    cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
    cy.nodes().positions((_node: any, i: number) => ({ x: 200 + i * 100, y: 300 }));
    const r = div.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  await page.keyboard.down("Shift");
  await page.mouse.move(origin.x + 140, origin.y + 240);
  await page.mouse.down();
  await page.mouse.move(origin.x + 660, origin.y + 360, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(page.getByLabel(/^Node /)).toHaveCount(5);
  await expect.poll(async () => (await nodesWith(page, ":selected")).length).toBe(5);
  await expect(page.getByRole("region", { name: "Paths", exact: true }).getByRole("heading")).toHaveCount(20);
  await expect.poll(async () => (await nodesWith(page, ".focus")).length).toBe(5);
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByLabel(/^Node /)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Paths", exact: true })).toHaveCount(0);
});

test("hold a node, drag to a fan, release commits the route without leaving the menu open", async ({ page }) => {
  await openFinal(page);
  const p = await pagePoint(page, "customers");
  await page.mouse.click(p.x, p.y);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.mouse.down();
  await expect(page.getByRole("menu", { name: /Customers$/ })).toBeVisible();
  const destination = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find(d => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    const area = cy.scratch("cytocausal-radial-area");
    const sector = area.sectors.find((s: any) => s.node === "revenue");
    const angle = (sector.from + sector.to) / 2;
    const r = (area.radius + sector.reach) / 2;
    return { x: area.x + r * Math.cos(angle), y: area.y + r * Math.sin(angle) };
  });
  await page.mouse.move(destination.x, destination.y, { steps: 8 });
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual(["customers", "revenue"]);
  await page.mouse.up();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByLabel("Node revenue")).toBeVisible();
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual(["customers", "revenue"]);
  // The next canvas click clears the committed state normally.
  await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find(d => d._cyreg?.cy);
    div._cyreg.cy.panBy({ x: 3000, y: 0 });
    return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.mouse.click(300, 450);
  await expect(page.getByLabel(/^Node /)).toHaveCount(0);
  await expect.poll(() => nodesWith(page, ".route-node, .focus")).toEqual([]);
});

test("hold-release preserves the node, and Escape cancels the held preview", async ({ page }) => {
  await openFinal(page);
  const p = await pagePoint(page, "staff");
  for (const escape of [false, true]) {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await expect(page.getByRole("menu", { name: /Staff on shift$/ })).toBeVisible();
    if (escape) await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByLabel("Node staff")).toBeVisible();
    await expect.poll(() => nodesWith(page, ":selected")).toEqual(["staff"]);
  }
});

test("dragging over a loop while held pins it on release", async ({ page }) => {
  await openFinal(page);
  const p = await pagePoint(page, "staff");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  const arc = page.locator("[data-mark-route]").first();
  await expect(arc).toBeVisible();
  const spot = await arc.evaluate((element) => {
    const box = element.getBoundingClientRect();
    for (let x = Math.ceil(box.left) + 2; x < box.right - 2; x += 2) for (let y = Math.ceil(box.top) + 2; y < box.bottom - 2; y += 2) {
      if ([[0,0], [1,0], [-1,0], [0,1], [0,-1]].every(([dx,dy]) => document.elementFromPoint(x + dx, y + dy)?.closest("[data-mark-route]") === element)) return { x, y };
    }
    throw new Error("No loop hit point");
  });
  const route = JSON.parse((await arc.getAttribute("data-mark-route"))!);
  await page.mouse.move(spot.x, spot.y, { steps: 5 });
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual([...route.nodes].sort());
  await page.mouse.up();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual([...route.nodes].sort());
  await expect(page.getByLabel("Node staff")).toBeVisible();
});


test("moving before the hold threshold drags the node without opening its menu", async ({ page }) => {
  await openFinal(page);
  const before = await pagePoint(page, "staff");
  await page.mouse.move(before.x, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 80, before.y + 40, { steps: 5 });
  await page.waitForTimeout(500);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.mouse.up();
  const after = await pagePoint(page, "staff");
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(40);
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("held angle keeps its edge while distance changes steps and rings provide feedback", async ({ page }) => {
  await openFinal(page);
  const p = await pagePoint(page, "customers");
  await page.mouse.click(p.x, p.y);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.mouse.down();
  await expect(page.getByRole("menu", { name: /Customers$/ })).toBeVisible();
  const destination = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find(d => d._cyreg?.cy);
    const cy = div._cyreg.cy;
    const area = cy.scratch("cytocausal-radial-area");
    const sector = area.sectors.find((s: any) => s.node === "revenue");
    const angle = (sector.from + sector.to) / 2;
    const r = (area.radius + sector.reach) / 2;
    return { x: area.x + r * Math.cos(angle), y: area.y + r * Math.sin(angle) };
  });
  await page.mouse.move(destination.x, destination.y, { steps: 8 });
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual(["customers", "revenue"]);
  const far = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find(d => d._cyreg?.cy);
    const area = div._cyreg.cy.scratch("cytocausal-radial-area");
    const sector = area.sectors.find((s: any) => s.node === "revenue");
    const angle = (sector.from + sector.to) / 2;
    const r = sector.reach + 20;
    return { x: area.x + r * Math.cos(angle), y: area.y + r * Math.sin(angle) };
  });
  const feedback = page.locator(".cc-marking-feedback");
  await expect(feedback).toHaveAttribute("data-step", "1");
  await page.mouse.move(far.x, far.y, { steps: 5 });
  await expect(feedback).toHaveAttribute("data-step", "2");
  await expect(page.locator(".cc-marking-band")).toHaveCount(1);
  await page.mouse.move(destination.x, destination.y, { steps: 5 });
  await expect(feedback).toHaveAttribute("data-step", "1");
  await page.mouse.move(far.x, far.y, { steps: 5 });
  await expect(feedback).toHaveAttribute("data-step", "2");
  const committed = await nodesWith(page, ".route-node");
  await page.mouse.up();
  await expect(page.getByRole("group", { name: "Steps shown", exact: true }).getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByLabel("Node revenue")).toBeVisible();
  await expect.poll(() => nodesWith(page, ".route-node")).toEqual(committed);
  // The next canvas click clears the committed state normally.
  await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find(d => d._cyreg?.cy);
    div._cyreg.cy.panBy({ x: 3000, y: 0 });
    return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.mouse.click(300, 450);
  await expect(page.getByLabel(/^Node /)).toHaveCount(0);
  await expect.poll(() => nodesWith(page, ".route-node, .focus")).toEqual([]);
});
