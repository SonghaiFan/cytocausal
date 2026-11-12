import ts from "typescript";
import { build as bundle } from "esbuild";
import { workerNotices } from "./notices.mjs";
import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(await readFile(new URL("./config.json", import.meta.url), "utf8"));
const output = path.join(root, ".release/packages");
await rm(path.join(root, ".release/verification.json"), { force: true });
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
for (const name of config.packages) {
  const source = path.join(root, "packages", name);
  const target = path.join(output, name);
  const src = path.join(source, "src");
  const dist = path.join(target, "dist");
  const manifest = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));
  const paths = Object.fromEntries(config.packages.filter(n => n !== name).map(n => [
    "@cytocausal/" + n, [path.join(output, n, "dist/index.d.ts")],
  ]));
  const program = ts.createProgram({
    rootNames: [...(await files(src)).filter(f => /\.tsx?$/.test(f)), path.join(root, "packages/cytoscape/src/extensions.d.ts")],
    options: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
      rootDir: src, outDir: dist, declaration: true, strict: true,
      skipLibCheck: false, noEmitOnError: true, rewriteRelativeImportExtensions: true,
      verbatimModuleSyntax: true, paths, types: [],
    },
  });
  const emitted = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics];
  if (diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => "\n",
    }));
    process.exit(1);
  }
  // Worker URL literals aren't import specifiers; rewrite these and declaration specifiers too.
  for (const file of await files(dist)) {
    if (/\.(js|d\.ts)$/.test(file)) {
      const content = (await readFile(file, "utf8")).replace(/(["'])(\.\.?\/[^"'\n]+)\.tsx?\1/g, (_, q, p) => q + p + ".js" + q);
      await writeFile(file, content);
    }
  }
  for (const file of await files(src)) if (file.endsWith(".css")) await cp(file, path.join(dist, path.relative(src, file)));
  if (name === "react") {
    // Ship workers with their own dependencies: development servers need not transform
    // layout extensions or resolve bare CommonJS imports inside a worker.
    for (const worker of ["layout", "loop"]) {
      await bundle({
        entryPoints: [path.join(dist, worker + ".worker.js")],
        outfile: path.join(dist, worker + ".worker.js"),
        allowOverwrite: true, bundle: true, format: "esm", platform: "browser",
        target: "es2022", minify: true,
        alias: {
          "@cytocausal/core": path.join(output, "core/dist/index.js"),
          "@cytocausal/cytoscape": path.join(output, "cytoscape/dist/index.js"),
        },
      });
    }
  }
  if (name === "react") await writeFile(path.join(target, "THIRD_PARTY_NOTICES"), await workerNotices(root));
  const dependencies = { ...manifest.dependencies };
  for (const dep of Object.keys(dependencies)) if (dep.startsWith("@cytocausal/")) dependencies[dep] = config.version;
  const peers = { ...manifest.peerDependencies };
  if (name !== "core") {
    delete dependencies.cytoscape;
    peers.cytoscape = "3.31.0";
    dependencies["@types/cytoscape"] = "3.21.8";
  }
  const exports = { ".": { types: "./dist/index.d.ts", import: "./dist/index.js", default: "./dist/index.js" } };
  if (name === "react") {
    exports["./styles.css"] = "./dist/styles.css";
    exports["./editor.css"] = "./dist/editor.css";
  }
  await writeFile(path.join(target, "package.json"), JSON.stringify({
    name: manifest.name, version: config.version, type: "module",
    description: {
      core: "Causal graph data, evidence, versions and analysis.",
      cytoscape: "Causal graph styles, layouts and interactions for Cytoscape.js.",
      react: "React components for causal graph exploration and authoring, built on Cytoscape.js.",
    }[name],
    license: "MIT", author: "Songhai Fan",
    repository: { type: "git", url: "git+https://github.com/SonghaiFan/cytocausal.git", directory: "packages/" + name },
    homepage: "https://songhaifan.github.io/cytocausal/en/",
    bugs: { url: "https://github.com/SonghaiFan/cytocausal/issues" },
    keywords: ["causal-graph", "cytoscape", "visualization", ...(name === "react" ? ["react"] : [])],
    exports, main: "./dist/index.js", types: "./dist/index.d.ts",
    files: ["dist", "README.md", "LICENSE", ...(name === "react" ? ["THIRD_PARTY_NOTICES"] : [])],
    sideEffects: name === "cytoscape" ? true : name === "react" ? ["**/*.css"] : false,
    ...(Object.keys(dependencies).length ? { dependencies } : {}),
    ...(Object.keys(peers).length ? { peerDependencies: peers } : {}),
    publishConfig: { access: "public", tag: config.tag },
  }, null, 2) + "\n");
  await cp(path.join(root, "LICENSE"), path.join(target, "LICENSE"));
  await cp(path.join(source, "README.md"), path.join(target, "README.md"));
  console.log("Built " + manifest.name + "@" + config.version);
}
