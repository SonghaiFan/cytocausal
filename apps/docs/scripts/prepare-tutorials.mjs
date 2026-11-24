import { readFile, writeFile, readdir, mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const docs = fileURLToPath(new URL("../", import.meta.url));
const root = resolve(docs, "../..");
const dir = resolve(docs, "src/components/tutorials");
const assets = resolve(docs, "public/tutorials");
const chapters = { setup: "1-setup", elements: "2-elements", layouts: "3-layout", styles: "4-style", events: "5-events", algorithms: "6-algorithms", data: "7-data" };
const sources = {};
const rawFiles = new Map();
for (const [topic, slug] of Object.entries(chapters)) {
  const files = new Map();
  async function collect(file) {
    if (files.has(file)) return;
    const code = await readFile(file, "utf8");
    files.set(file, { name: relative(dir, file), code });
    for (const [, specifier] of code.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) {
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
      const path = specifier.startsWith("@/") ? resolve(docs, "src", specifier.slice(2)) : resolve(dirname(file), specifier);
      let found = false;
      for (const ext of ["", ".tsx", ".ts"]) {
        try { await readFile(path + ext); await collect(path + ext); found = true; break; }
        catch (error) { if (error.code !== "ENOENT" && error.code !== "EISDIR") throw error; }
      }
      if (!found) throw new Error(`Unresolved tutorial import: ${specifier} in ${file}`);
    }
  }
  await collect(resolve(dir, `react/${slug}/page.tsx`));
  await collect(resolve(dir, "extensions.d.ts"));
  if (["elements", "events", "data"].includes(topic)) await collect(resolve(dir, "framework/CommandsExample.tsx"));
  for (const lang of ["en", "zh-cn"]) {
    const name = `vanilla/${lang}/${topic}.html`;
    files.set(name, { name, code: await readFile(resolve(assets, name), "utf8") });
  }
  for (const name of ["demo-frame.css", "demo-frame.js", "demo-controls.css"]) {
    files.set(name, { name, code: await readFile(resolve(assets, name), "utf8") });
  }
  files.set("tutorials.css", { name: "tutorials.css", code: await readFile(resolve(dir, "tutorials.css"), "utf8") });
  sources[topic] = [...files.values()].map(file => {
    const path = `source-files/${file.name}.txt`;
    rawFiles.set(path, file.code);
    return { name: file.name, url: `/tutorials/${path}` };
  });
}
const output = JSON.stringify(sources, null, 2) + "\n";
const sourcePath = resolve(dir, "sources.json");
if (process.argv.includes("--check")) {
  if (await readFile(sourcePath, "utf8") !== output) throw new Error("Tutorial source display is stale: run npm run prepare:tutorials -w @cytocausal/docs");
  for (const [name, code] of rawFiles) {
    if (await readFile(resolve(assets, name), "utf8") !== code) throw new Error(`Stale served example source: ${name}`);
  }
} else {
  await writeFile(sourcePath, output);
  await mkdir(assets, { recursive: true });
  for (const [name, code] of rawFiles) {
    const path = resolve(assets, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, code);
  }
  await copyFile(resolve(root, "node_modules/cytoscape/dist/cytoscape.min.js"), resolve(assets, "cytoscape.min.js"));
  await copyFile(resolve(root, "node_modules/cytoscape/LICENSE"), resolve(assets, "cytoscape-LICENSE.txt"));
  await build({
    stdin: { contents: `import cytoscape from 'cytoscape';\n${["cola", "dagre", "elk", "fcose", "cose-bilkent", "cise"].map((name, i) => `import extension${i} from 'cytoscape-${name}'; cytoscape.use(extension${i});`).join("\n")}\nwindow.cytoscape = cytoscape;`, resolveDir: docs },
    bundle: true, minify: true, platform: "browser", format: "iife", legalComments: "external", outfile: resolve(assets, "layouts.js"),
  });
  // Include dependency licences alongside the generated bundle.
  const licences = [];
  for (const name of (await readdir(resolve(root, "node_modules"))).filter(name => /^(cytoscape|cose-base|layout-base|avsdf-base|webcola|dagre|elkjs|weaver)/.test(name))) {
    for (const file of ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE"]) {
      try { licences.push(`${name}\n${await readFile(resolve(root, "node_modules", name, file), "utf8")}`); break; } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
  await writeFile(resolve(assets, "dependency-LICENSES.txt"), licences.join("\n\n"));
}
console.log("7 tutorial source sets verified; vanilla dependencies are bundled locally.");
