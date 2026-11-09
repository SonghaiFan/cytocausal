import type { CausalNode } from "@cytocausal/core";

/** Shows a node's original terms and who contributed them. */
export function NodeTooltip({ node }: { node: CausalNode }) {
  const evidence = (node.evidence ?? []).filter(({ text }) => text);
  const contributions: Record<string, number> = {};
  evidence.forEach(({ contributor = "" }) => {
    const type = contributor.replace(/_\d+$/, "");
    contributions[type] = (contributions[type] ?? 0) + 1;
  });

  return (
    <div className="cc-tooltip">
      <p className="cc-muted">{node.id}</p>
      <h3 className="cc-heading">{node.label.charAt(0).toUpperCase() + node.label.slice(1)}</h3>
      {evidence.length > 0 && (
        <>
          <h4 className="cc-heading cc-block">Terms</h4>
          <ul className="cc-list cc-evidence">
            {evidence.map(({ text }, index) => (
              <li key={index}>
                P{index + 1}: {text}
              </li>
            ))}
          </ul>
          <h4 className="cc-heading cc-block">Contributions</h4>
          <ul className="cc-list cc-evidence">
            {Object.entries(contributions).map(([type, count]) => (
              <li key={type}>
                {count} {type}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
