import { execFileSync } from "node:child_process";
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(await readFile(new URL("./config.json", import.meta.url), "utf8"));
const target = path.join(root, ".release/tarballs");
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
const packed = [];
for (const name of config.packages) {
  const result = JSON.parse(execFileSync("npm", ["pack", path.join(root, ".release/packages", name), "--pack-destination", target, "--json", "--ignore-scripts"], { encoding: "utf8" }))[0];
  if (result.files.some(file => !/^(package\.json|README\.md|LICENSE|THIRD_PARTY_NOTICES|dist\/.*\.(js|d\.ts|css))$/.test(file.path))) throw new Error("Unexpected publish file in " + name);
  packed.push({ name: result.name, version: result.version, filename: result.filename, integrity: result.integrity, size: result.size, unpackedSize: result.unpackedSize });
  console.log(result.filename + " — " + result.entryCount + " files, " + result.size + " bytes");
}
await writeFile(path.join(target, "manifest.json"), JSON.stringify(packed, null, 2) + "\n");
