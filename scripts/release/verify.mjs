import { spawn, execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../../", import.meta.url));
await rm(path.join(root, ".release/verification.json"), { force: true });
const work = await mkdtemp(path.join(tmpdir(), "cytocausal-consumers-"));
const artifacts = path.join(root, ".release/tarballs");
const manifest = JSON.parse(await readFile(path.join(artifacts, "manifest.json"), "utf8"));
const fixtures = path.join(root, "tests/package-consumers");
const children = [];
const run = (cmd, args, cwd, extra = {}) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit", ...extra });
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolve() : reject(new Error(cmd + " exited " + code)));
});
async function server(cwd, args, url) {
  const log = [];
  const child = spawn("npm", args, { cwd, stdio: ["ignore", "pipe", "pipe"], detached: true });
  children.push(child);
  child.stdout.on("data", data => log.push(String(data)));
  child.stderr.on("data", data => log.push(String(data)));
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(log.join(""));
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Server did not start: " + log.join(""));
}
async function json(file, value) { await writeFile(file, JSON.stringify(value, null, 2) + "\n"); }
const urls = {};
try {
  for (const kind of ["vite", "next"]) {
    const cwd = path.join(work, kind);
    await mkdir(cwd, { recursive: true });
    const dependencies = Object.fromEntries(manifest.map(p => [p.name, "file:" + path.join(artifacts, p.filename)]));
    Object.assign(dependencies, { react: "19.3.1", "react-dom": "19.3.1", cytoscape: "3.31.0" });
    dependencies[kind] = kind === "vite" ? "8.3.8" : "16.4.5";
    await json(path.join(cwd, "package.json"), {
      name: "cytocausal-" + kind + "-consumer", private: true, type: "module", dependencies,
      devDependencies: { typescript: "5.9.3", "@types/react": "^19", "@types/react-dom": "^19", "@types/node": "^22" },
      scripts: { build: kind + " build", start: kind === "vite" ? "vite preview --host 127.0.0.1 --port 4201 --strictPort" : "next start -H 127.0.0.1 -p 4202", dev: "vite --host 127.0.0.1 --port 4203 --strictPort" },
    });
    await cp(path.join(fixtures, "App.tsx"), path.join(cwd, "App.tsx"));
    await json(path.join(cwd, "tsconfig.json"), {
      compilerOptions: { target: "ES2022", lib: ["DOM", "ES2022"], module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: false, esModuleInterop: true },
      include: ["App.tsx"],
    });
    if (kind === "vite") {
      await writeFile(path.join(cwd, "index.html"), '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
      await writeFile(path.join(cwd, "main.tsx"), 'import { createRoot } from "react-dom/client"; import App from "./App"; createRoot(document.getElementById("root")!).render(<App />);');
    } else {
      await mkdir(path.join(cwd, "app"));
      await writeFile(path.join(cwd, "app/layout.tsx"), 'import type { ReactNode } from "react"; export default function Layout({children}:{children:ReactNode}) {return <html><head><link rel="icon" href="data:," /></head><body style={{margin:0}}>{children}</body></html>}');
      await writeFile(path.join(cwd, "app/page.tsx"), '"use client"; import dynamic from "next/dynamic"; const App = dynamic(() => import("../App"), {ssr:false}); export default App;');
    }
    console.log("\nInstalling packed packages into " + cwd);
    await run("npm", ["install", "--no-audit", "--no-fund"], cwd);
    for (const p of manifest) assert((await realpath(path.join(cwd, "node_modules", p.name))).startsWith((await realpath(cwd)) + path.sep), "Consumer must not link to source workspace");
    execFileSync(process.execPath, ["--input-type=module", "-e", 'import {createEmptyDataset} from "@cytocausal/core"; if(createEmptyDataset().snapshots.length!==1) throw Error("Core runtime failed")'], { cwd });
    await run(process.execPath, [path.join(cwd, "node_modules/typescript/bin/tsc"), "--noEmit"], cwd);
    if (kind === "next") {
      // The dedicated check above validates our declarations with skipLibCheck=false.
      // Next's generated framework types need its usual skipLibCheck setting.
      const tsconfig = JSON.parse(await readFile(path.join(cwd, "tsconfig.json"), "utf8"));
      tsconfig.compilerOptions.skipLibCheck = true;
      tsconfig.compilerOptions.lib = ["DOM", "DOM.Iterable", "ESNext"];
      await json(path.join(cwd, "tsconfig.json"), tsconfig);
    }
    await run("npm", ["run", "build"], cwd);
    const url = kind === "vite" ? "http://127.0.0.1:4201" : "http://127.0.0.1:4202";
    await server(cwd, ["run", "start"], url);
    urls[kind + "-production"] = url;
    if (kind === "vite") {
      await server(cwd, ["run", "dev"], "http://127.0.0.1:4203");
      urls["vite-development"] = "http://127.0.0.1:4203";
    }
  }
  await run(process.execPath, [path.join(root, "node_modules/@playwright/test/cli.js"), "test", "--config", path.join(fixtures, "playwright.config.ts")], root, {
    env: { ...process.env, CYTOCAUSAL_CONSUMERS: JSON.stringify(urls) },
  });
  await json(path.join(root, ".release/verification.json"), { passed: true, consumers: Object.keys(urls), workspace: work, packages: manifest, verifiedAt: new Date().toISOString() });
  console.log("Independent consumers passed: " + work);
} finally {
  for (const child of children) if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch {} }
}
