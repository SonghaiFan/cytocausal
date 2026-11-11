import { validateDataset, type CausalDataset } from "@cytocausal/core";

export const STORAGE_KEY = "cytocausal-studio-v1";
export const emptyDataset = (): CausalDataset => ({ id: "Untitled graph", snapshots: [{ id: "draft", nodes: [], edges: [] }] });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Validate unknown input before handing a typed graph to the library. Preserve optional data. */
export function parseDataset(input: unknown): CausalDataset {
  if (!object(input) || !string(input.id) || !Array.isArray(input.snapshots) || !input.snapshots.length) {
    throw new Error("A dataset needs an id and at least one snapshot.");
  }
  for (const raw of input.snapshots) {
    if (!object(raw) || !string(raw.id) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw new Error("Each snapshot needs an id, nodes and edges arrays.");
    const ids = new Set<string>();
    for (const [kind, items] of [["node", raw.nodes], ["edge", raw.edges]] as const) {
      for (const item of items) {
        if (!object(item) || !string(item.id)) throw new Error(`Every ${kind} needs a nonempty id.`);
        if (ids.has(item.id)) throw new Error(`Duplicate element id: ${item.id}`);
        ids.add(item.id);
        if (kind === "node" && !string(item.label)) throw new Error(`Node ${item.id} needs a label.`);
        if (kind === "edge" && (!string(item.source) || !string(item.target))) throw new Error(`Link ${item.id} needs source and target ids.`);
        if (item.polarity !== undefined && item.polarity !== "positive" && item.polarity !== "negative") throw new Error(`Invalid polarity on ${item.id}; omit it when unknown.`);
        if (item.position !== undefined && (!object(item.position) || !Number.isFinite(item.position.x) || !Number.isFinite(item.position.y))) throw new Error(`Invalid position on ${item.id}.`);
        if (item.metadata !== undefined && !object(item.metadata)) throw new Error(`Invalid metadata on ${item.id}.`);
        if (item.evidence !== undefined && (!Array.isArray(item.evidence) || item.evidence.some(e => !object(e) || ["id", "text", "contributor"].some(key => e[key] !== undefined && typeof e[key] !== "string")))) throw new Error(`Invalid evidence on ${item.id}.`);
      }
    }
  }
  if (input.correspondences !== undefined && (!Array.isArray(input.correspondences) || input.correspondences.some(c => !object(c) || !string(c.from) || !string(c.to) || !object(c.nodes) || Object.values(c.nodes).some(value => !string(value))))) throw new Error("Invalid correspondence map.");
  const dataset = input as unknown as CausalDataset;
  // Identity continuity warnings do not prevent editing an otherwise structurally sound graph.
  const issues = validateDataset(dataset).filter(issue => !issue.includes("no correspondence, and only"));
  if (issues.length) throw new Error(issues.join("\n"));
  return structuredClone(dataset);
}

export function deleteNode(dataset: CausalDataset, version: string, id: string): CausalDataset {
  return {
    ...dataset,
    snapshots: dataset.snapshots.map(snapshot => snapshot.id === version ? {
      ...snapshot,
      nodes: snapshot.nodes.filter(node => node.id !== id),
      edges: snapshot.edges.filter(edge => edge.source !== id && edge.target !== id),
    } : snapshot),
    correspondences: dataset.correspondences?.map(map => ({
      ...map,
      nodes: Object.fromEntries(Object.entries(map.nodes).filter(([from, to]) => !(map.from === version && from === id) && !(map.to === version && to === id))),
    })),
  };
}
