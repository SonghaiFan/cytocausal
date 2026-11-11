import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(new URL("../out/", import.meta.url).pathname);
const portIndex = process.argv.indexOf("-p");
const port = Number(process.env.PORT || (portIndex >= 0 ? process.argv[portIndex + 1] : 3200));
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".wasm":"application/wasm", ".woff2":"font/woff2", ".txt":"text/plain" };
createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (base && path !== base && !path.startsWith(base + "/")) throw new Error("not found");
    path = path.slice(base.length);
    let file = resolve(root, "." + (path || "/"));
    if (file !== root && !file.startsWith(root + sep)) throw new Error("not found");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404; res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(await readFile(resolve(root, "404.html")).catch(() => "Not found"));
  }
}).listen(port, "127.0.0.1", () => console.log(`Docs: http://localhost:${port}${base}/`));
