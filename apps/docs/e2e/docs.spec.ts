import { expect, test, type Page } from "@playwright/test";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const languages = ["en", "zh-cn"];
const guides = [
  "import-data",
  "examples",
  "example-workspace",
  "example-compose",
  "example-versions",
  "example-analysis",
  "api-core",
  "api-react",
  "api-cytoscape",
  "brand",
  "getting-started",
  "showcase",
  "components",
  "theming",
  "interactions",
  "data-model",
  "react-lifecycle",
  "stable-layouts",
  "version-transitions",
  "causal-analysis",
  "scale-performance",
  "case-perspectiva",
  "case-explorer",
];

const sidebarLink = (page: Page, href: string) =>
  page.locator(`aside a[href="${base}${href}"]`).filter({ visible: true }).first();

for (const lang of languages) {
  test(`${lang}: every guide renders with working links and images`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const links = new Set<string>();

    for (const guide of ["", ...guides]) {
      const url = `/${lang}/${guide ? `${guide}/` : ""}`;
      expect((await page.goto(`${base}${url}`))!.status(), url).toBe(200);
      await expect(page.locator("article h1").first()).toBeVisible();

      const hrefs = await page
        .locator('a[href^="/"]')
        .evaluateAll((items) => items.map((item) => item.getAttribute("href")!));
      hrefs.forEach((href) => links.add(href.split("#")[0]));

      const images = page.locator("article img");
      for (let index = 0; index < (await images.count()); index++) {
        const image = images.nth(index);
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
          .toBeGreaterThan(0);
      }
    }

    // Shares the page's cookies, so language redirects behave as they do for a reader
    for (const href of links) {
      const response = await context.request.get(href);
      expect(response.status(), href).toBe(200);
      if (!/\.[a-z0-9]+$/i.test(href) && href !== `${base}/`) expect(new URL(response.url()).pathname, href).toMatch(new RegExp(`^${base}/${lang}/`));
    }
    expect(errors).toEqual([]);
  });

  test(`${lang}: the sidebar and pager keep the language`, async ({ page }) => {
    await page.goto(`${base}/${lang}/getting-started/`);
    await sidebarLink(page, `/${lang}/stable-layouts/`).click();
    await expect(page).toHaveURL(`${base}/${lang}/stable-layouts/`);
    await expect(sidebarLink(page, `/${lang}/stable-layouts/`)).toHaveClass(/x:bg-primary/);

    await page.locator(`a[href="${base}/${lang}/version-transitions/"][title]`).last().click();
    await expect(page).toHaveURL(`${base}/${lang}/version-transitions/`);
  });
}

test("the language switch keeps the chapter and later links follow it", async ({ page }) => {
  await page.goto(`${base}/en/data-model/`);
  await page.getByTitle("Change language").filter({ visible: true }).first().click();
  await page.getByText("简体中文", { exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(`${base}/zh-cn/data-model/`);
  await sidebarLink(page, "/zh-cn/causal-analysis/").click();
  await expect(page).toHaveURL(`${base}/zh-cn/causal-analysis/`);
});

test("reading in Chinese survives link prefetching", async ({ page }) => {
  await page.goto(`${base}/zh-cn/`);
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "zh-cn", url: "http://localhost:3200" }]);
  await page.goto(`${base}/`);
  await expect(page).toHaveURL(`${base}/zh-cn/`);
});

test("unknown URLs return 404", async ({ request }) => {
  for (const url of ["/nope/", "/en/nope/", "/en/styles/"]) {
    expect((await request.get(`${base}${url}`)).status(), url).toBe(404);
  }
});

for (const [lang, query, target] of [
  ["en", "fixedNodeConstraint", "stable-layouts"],
  ["en", "tarjanStronglyConnected", "causal-analysis"],
  ["zh-cn", "反馈回路", "causal-analysis"],
  ["zh-cn", "动画池", "version-transitions"],
]) {
  test(`search finds ${query}`, async ({ page }) => {
    await page.goto(`${base}/${lang}/`);
    await page.locator("input[type=search]:visible").first().fill(query);
    await expect(page.locator(`[role=option] a[href*="${target}"], a[role=option][href*="${target}"], [data-headlessui-state] a[href*="${target}"]`).first()).toBeVisible();
  });
}

test("guides fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${base}/zh-cn/stable-layouts/`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

const demoGraph = (page: Page, frame: string) =>
  page.evaluate((frame) => {
    const div = [...document.querySelectorAll<any>(`${frame} div`)].find((d) => d._cyreg?.cy);
    const cy = div?._cyreg.cy;
    return cy && { nodes: cy.nodes().length, focus: cy.nodes(".focus").map((n: any) => n.id()) };
  }, frame);

test("the showcase runs live demos in both languages", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const lang of languages) {
    await page.goto(`${base}/${lang}/showcase/`);
    await expect.poll(async () => (await demoGraph(page, ".showcase-workspace"))?.nodes).toBe(3);
    await expect.poll(async () => (await demoGraph(page, ".showcase-style"))?.nodes).toBe(5);
    await expect.poll(async () => (await demoGraph(page, ".showcase-compare"))?.nodes).toBe(3);
    await expect.poll(async () => (await demoGraph(page, ".showcase-gallery"))?.focus).toEqual([
      "customers",
      "queue",
    ]);
  }

  const gallery = page.locator(".showcase-gallery");
  const search = gallery.getByRole("article", { name: "NodeSearch", exact: true });
  await search.getByRole("searchbox").fill("Revenue");
  await search.getByRole("button", { name: "Revenue", exact: true }).click();
  await expect.poll(async () => (await demoGraph(page, ".showcase-gallery"))?.focus).toEqual(["revenue"]);

  await page.getByRole("button", { name: "flowing" }).click();
  await expect(page.getByText('link: "flowing"')).toBeVisible();
  expect(errors).toEqual([]);
});

test("the docs link to both example apps", async ({ page }) => {
  for (const [guide, url, name] of [
    ["case-perspectiva", process.env.NEXT_PUBLIC_PERSPECTIVA_URL ?? "http://localhost:3100", "Open the app"],
    ["case-explorer", process.env.NEXT_PUBLIC_EXPLORER_URL ?? "http://localhost:3101", "Open the app"],
  ] as const) {
    await page.goto(`${base}/en/${guide}/`);
    await expect(page.locator("article").getByRole("link", { name })).toHaveAttribute(
      "href",
      url,
    );
  }
  await page.goto(`${base}/zh-cn/case-perspectiva/`);
  await expect(page.locator("article").getByRole("link", { name: "打开应用" })).toBeVisible();

  const navbar = page.locator("nav").first();
  await expect(navbar.getByRole("link", { name: /示例|Examples/ })).toBeVisible();
  await expect(navbar.getByRole("link", { name: "API", exact: true })).toBeVisible();
});


test("independent examples render, select nodes and report bounded analysis", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/en/example-workspace/`);
  await expect.poll(async () => (await demoGraph(page, ".library-example-workspace"))?.nodes).toBe(3);
  await page.goto(`${base}/en/example-compose/`);
  await page.getByRole("searchbox", { name: "Search nodes" }).fill("Soil");
  await page.getByRole("button", { name: "Soil moisture", exact: true }).click();
  await expect.poll(async () => (await demoGraph(page, ".library-example-compose"))?.focus).toEqual(["node:moisture"]);
  await page.goto(`${base}/en/example-versions/`);
  await expect.poll(async () => (await demoGraph(page, ".library-example-versions"))?.nodes).toBe(3);
  await expect(page.locator(".library-example-versions canvas")).toHaveCount(6);
  await page.goto(`${base}/en/example-analysis/`);
  await expect(page.getByRole("status")).toContainText("1 loops · 1 paths");
  const slider = page.getByRole("slider", { name: "Maximum nodes per route" });
  await slider.focus();
  await slider.press("ArrowLeft");
  await expect(page.getByRole("status")).toContainText("0 loops · 0 paths");
  await expect(page.locator(".library-example-analysis pre")).toContainText('"complete": false');
  expect(errors).toEqual([]);
});

test("brand and examples remain usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/zh-cn/", "/zh-cn/import-data/", "/zh-cn/example-compose/", "/zh-cn/brand/"]) {
    await page.goto(`${base}${path}`);
    await expect(page.locator(".cc-brand img").first()).toBeVisible();
    await expect(page.locator('.cc-brand img[alt="cytocausal"]:visible')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), path).toBe(false);
  }
});
