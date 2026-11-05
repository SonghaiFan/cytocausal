import type { CausalNode } from "@cytocausal/core";

/** Shows a node's original terms and who contributed them. */
export function NodeTooltip({ node }: { node: CausalNode }) {
  const evidence = node.evidence ?? [];
  const contributions: Record<string, number> = {};
  evidence.forEach(({ contributor = "" }) => {
    const type = contributor.replace(/_\d+$/, "");
    contributions[type] = (contributions[type] ?? 0) + 1;
  });

  return (
    <div className="bg-white px-6 py-4 rounded-lg shadow-lg border border-gray-200 text-sm w-max max-w-md">
      <div className="text-gray-900">ID: {node.id}</div>
      <div className="text-gray-700 mt-2 text-lg font-bold">
        {node.label.charAt(0).toUpperCase() + node.label.slice(1)}
      </div>
      {evidence.length > 0 && (
        <>
          <div className="mt-4">
            <strong className="text-gray-800 bg-yellow-400 rounded px-2 py-1">Terms</strong>
            <ul className="list-disc ml-4 mt-2 text-gray-700">
              {evidence.map(({ text }, index) => (
                <li key={index}>
                  P{index + 1}: {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <strong className="text-white bg-red-400 rounded px-2 py-1">Contributions</strong>
            <ul className="list-disc ml-4 mt-2 text-gray-700">
              {Object.entries(contributions).map(([type, count]) => (
                <li key={type}>
                  <span className="font-bold">{count}</span> {type}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
