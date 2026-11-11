import { validateDataset, type CausalDataset, type CausalEdge } from "@cytocausal/core";
import raw from "./garden.json" with { type: "json" };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object");
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${field}`);
  return value.trim();
}

/** Parse the external format before asking the library to validate graph structure. */
export function importGarden(input: unknown): CausalDataset {
  const source = record(input);
  if (!Array.isArray(source.variables) || !Array.isArray(source.relationships)) {
    throw new Error("Expected variables and relationships arrays");
  }
  const nodes = source.variables.map((value) => {
    const row = record(value);
    return { id: `node:${text(row.id, "variable id")}`, label: text(row.label, "label") };
  });
  if (!nodes.length) throw new Error("Add at least one variable to this example");
  const edges: CausalEdge[] = source.relationships.map((value) => {
    const row = record(value);
    if (row.sign != null && row.sign !== "+" && row.sign !== "-") {
      throw new Error("sign must be +, -, or null/omitted when unknown");
    }
    return {
      id: `edge:${text(row.id, "relationship id")}`,
      source: `node:${text(row.from, "from")}`,
      target: `node:${text(row.to, "to")}`,
      polarity: row.sign === "+" ? "positive" : row.sign === "-" ? "negative" : undefined,
      evidence: row.statement != null || row.person != null ? [{
        text: row.statement == null ? undefined : text(row.statement, "statement"),
        contributor: row.person == null ? undefined : text(row.person, "person"),
      }] : undefined,
    };
  });
  const dataset: CausalDataset = { id: "garden", snapshots: [{ id: "draft", nodes, edges }] };
  const issues = validateDataset(dataset);
  if (issues.length) throw new Error(issues.join("\n"));
  return dataset;
}

export const dataset = importGarden(raw);

// A review renames one concept and gives it a new source-system id.
const draft = dataset.snapshots[0];
const renamed = (id: string) => id === "node:growth" ? "node:plant-growth" : id;
export const versionedDataset: CausalDataset = {
  ...dataset,
  snapshots: [draft, {
    id: "reviewed",
    nodes: draft.nodes.map((node) => node.id === "node:growth"
      ? { ...node, id: renamed(node.id), label: "Rate of plant growth" } : node),
    edges: draft.edges.map((edge) => ({ ...edge, source: renamed(edge.source), target: renamed(edge.target) })),
  }],
  correspondences: [{
    from: "draft", to: "reviewed",
    // When an explicit map exists, include unchanged nodes too.
    nodes: Object.fromEntries(draft.nodes.map(({ id }) => [id, renamed(id)])),
  }],
};
