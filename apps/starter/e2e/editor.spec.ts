import { test, expect, type Locator } from "@playwright/test";

async function ready(editor: Locator) {
  await expect(editor.locator("canvas")).toHaveCount(3);
  await expect(editor.locator(".cc-layout-status")).toHaveCount(0);
}
async function model(editor: Locator) {
  return editor.evaluate(el => {
    const cy = [...el.querySelectorAll<any>("div")].find(e => e._cyreg?.cy)?._cyreg.cy;
    return { nodes: cy.nodes().map((n: any) => ({ id: n.id(), label: n.data("label") })), edges: cy.edges().length };
  });
}
async function add(editor: Locator, label: string) {
  await editor.getByRole("button", { name: "Add variable", exact: true }).click();
  const input = editor.getByRole("textbox", { name: "Variable name" });
  await input.fill(label); await input.press("Enter");
  await expect.poll(async () => (await model(editor)).nodes.some((n: any) => n.label === label)).toBe(true);
}
async function point(editor: Locator, id: string) {
  await editor.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => editor.evaluate(el => [...el.querySelectorAll<any>("div")].find(e => e._cyreg?.cy)?._cyreg.cy.animated())).toBe(false);
  return editor.evaluate((el, id) => {
    const cy = [...el.querySelectorAll<any>("div")].find(e => e._cyreg?.cy)?._cyreg.cy;
    const p = cy.getElementById(id).renderedPosition(); const b = cy.container().getBoundingClientRect();
    return { x: p.x + b.left, y: p.y + b.top };
  }, id);
}

test("public editor emits changes, isolates histories and never persists to browser storage", async ({ page }) => {
  await page.goto("/editor");
  const first = page.getByRole("region", { name: "Primary editor", exact: true });
  await ready(first); await page.getByRole("button", { name: "Add second editor" }).click();
  const second = page.getByRole("region", { name: "Second editor", exact: true }); await ready(second);
  await add(first, "First only"); await add(second, "Second only");
  await expect(first.getByLabel("Document changes")).toHaveText("1 changes");
  await expect(second.getByLabel("Document changes")).toHaveText("1 changes");
  // Focus inside the first editor: its global shortcut must not undo the second.
  await first.getByRole("button", { name: "Undo", exact: true }).focus();
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await model(first)).nodes.length).toBe(2);
  expect((await model(second)).nodes).toHaveLength(3);
  await first.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await model(first)).nodes.length).toBe(3);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.screenshot({ path: "/tmp/cytocausal-react-editor-example.png", fullPage: true });
});

test("host replacement clears pending edits and history without echoing a change", async ({ page }) => {
  await page.goto("/editor");
  const editor = page.getByRole("region", { name: "Primary editor", exact: true }); await ready(editor);
  await add(editor, "Before reset");
  await editor.getByRole("button", { name: "Add variable", exact: true }).click();
  await editor.getByRole("button", { name: "Load another document" }).click();
  await ready(editor);
  await expect.poll(async () => (await model(editor)).nodes).toEqual([{ id: "fresh", label: "Fresh variable" }]);
  await expect(editor.getByRole("textbox", { name: "Variable name" })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await expect(editor.getByLabel("Document changes")).toHaveText("1 changes");
  await add(editor, "After reset");
  await expect(editor.getByLabel("Document changes")).toHaveText("2 changes");
  await expect(editor.getByLabel("Host document")).toHaveText("Replacement");
});

test("unmount during a sector drag leaves the other editor usable", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/editor"); await page.getByRole("button", { name: "Add second editor" }).click();
  const first = page.getByRole("region", { name: "Primary editor", exact: true });
  const second = page.getByRole("region", { name: "Second editor", exact: true }); await ready(second);
  await second.scrollIntoViewIfNeeded();
  const p = await point(second, "demand"); await page.mouse.click(p.x, p.y, { button: "right" });
  const sector = second.getByRole("menuitem", { name: /Add effect/ }); await expect(sector).toBeVisible();
  const b = await sector.boundingBox(); await page.mouse.move(b!.x+b!.width/2, b!.y+b!.height/2); await page.mouse.down();
  await page.mouse.move(p.x+180, p.y+100, { steps: 5 });
  await expect(second.locator(".connection-preview")).toBeVisible();
  // Simulate the parent removing the component while the pointer is still held.
  await page.getByRole("button", { name: "Remove second editor" }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(second).toHaveCount(0);
  await page.mouse.up(); await page.mouse.move(300, 200);
  await add(first, "Still usable");
  expect(errors).toEqual([]);
});
