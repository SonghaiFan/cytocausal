import type { CausalNode } from "./types.ts";

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
        const match = node.evidence?.find((item) => item.text.toLowerCase().includes(query));
        if (match) inEvidence.push({ node, evidence: match.text });
      }
    }
  }
  return [...inLabels, ...inEvidence];
}
