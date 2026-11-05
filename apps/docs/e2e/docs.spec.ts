import { expect, test, type Page } from "@playwright/test";

const languages = ["en", "zh-cn"];
const guides = [
  "setup",
  "elements",
  "layouts",
  "styles",
  "events",
  "algorithms",
  "data",
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
  page.locator(`aside a[href="${href}"]`).filter({ visible: true }).first();

for (const lang of languages) {
  test(`${lang}: every guide renders with working links and images`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const links = new Set<string>();

    for (const guide of ["", ...guides]) {
      const url = `/${lang}/${guide ? `${guide}/` : ""}`;
      expect((await page.goto(url))!.status(), url).toBe(200);
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
      if (!/^\/(examples|$)/.test(href)) {
        expect(new URL(response.url()).pathname, href).toMatch(new RegExp(`^/${lang}/`));
      }
    }
    expect(errors).toEqual([]);
  });

  test(`${lang}: the sidebar and pager keep the language`, async ({ page }) => {
    await page.goto(`/${lang}/`);
    await sidebarLink(page, "/stable-layouts/").click();
    await expect(page).toHaveURL(`/${lang}/stable-layouts/`);
    await expect(sidebarLink(page, "/stable-layouts/")).toHaveClass(/x:bg-primary/);

    await page.locator('article ~ * a[href="/version-transitions/"], a[href="/version-transitions/"][title]').last().click();
    await expect(page).toHaveURL(`/${lang}/version-transitions/`);
  });
}

test("the language switch keeps the chapter and later links follow it", async ({ page }) => {
  await page.goto("/en/styles/");
  await page.getByTitle("Change language").filter({ visible: true }).first().click();
  await page.getByText("简体中文", { exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL("/zh-cn/styles/");
  await sidebarLink(page, "/events/").click();
  await expect(page).toHaveURL("/zh-cn/events/");
});

test("reading in Chinese survives link prefetching", async ({ page }) => {
  await page.goto("/zh-cn/");
  await page.waitForTimeout(1500);
  await page.goto("/");
  await expect(page).toHaveURL("/zh-cn/");
});

test("demo sidebars go to guides in the demo's language", async ({ page }) => {
  await page.goto("/en/");
  await page.goto("/examples/vanilla/en/styles/");
  await sidebarLink(page, "/en/events/").click();
  await expect(page).toHaveURL("/en/events/");

  await page.goto("/examples/react/styles/");
  await expect(page.locator("canvas").first()).toBeAttached();
  await sidebarLink(page, "/zh-cn/events/").click();
  await expect(page).toHaveURL("/zh-cn/events/");
});

test("old and unknown URLs behave", async ({ request }) => {
  expect((await request.get("/en/1-setup/")).url()).toContain("/en/setup/");
  expect((await request.get("/examples/1-setup/")).url()).toContain("/examples/react/setup/");
  expect((await request.get("/")).url()).toContain("/en/");
  for (const url of ["/nope/", "/en/nope/", "/examples/react/nope/", "/examples/vanilla/fr/setup/"]) {
    expect((await request.get(url)).status(), url).toBe(404);
  }
});

for (const [lang, query, target] of [
  ["en", "fixedNodeConstraint", "stable-layouts"],
  ["en", "tarjanStronglyConnected", "causal-analysis"],
  ["zh-cn", "反馈回路", "causal-analysis"],
  ["zh-cn", "动画池", "version-transitions"],
]) {
  test(`search finds ${query}`, async ({ page }) => {
    await page.goto(`/${lang}/`);
    await page.locator("input[type=search]:visible").first().fill(query);
    await expect(page.locator(`[role=option] a[href*="${target}"], a[role=option][href*="${target}"], [data-headlessui-state] a[href*="${target}"]`).first()).toBeVisible();
  });
}

test("guides fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/zh-cn/stable-layouts/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
