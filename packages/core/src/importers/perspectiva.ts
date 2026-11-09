import type { CausalDataset, CausalEdge, CausalNode, Polarity, Snapshot } from "../types.ts";

interface PerspectivaHistory {
  id: string;
  label: string;
  group: string;
}

interface PerspectivaNode {
  data: {
    id: string;
    key: string;
    label: string;
    participant_type: string;
    color: string;
    history?: PerspectivaHistory[];
  };
}

interface PerspectivaEdge {
  data: {
    id: string;
    source: string;
    target: string;
    polarity: Polarity;
    participant_type: string;
    group: string;
    color: string;
  };
}

interface PerspectivaVersion {
  nodes: PerspectivaNode[];
  edges: PerspectivaEdge[];
}

export type PerspectivaData = Record<string, Record<string, PerspectivaVersion>>;
export type PerspectivaAnchors = Record<string, Record<string, string>>;

const toNode = ({ data }: PerspectivaNode): CausalNode => ({
  id: data.id,
  label: data.label,
  evidence: data.history?.map(({ id, label, group }) => ({ id, text: label, contributor: group })),
  metadata: { key: data.key, participantType: data.participant_type, color: data.color },
});

const toEdge = ({ data }: PerspectivaEdge): CausalEdge => ({
  id: data.id,
  source: data.source,
  target: data.target,
  polarity: data.polarity,
  evidence: [{ contributor: data.group }],
  metadata: { participantType: data.participant_type, group: data.group, color: data.color },
});

/** Merges repeats of a link. Conflicting polarity stays, for validation to report. */
const uniqueEdges = (edges: PerspectivaEdge[]) => [
  ...new Map(edges.map((edge) => [`${edge.data.id}:${edge.data.polarity}`, edge])).values(),
];

/** Converts Perspectiva's `allCyDataSets` and `nodeAnchors`, one dataset per participant. */
export function importPerspectiva(
  data: PerspectivaData,
  anchors: PerspectivaAnchors = {},
): CausalDataset[] {
  return Object.entries(data).map(([id, versions]) => {
    const snapshots: Snapshot[] = Object.entries(versions).map(([version, { nodes, edges }]) => ({
      id: version,
      nodes: nodes.map(toNode),
      edges: uniqueEdges(edges).map(toEdge),
    }));
    return {
      id,
      snapshots,
      correspondences: anchors[id] ? [{ from: "V1", to: "final", nodes: anchors[id] }] : [],
    };
  });
}
