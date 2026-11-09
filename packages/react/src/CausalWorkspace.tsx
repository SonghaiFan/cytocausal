"use client";
import type { ReactNode } from "react";
import { DepthControl, SelectionPanel, VersionDiff } from "./analysis.tsx";
import { CausalGraph } from "./CausalGraph.tsx";
import { CausalProvider, useCausal, type CausalProviderProps } from "./CausalProvider.tsx";
import { LayoutSwitcher, Legend, SidebarHeader, VersionSwitcher } from "./controls.tsx";
import { useCausalLabels } from "./labels.tsx";
import { ContributorFilter } from "./ContributorFilter.tsx";
import { LoopList } from "./LoopList.tsx";
import { NodeSearch } from "./NodeSearch.tsx";

export interface CausalWorkspaceProps extends Omit<CausalProviderProps, "children" | "className"> {
  title?: string;
  /** Extra panels, shown at the end of the sidebar. */
  children?: ReactNode;
}

function Workspace({ title, children }: Pick<CausalWorkspaceProps, "title" | "children">) {
  const labels = useCausalLabels();
  const { scheme, toggleScheme, issues, exportImage, copyLink, copied } = useCausal();

  return (
    <>
      <CausalGraph>
        <div className="cc-overlay cc-overlay-top">
          <div className="cc-buttons">
            <VersionSwitcher bare />
            <LayoutSwitcher bare />
          </div>
          <div className="cc-buttons">
            <button type="button" className="cc-button" onClick={exportImage}>
              {labels.exportImage}
            </button>
            {copyLink && (
              <button type="button" className="cc-button" onClick={copyLink}>
                {copied ? labels.linkCopied : labels.copyLink}
              </button>
            )}
          </div>
        </div>
        <div className="cc-overlay cc-overlay-bottom">
          <Legend bare />
          <DepthControl bare />
        </div>
      </CausalGraph>

      <aside className="cc-sidebar">
        <SidebarHeader title={title} scheme={scheme} onToggleScheme={toggleScheme} />
        {issues.length > 0 && (
          <pre role="alert" className="cc-panel cc-issues">
            {issues.join("\n")}
          </pre>
        )}
        <NodeSearch />
        <ContributorFilter />
        <SelectionPanel />
        <LoopList />
        <VersionDiff />
        {children}
      </aside>
    </>
  );
}

/** A complete interface for a causal dataset, built from the components in this package. */
export function CausalWorkspace({
  title,
  children,
  shareInUrl = true,
  ...props
}: CausalWorkspaceProps) {
  return (
    <CausalProvider {...props} shareInUrl={shareInUrl} className="cc-workspace">
      <Workspace title={title}>{children}</Workspace>
    </CausalProvider>
  );
}
