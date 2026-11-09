import type { CausalEdge, CausalNode, Snapshot } from "./types.ts";

export interface SearchResult {
  node: CausalNode;
  /** The evidence that matched, when the label didn't. */
  evidence?: string;
}

/**
 * Finds nodes by exact id, or by text anywhere in their label or evidence. Label matches
 * come first. Queries shorter than two characters match nothing, unless they are an id.
 */
export function searchNodes(nodes: CausalNode[], text: string): SearchResult[] {
  const query = text.trim().toLowerCase();
  if (!query) return [];

  const inLabels: SearchResult[] = [];
  const inEvidence: SearchResult[] = [];
  for (const node of nodes) {
    if (node.id.toLowerCase() === query) {
      inLabels.unshift({ node });
    } else if (query.length >= 2) {
      if (node.label.toLowerCase().includes(query)) {
        inLabels.push({ node });
      } else {
        const match = node.evidence?.find((item) => item.text?.toLowerCase().includes(query));
        if (match?.text) inEvidence.push({ node, evidence: match.text });
      }
    }
  }
  return [...inLabels, ...inEvidence];
}

export interface NeighbourLinks {
  node: CausalNode;
  /** Every link between the two, such as when people disagree on its polarity. */
  links: CausalEdge[];
}

/** The nodes linked to a node in one direction, each once, with the links that join them. */
function neighbours({ nodes, edges }: Snapshot, id: string, direction: "in" | "out") {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const found = new Map<string, NeighbourLinks>();
  for (const edge of edges) {
    const [here, there] = direction === "in" ? [edge.target, edge.source] : [edge.source, edge.target];
    const node = byId.get(there);
    if (here !== id || !node) continue;
    if (!found.has(there)) found.set(there, { node, links: [] });
    found.get(there)!.links.push(edge);
  }
  return [...found.values()];
}

/** The nodes that directly cause a node, with the links from each. */
export const linksInto = (snapshot: Snapshot, id: string) => neighbours(snapshot, id, "in");

/** The nodes a node directly leads to, with the links to each. */
export const linksOutOf = (snapshot: Snapshot, id: string) => neighbours(snapshot, id, "out");

/** Lists the nodes that directly cause a node. */
export const causesOf = ({ nodes, edges }: Snapshot, id: string) =>
  edges
    .filter(({ target }) => target === id)
    .map(({ source }) => nodes.find((node) => node.id === source)!);

/** Lists the nodes a node directly leads to. */
export const effectsOf = ({ nodes, edges }: Snapshot, id: string) =>
  edges
    .filter(({ source }) => source === id)
    .map(({ target }) => nodes.find((node) => node.id === target)!);
