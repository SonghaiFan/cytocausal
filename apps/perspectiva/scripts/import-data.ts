// Regenerates data/datasets.json from a checkout of the original Perspectiva project.
//   CYTOCAUSAL_PERSPECTIVA=/path/to/perspectiva npm run import-data
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { combineDatasets, importPerspectiva, validateDataset } from "@cytocausal/core";

const source = process.env.CYTOCAUSAL_PERSPECTIVA;
if (!source) throw new Error("Set CYTOCAUSAL_PERSPECTIVA to the Perspectiva project folder");

const evaluate = (file: string, name: string) => {
  const code = readFileSync(path.join(source, "src/data", file), "utf8")
    .replace(/export\s*\{[^}]*\};?/, "")
    .replace(/^export const/m, "const");
  return new Function(`${code};return ${name};`)();
};

const datasets = importPerspectiva(
  evaluate("new_data.js", "allCyDataSets"),
  evaluate("nodeAnchors.js", "nodeAnchors"),
);

// Node ids differ between participants, but each term's key is shared across the workshop
const workshop = combineDatasets(datasets, {
  id: "workshop",
  key: (node) => String(node.metadata!.key),
});

const all = [...datasets, workshop.dataset];
const issues = [...workshop.issues, ...all.flatMap(validateDataset)];
if (issues.length > 0) throw new Error(issues.join("\n"));

const output = path.resolve(import.meta.dirname, "../data/datasets.json");
writeFileSync(output, `${JSON.stringify(all)}\n`);
console.log(`Wrote ${all.length} datasets to data/datasets.json, the last combining everyone`);
