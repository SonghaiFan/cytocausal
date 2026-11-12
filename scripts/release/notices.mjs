import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** Carry the installed runtime dependency licenses into the self-contained worker package. */
export async function workerNotices(root) {
  const seen = new Map();
  async function visit(name, from) {
    const resolve = createRequire(path.join(from, "package.json")).resolve;
    let directory = path.dirname(resolve(name));
    let manifest;
    for (;;) {
      try { manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")); } catch {}
      if (manifest?.name === name) break;
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error("Cannot find license package: " + name);
      directory = parent;
    }
    const key = name + "@" + manifest.version;
    if (seen.has(key)) return;
    const names = (await readdir(directory, { withFileTypes: true })).filter(e => e.isFile() && /^(license|copying)(\.|$)/i.test(e.name));
    if (!names.length) throw new Error("No runtime license file for " + key);
    seen.set(key, (await Promise.all(names.map(e => readFile(path.join(directory, e.name), "utf8")))).join("\n"));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) await visit(dependency, directory);
  }
  for (const name of ["cytoscape", "cytoscape-cola", "cytoscape-dagre", "cytoscape-fcose"]) await visit(name, root);
  return "Third-party runtime licenses for the bundled layout worker.\n\n" +
    [...seen].sort(([a], [b]) => a.localeCompare(b)).map(([name, license]) => name + "\n" + "=".repeat(name.length) + "\n" + license).join("\n\n");
}
