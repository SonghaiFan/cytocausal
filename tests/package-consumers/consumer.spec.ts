import { test, expect } from "@playwright/test";
for (const [name, url] of Object.entries(JSON.parse(process.env.CYTOCAUSAL_CONSUMERS || "{}") as Record<string, string>)) {
  test(name + ": packed editor, declarations, CSS and real workers", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", msg => { if (msg.type() === "error") console.log(name + ": " + msg.text()); });
    page.on("requestfailed", request => console.log(name + ": " + request.url() + " " + request.failure()?.errorText));
    await page.addInitScript(() => {
      const Original = window.Worker;
      const report = (window as any).__workerReport = { urls: [], results: [], errors: [] };
      window.Worker = class extends Original {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options); report.urls.push(String(url));
          this.addEventListener("message", event => {
            if (event.data.error) report.errors.push(event.data.error);
            if (event.data.positions) report.results.push("layout");
            if (event.data.result) report.results.push("loops");
          });
          this.addEventListener("error", event => report.errors.push({ url: String(url), message: event.message || event.type }));
        }
      };
    });
    await page.goto(url);
    await expect(page.locator("canvas")).toHaveCount(3);
    await expect.poll(() => page.evaluate(() => (window as any).__workerReport), { timeout: 30000 }).toMatchObject({ results: expect.arrayContaining(["layout"]), errors: [] });
    await expect(page.locator(".cc-layout-status")).toHaveCount(0);
    const selected = page.getByRole("button", { name: "Author", exact: true });
    await expect(selected).toHaveCSS("background-color", "rgb(251, 201, 43)");
    await page.getByRole("button", { name: "Add variable", exact: true }).click();
    const input = page.getByRole("textbox", { name: "Variable name" });
    await input.fill("Installed from tarball"); await input.press("Enter");
    await expect(page.getByLabel("Changes")).toHaveText("1");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Changes")).toHaveText("2");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByLabel("Changes")).toHaveText("3");
    await expect(page.getByRole("heading", { name: "Installed from tarball" })).toBeVisible();
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__workerReport.results), { timeout: 30000 }).toContain("loops");
    expect(await page.evaluate(() => (window as any).__workerReport.errors)).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });
}
