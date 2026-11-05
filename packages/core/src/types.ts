export type Polarity = "positive" | "negative";

/** Where a node came from: a sentence, a participant's original term, and so on. */
export interface Evidence {
  id?: string;
  text: string;
  contributor?: string;
}

export interface CausalNode {
  id: string;
  label: string;
  evidence?: Evidence[];
  position?: { x: number; y: number };
  metadata?: Record<string, unknown>;
}

export interface CausalEdge {
  id: string;
  source: string;
  target: string;
  polarity?: Polarity;
  metadata?: Record<string, unknown>;
}

/** One version of a graph. */
export interface Snapshot {
  id: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
}

/** Which node each node of one snapshot became in another. Node ids need not match. */
export interface Correspondence {
  from: string;
  to: string;
  nodes: Record<string, string>;
}

export interface CausalDataset {
  id: string;
  snapshots: Snapshot[];
  correspondences?: Correspondence[];
}
