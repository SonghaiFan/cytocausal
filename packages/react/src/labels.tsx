"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface CausalLabels {
  search: string;
  matches: (count: number) => string;
  node: string;
  close: string;
  causedBy: string;
  leadsTo: string;
  evidence: string;
  loops: string;
  noLoops: string;
  loopSummary: (reinforcing: number, balancing: number) => string;
  reinforcing: string;
  balancing: string;
  version: string;
  causes: string;
  effects: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  seeAll: (count: number) => string;
  darkMode: string;
  lightMode: string;
  graph: string;
  depth: string;
  paths: (from: string, to: string) => string;
  noPaths: string;
  changes: string;
  showChanges: string;
  added: string;
  removed: string;
  renamed: string;
  merged: string;
  linksAdded: string;
  linksRemoved: string;
  polarityChanged: string;
  noChanges: string;
  exportImage: string;
  copyLink: string;
  linkCopied: string;
}

export const defaultLabels: CausalLabels = {
  search: "Search nodes…",
  matches: (count) => `${count} ${count === 1 ? "match" : "matches"}`,
  node: "Node",
  close: "Close",
  causedBy: "Caused by",
  leadsTo: "Leads to",
  evidence: "Evidence",
  loops: "Feedback loops",
  noLoops: "No feedback loops",
  loopSummary: (reinforcing, balancing) => `${reinforcing} reinforcing, ${balancing} balancing`,
  reinforcing: "Reinforcing",
  balancing: "Balancing",
  version: "Version",
  causes: "Causes",
  effects: "Effects",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit graph",
  seeAll: (count) => `Click to see all ${count}`,
  darkMode: "Dark mode",
  lightMode: "Light mode",
  graph: "Causal graph. Use the arrow keys to move between nodes, and Enter to select one.",
  depth: "Steps shown",
  paths: (from, to) => `Paths from ${from} to ${to}`,
  noPaths: "No paths found",
  changes: "Changes",
  showChanges: "Show on graph",
  added: "Added",
  removed: "Removed",
  renamed: "Renamed",
  merged: "Merged",
  linksAdded: "Links added",
  linksRemoved: "Links removed",
  polarityChanged: "Polarity changed",
  noChanges: "No changes",
  exportImage: "Export PNG",
  copyLink: "Copy link",
  linkCopied: "Link copied",
};

const LabelsContext = createContext(defaultLabels);

export const useCausalLabels = () => useContext(LabelsContext);

/** Replaces the text in every component inside it, such as to translate the interface. */
export function CausalLabelsProvider({
  labels,
  children,
}: {
  labels?: Partial<CausalLabels>;
  children: ReactNode;
}) {
  const merged = useMemo(() => ({ ...defaultLabels, ...labels }), [labels]);
  return <LabelsContext.Provider value={merged}>{children}</LabelsContext.Provider>;
}
