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
  split: string;
  regrouped: string;
  linksAdded: string;
  linksRemoved: string;
  polarityChanged: string;
  noChanges: string;
  selectHint: string;
  pathHint: string;
  clearSelection: string;
  exportImage: string;
  copyLink: string;
  linkCopied: string;
  link: string;
  positive: string;
  negative: string;
  /** How many people stated a node or link. */
  support: (count: number) => string;
  statedBy: string;
  showLink: string;
  contributors: string;
  everyone: string;
  contributorLinks: (count: number) => string;
  supportLegend: string;
  disagreement: string;
  layout: string;
  /** The usual system dynamics marks for loop types. */
  reinforcingMark: string;
  balancingMark: string;
  selected: string;
  linked: string;
  /** Renamed, merged, split or regrouped nodes, and links whose polarity flipped. */
  changed: string;
  radialMenu: string;
  /** A ring that sets how many steps the highlight reaches, and how many nodes that shows. */
  stepsReach: (steps: number, nodes: number) => string;
  linkedBothWays: string;
  /** Marks a loop that doesn't pass through the node, but lies within the steps shown. */
  loopWithin: (steps: number) => string;
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
  seeAll: (count) => `Click the node to see all ${count}`,
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
  split: "Split",
  regrouped: "Regrouped",
  linksAdded: "Links added",
  linksRemoved: "Links removed",
  polarityChanged: "Polarity changed",
  noChanges: "No changes",
  selectHint: "Click a node to see what causes it and what it leads to.",
  pathHint: "Select a second node to trace the paths between them.",
  clearSelection: "Clear selection",
  exportImage: "Export PNG",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  link: "Link",
  positive: "Positive",
  negative: "Negative",
  support: (count) => `Stated by ${count} ${count === 1 ? "person" : "people"}`,
  statedBy: "Stated by",
  showLink: "Show link",
  contributors: "Contributors",
  everyone: "Everyone",
  contributorLinks: (count) => `${count} ${count === 1 ? "link" : "links"}`,
  supportLegend: "Thicker links: stated by more people",
  disagreement: "People disagree on this link's polarity",
  layout: "Layout",
  reinforcingMark: "R",
  balancingMark: "B",
  selected: "Selected",
  linked: "Causes and effects",
  changed: "Changed",
  radialMenu: "Linked nodes and loops",
  stepsReach: (steps, nodes) => `${steps} steps: ${nodes} ${nodes === 1 ? "node" : "nodes"}`,
  linkedBothWays: "Causes and follows from",
  loopWithin: (steps) => `Within ${steps} ${steps === 1 ? "step" : "steps"}`,
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
