"use client";
import { useState } from "react";
import { useCausal } from "./CausalProvider.tsx";
import { LoopSearchControls, useLoopSearch } from "./LoopSearch.tsx";
import { LoopList } from "./LoopList.tsx";

/** One place to configure, inspect and select cycles for the current selection. */
export function CyclePanel() {
  const { graph } = useCausal();
  return <ScopedCycles key={graph.selected.join("\0")} />;
}
function ScopedCycles() {
  const { graph, snapshot, loopSearch } = useCausal();
  const [through, setThrough] = useState(graph.selected[0] ?? "");
  const selectedSearch = useLoopSearch(through ? snapshot : null, { through: through || undefined });
  const search = through ? selectedSearch : loopSearch;
  return <LoopSearchControls>
    {graph.selected.length > 0 && <label>
      Cycles through
      <select className="cc-select" aria-label="Cycles through" value={through} onChange={event => { graph.previewRoute(null); setThrough(event.target.value); }}>
        <option value="">All nodes</option>
        {graph.selected.map(id => <option key={id} value={id}>{snapshot.nodes.find(node => node.id === id)?.label ?? id}</option>)}
      </select>
    </label>}
    <LoopList bare hideHeading snapshot={snapshot} loops={search.loops} complete={search.complete}
      status={search.status} elapsedMs={search.elapsedMs} error={search.error} onCancel={search.cancel} />
  </LoopSearchControls>;
}
