import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Positions = Record<string, { x: number; y: number }>;

const datasets: {
  id: string;
  correspondences: { nodes: Record<string, string> }[];
}[] = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../data/datasets.json"), "utf8"));

const anchorsOf = (id: string) => datasets.find((d) => d.id === id)!.correspondences[0].nodes;

/** Reads node positions from every graph on the page. */
const readGraphs = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement & { _cyreg?: { cy: any } }>("div")]
      .filter((div) => div._cyreg?.cy)
      .map((div) => {
        const cy = div._cyreg!.cy;
        return {
          animating: cy.elements().filter((ele: any) => ele.animated()).length,
          faint: cy.elements().filter((ele: any) => Number(ele.style("opacity")) < 1).length,
          visible: getComputedStyle(div).visibility === "visible",
          positions: Object.fromEntries(
            cy.nodes().map((node: any) => [node.id(), node.position()]),
          ) as Record<string, { x: number; y: number }>,
        };
      }),
  );

/** Waits until the expected graphs are visible and have stopped moving. */
async function settled(page: Page, count: number) {
  let previous = "";
  await expect
    .poll(
      async () => {
        const graphs = await readGraphs(page);
        const ready =
          graphs.length === count && graphs.every((g) => g.visible && g.animating === 0 && !g.faint);
        const current = JSON.stringify(graphs);
        const stable = ready && current === previous;
        previous = current;
        return stable;
      },
      { timeout: 20_000, intervals: [400] },
    )
    .toBe(true);
  return (await readGraphs(page)).map(({ positions }) => positions);
}

/** The largest distance between each right node and the centre of its left nodes. */
function alignmentOffset(left: Positions, right: Positions, anchors: Record<string, string>) {
  const sources: Record<string, { x: number; y: number }[]> = {};
  for (const [from, to] of Object.entries(anchors)) (sources[to] ||= []).push(left[from]);
  return Math.max(
    ...Object.entries(sources).map(([id, points]) => {
      const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
      return Math.hypot(right[id].x - x, right[id].y - y);
    }),
  );
}

const expectSamePositions = (actual: Positions, expected: Positions) => {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  for (const [id, { x, y }] of Object.entries(expected)) {
    expect(Math.hypot(actual[id].x - x, actual[id].y - y), `node ${id}`).toBeLessThan(1);
  }
};

const version = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("every participant has 129 anchors between them, and the workshop combines them", () => {
  const participants = datasets.filter(({ id }) => id !== "workshop");
  const anchors = participants.flatMap(({ id }) => Object.keys(anchorsOf(id)));
  expect(participants).toHaveLength(8);
  expect(anchors).toHaveLength(129);
  // Two participants anchored the same term to the same place
  expect(Object.keys(anchorsOf("workshop"))).toHaveLength(127);
});

for (const { id } of datasets) {
  test(`${id}: both views agree and switching versions keeps positions`, async ({ page }) => {
    await page.goto(`/?dataset=${id}`);
    const [left, right] = await settled(page, 2);
    expect(alignmentOffset(left, right, anchorsOf(id))).toBeLessThan(1);

    await page.getByRole("button", { name: "Single", exact: true }).click();
    expectSamePositions((await settled(page, 1))[0], left);
    await page.evaluate(() => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      div._cyreg.cy.scratch("same-graph", true);
    });

    await version(page, "Final").click();
    await page.waitForTimeout(150);
    expect((await readGraphs(page))[0].animating).toBeGreaterThan(0);
    expectSamePositions((await settled(page, 1))[0], right);

    await version(page, "V1").click();
    await page.waitForTimeout(150);
    expectSamePositions((await settled(page, 1))[0], left);

    // Rapid switching must leave no leftovers and no damaged positions
    for (const name of ["Final", "V1", "Final", "V1", "Final"]) {
      await version(page, name).click();
      await page.waitForTimeout(40);
    }
    expectSamePositions((await settled(page, 1))[0], right);
    await version(page, "V1").click();
    await page.waitForTimeout(150);
    expectSamePositions((await settled(page, 1))[0], left);

    const kept = await page.evaluate(() => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      return div._cyreg.cy.scratch("same-graph");
    });
    expect(kept).toBe(true);
  });
}

test("alignment holds with the cola layout", async ({ page }) => {
  await page.goto("/?dataset=expert_9");
  await settled(page, 2);
  await page.getByText("cola", { exact: true }).click();
  await page.waitForTimeout(300);
  const [left, right] = await settled(page, 2);
  expect(alignmentOffset(left, right, anchorsOf("expert_9"))).toBeLessThan(1);
});

test("switching dataset in the page keeps alignment", async ({ page }) => {
  await page.goto("/?dataset=citizen_1&debug=1");
  await settled(page, 2);
  await page.getByLabel("Dataset").selectOption("expert_9");
  await page.waitForTimeout(300);
  const [left, right] = await settled(page, 2);
  expect(Object.keys(left)).toHaveLength(25);
  expect(alignmentOffset(left, right, anchorsOf("expert_9"))).toBeLessThan(1);
});

test("versions stay consistent without visiting the comparison first", async ({ page }) => {
  await page.goto("/?dataset=citizen_1&debug=1");
  await settled(page, 2);
  await page.getByRole("button", { name: "Single", exact: true }).click();
  await settled(page, 1);
  await page.getByLabel("Dataset").selectOption("expert_2");
  await page.waitForTimeout(300);
  const [first] = await settled(page, 1);
  await version(page, "Final").click();
  await page.waitForTimeout(150);
  const [final] = await settled(page, 1);
  await version(page, "V1").click();
  await page.waitForTimeout(150);
  expectSamePositions((await settled(page, 1))[0], first);
  await version(page, "Final").click();
  await page.waitForTimeout(150);
  expectSamePositions((await settled(page, 1))[0], final);
});

test("graphs appear in place on first load", async ({ page }) => {
  await page.addInitScript(() => {
    const frames: unknown[] = [];
    (window as any).__frames = frames;
    const record = () => {
      frames.push(
        [...document.querySelectorAll<any>("div")]
          .filter((div) => div._cyreg?.cy)
          .map((div) => ({
            visible: getComputedStyle(div).visibility === "visible",
            positions: div._cyreg.cy
              .nodes()
              .map((n: any) => `${Math.round(n.position().x)},${Math.round(n.position().y)}`)
              .join(";"),
          })),
      );
      requestAnimationFrame(record);
    };
    record();
  });
  await page.goto("/?dataset=expert_9");
  await settled(page, 2);
  const frames: { visible: boolean; positions: string }[][] = await page.evaluate(
    () => (window as any).__frames,
  );
  const shown = frames.filter((frame) => frame.length === 2);
  const final = shown[shown.length - 1];
  const wrong = (index: number) =>
    shown.filter((f) => f[index].visible && f[index].positions !== final[index].positions).length;
  expect(wrong(0)).toBe(0);
  expect(wrong(1)).toBeLessThanOrEqual(2);
});

const highlighted = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<any>("div")]
      .filter((div) => div._cyreg?.cy)
      .map((div) => {
        const cy = div._cyreg.cy;
        return { nodes: cy.nodes(".route-node").length, links: cy.edges(".route-link").length };
      }),
  );

test("both versions list their loops, and a chosen loop is highlighted in its own graph", async ({ page }) => {
  await page.goto("/?dataset=citizen_3");
  await settled(page, 2);
  await expect(page.getByLabel("Loops in V1").getByText("7 reinforcing, 0 balancing")).toBeVisible();
  await expect(page.getByLabel("Loops in final").getByText("14 reinforcing, 10 balancing")).toBeVisible();

  const loop = page.getByLabel("Loops in final").getByRole("button").first();
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  const [left, right] = await highlighted(page);
  expect(left).toEqual({ nodes: 0, links: 0 });
  expect(right.nodes).toBeGreaterThan(0);
  expect(right.links).toBe(right.nodes);

  await loop.click();
  expect((await highlighted(page))[1]).toEqual({ nodes: 0, links: 0 });
});

test("a diagram without loops says so", async ({ page }) => {
  await page.goto("/?dataset=advocate_7");
  await settled(page, 2);
  await expect(page.getByText("No feedback loops")).toHaveCount(2);
});

test("changing version clears the highlighted loop", async ({ page }) => {
  await page.goto("/?dataset=citizen_1");
  await settled(page, 2);
  await page.getByRole("button", { name: "Single", exact: true }).click();
  await settled(page, 1);
  await page.getByLabel("Loops in V1").getByRole("button").first().click();
  expect((await highlighted(page))[0].nodes).toBeGreaterThan(0);

  await version(page, "Final").click();
  await page.waitForTimeout(150);
  await settled(page, 1);
  expect(await highlighted(page)).toEqual([{ nodes: 0, links: 0 }]);
  await expect(page.getByLabel("Loops in final").getByRole("button")).toHaveCount(11);
});

test("hovering a node shows its terms", async ({ page }) => {
  await page.goto("/?dataset=expert_9");
  await settled(page, 2);
  const point = await page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    const { left, top } = div.getBoundingClientRect();
    const { x, y } = div._cyreg.cy.nodes()[0].renderedPosition();
    return { x: left + x, y: top + y };
  });
  await page.mouse.move(point.x, point.y);
  await expect(page.getByText("Terms", { exact: true })).toBeVisible();
  await expect(page.getByText("Contributions", { exact: true })).toBeVisible();
});

test("the header links back to the docs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Docs" })).toHaveAttribute(
    "href",
    "http://localhost:3200/en/case-perspectiva/",
  );
});

test("a phone starts on one graph and fits the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Single", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
});

const linkWidths = (page: Page) =>
  page.evaluate(() => {
    const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
    return div._cyreg.cy.edges().map((edge: any) => parseFloat(edge.style("width")));
  });

test("the whole workshop shows agreement, and one participant's view in place", async ({ page }) => {
  await page.goto("/?dataset=workshop");
  await settled(page, 2);
  await page.getByRole("button", { name: "Single", exact: true }).click();
  await version(page, "Final").click();
  const [before] = await settled(page, 1);

  // A link four people stated is drawn thicker than one only one person stated
  const widths = await linkWidths(page);
  expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths) * 2);

  await page.getByLabel("Contributors").getByLabel(/citizen_1/).check();
  const hidden = () =>
    page.evaluate(() => {
      const div = [...document.querySelectorAll<any>("div")].find((d) => d._cyreg?.cy);
      return div._cyreg.cy.edges(".contributor-hidden").length;
    });
  await expect.poll(hidden).toBeGreaterThan(150);
  expectSamePositions((await settled(page, 1))[0], before);

  await page.getByLabel("Dataset").selectOption("citizen_1");
  await settled(page, 1);
  await expect(page.getByLabel("Contributors")).toHaveCount(0);
  expect(await hidden()).toBe(0);
});
