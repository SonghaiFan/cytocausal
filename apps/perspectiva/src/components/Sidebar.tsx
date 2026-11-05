import type { CausalNode } from "@cytocausal/core";
import { Legend, VersionSwitcher } from "@cytocausal/react";
import type { ReactNode } from "react";
import { colorSchema } from "@/graph-style";

export type ViewMode = "1 Graph" | "2 Graphs";

const panel = "bg-white border rounded-md p-2 mb-8 shadow-lg";
const heading = "text-lg font-semibold mb-2";

const titleCase = (name: string) =>
  name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export function Sidebar({
  debug,
  datasetIds,
  datasetId,
  onDatasetChange,
  layoutNames,
  layoutName,
  onLayoutChange,
  viewMode,
  onViewModeChange,
  versions,
  version,
  onVersionChange,
  terms,
  children,
}: {
  debug: boolean;
  datasetIds: string[];
  datasetId: string;
  onDatasetChange: (id: string) => void;
  layoutNames: string[];
  layoutName: string;
  onLayoutChange: (name: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  versions: string[];
  version: string;
  onVersionChange: (version: string) => void;
  terms: CausalNode[];
  children: ReactNode;
}) {
  return (
    <div className="w-[15%] min-w-48 p-4 h-full overflow-auto">
      <Legend
        title="Legend"
        className="mb-8 shadow-lg"
        items={colorSchema.map(({ label, color }) => ({ label, color }))}
      />

      {debug && (
        <div className={panel}>
          <h4 className={heading}>Dataset</h4>
          <select
            aria-label="Dataset"
            value={datasetId}
            onChange={(event) => onDatasetChange(event.target.value)}
            className="w-full border rounded p-1"
          >
            {datasetIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={panel}>
        <h4 className={heading}>Diagram Layout</h4>
        <div className="flex items-center space-x-2 border p-1 rounded-md mt-5">
          {layoutNames.map((name) => (
            <label
              key={name}
              className={`w-full py-2 text-center rounded cursor-pointer ${
                layoutName === name ? "bg-gray-200" : "hover:bg-gray-100"
              }`}
            >
              <input
                type="radio"
                name="layout"
                value={name}
                checked={layoutName === name}
                onChange={() => onLayoutChange(name)}
                className="sr-only"
              />
              <span>{name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-md p-2 mb-4 shadow-lg">
        <h4 className={heading}>View Mode</h4>
        <select
          aria-label="View Mode"
          value={viewMode}
          onChange={(event) => onViewModeChange(event.target.value as ViewMode)}
          className="w-full border rounded p-1"
        >
          <option value="1 Graph">1 Graph</option>
          <option value="2 Graphs">2 Graphs</option>
        </select>
      </div>

      {viewMode === "1 Graph" && (
        <VersionSwitcher
          className="mb-8 shadow-lg"
          versions={versions}
          value={version}
          onChange={onVersionChange}
          format={titleCase}
        />
      )}

      {children}

      <div className={panel}>
        <h4 className={heading}>Term List</h4>
        {terms.map(({ id, label, metadata }) => (
          <div key={id} className="truncate hover:bg-gray-100 p-1 rounded-md">
            {String(metadata?.key ?? id)} {label}
          </div>
        ))}
      </div>
    </div>
  );
}
