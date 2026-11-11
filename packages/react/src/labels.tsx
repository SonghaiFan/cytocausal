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
  /** Chooses what changes are measured against. */
  compareWith: string;
  previousVersion: string;
  firstVersion: string;
  earlierVersion: string;
  laterVersion: string;
  history: string;
  /** Names a node's or link's history, for assistive technology. */
  historyOf: (id: string) => string;
  goToVersion: (version: string) => string;
  historyStart: string;
  historyAdded: string;
  historyUnchanged: string;
  historyRemoved: string;
  historyRenamed: (from: string) => string;
  historyMerged: (from: string) => string;
  historySplit: (into: string) => string;
  historyRegrouped: (from: string, into: string) => string;
  historyFlipped: (polarity: string) => string;
  /** Parallel links that disagree on polarity. */
  mixed: string;
  /** How many nodes and links changed on the way into a version. */
  changeCount: (count: number) => string;
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
  tracePaths: string;
  /** Shown while tracing, until the other end is chosen. */
  tracingHint: string;
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
  seeAll: (count) => `All ${count} are in the sidebar`,
  darkMode: "Dark mode",
  lightMode: "Light mode",
  graph: "Causal graph. Use the arrow keys to move between nodes, and Enter to select one.",
  depth: "Steps shown",
  paths: (from, to) => `Paths from ${from} to ${to}`,
  noPaths: "No paths found",
  changes: "Changes",
  showChanges: "Show on graph",
  compareWith: "Compare with",
  previousVersion: "Previous",
  firstVersion: "First",
  earlierVersion: "Earlier version",
  laterVersion: "Later version",
  history: "History",
  historyOf: (id) => `History of ${id}`,
  goToVersion: (version) => `Go to ${version}`,
  historyStart: "In the first version",
  historyAdded: "Added",
  historyUnchanged: "Unchanged",
  historyRemoved: "Removed",
  historyRenamed: (from) => `Renamed from ${from}`,
  historyMerged: (from) => `Merged from ${from}`,
  historySplit: (into) => `Split into ${into}`,
  historyRegrouped: (from, into) => `Regrouped from ${from} into ${into}`,
  historyFlipped: (polarity) => `Flipped to ${polarity}`,
  mixed: "Mixed",
  changeCount: (count) => `${count} ${count === 1 ? "change" : "changes"}`,
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
  pathHint: "Use the sidebar to trace paths to another node.",
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
  radialMenu: "Linked nodes",
  stepsReach: (steps, nodes) => `${steps} steps: ${nodes} ${nodes === 1 ? "node" : "nodes"}`,
  linkedBothWays: "Causes and follows from",
  loopWithin: (steps) => `Within ${steps} ${steps === 1 ? "step" : "steps"}`,
  tracePaths: "Trace paths to another node",
  tracingHint: "Choose a node to trace paths to. Escape cancels",
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
