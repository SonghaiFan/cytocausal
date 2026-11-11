"use client";
import {
  changeMarks,
  diffSnapshots,
  getSnapshot,
  listContributors,
  validateDataset,
  type CausalDataset,
  type LoopOptions,
} from "@cytocausal/core";
import {
  autoLayout,
  createCausalStyle,
  darkTheme,
  easeStyles,
  exportImage,
  hideExceptContributors,
  highlightChanges,
  isTransitioning,
  lightTheme,
  resolveMotion,
  savedLayout,
  type CausalStyleOptions,
  type CausalTheme,
  type Positions,
} from "@cytocausal/cytoscape";
import type { Core, LayoutOptions } from "cytoscape";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CausalLabelsProvider, type CausalLabels } from "./labels.tsx";
import { CausalRoot, useColorScheme, type ColorScheme } from "./theme.tsx";
import { useCausalGraph, type CausalGraphOptions } from "./useCausalGraph.ts";

import { LoopSettingsProvider, useLoopSearch, type LoopSettings } from "./LoopSearch.tsx";

export interface CausalProviderProps {
  loopSettings?: LoopSettings;
  dataset: CausalDataset;
  /** Text to replace, such as to translate the interface. Keep this stable between renders. */
  labels?: Partial<CausalLabels>;
  /** Keep this stable between renders. */
  themes?: { light: CausalTheme; dark: CausalTheme };
  /** Sets light or dark, instead of following the system. */
  scheme?: ColorScheme;
  /** Keep this stable between renders. */
  styleOptions?: CausalStyleOptions;
  /** Defaults to saved positions when every node has one, and otherwise an automatic layout. */
  layout?: LayoutOptions;
  /**
   * Layouts people can choose between, by name, such as some of `layouts` from
   * `@cytocausal/cytoscape`. It takes the place of `layout`, and `LayoutSwitcher` shows the
   * choice. Keep this stable between renders.
   */
  layouts?: Record<string, LayoutOptions>;
  /** The layout to start with, from `layouts`. Defaults to the first. */
  initialLayout?: string;
  /** How many nodes can be selected at once. */
  maxSelected?: number;
  /** Nodes to start with selected. */
  initialSelected?: string[];
  /** A link to start with selected, instead of nodes. */
  initialLink?: string;
  /** The snapshot to start on. Defaults to the first. */
  initialVersion?: string;
  /** What changes are measured against, to start with. Defaults to the version before. */
  initialBaseline?: Baseline;
  /** Extra options for `useCausalGraph`, such as for large graphs. */
  graphOptions?: Pick<CausalGraphOptions, "readableLabels" | "focusZoom" | "maxDepth" | "defaultDepth">;
  /** Keep the version and selection in the page address, so a link reopens the same view. */
  shareInUrl?: boolean;
  /**
   * Result budget and initial length when loopSettings is not provided.
   * Defaults to length four and 1000 results. Keep this stable between renders.
   */
  loopOptions?: LoopOptions;
  className?: string;
  children: ReactNode;
}

const defaultThemes = { light: lightTheme, dark: darkTheme };

/**
 * What changes are measured against: the version before the shown one, the first version, or
 * a version by its id.
 */
export type Baseline = "previous" | "first" | (string & {});

/**
 * The two versions to compare, earlier first, for a shown version and a baseline. The first
 * version has nothing before it, so it's compared with the next, which shows what goes next.
 * Null when there's only one version.
 */
export function resolveComparison(dataset: CausalDataset, version: string, baseline: Baseline) {
  const ids = dataset.snapshots.map(({ id }) => id);
  const at = ids.indexOf(version);
  const neighbour = ids[at - 1] ?? ids[at + 1];
  const chosen = baseline === "previous" ? neighbour : baseline === "first" ? ids[0] : baseline;
  const other = chosen && chosen !== version && ids.includes(chosen) ? chosen : neighbour;
  if (!other) return null;
  return ids.indexOf(other) < at ? { from: other, to: version } : { from: version, to: other };
}

function useCausalState({
  dataset,
  themes = defaultThemes,
  scheme: chosenScheme,
  styleOptions,
  layout,
  layouts,
  initialLayout,
  maxSelected = Infinity,
  initialSelected = [],
  initialLink,
  initialVersion,
  initialBaseline = "previous",
  graphOptions,
  shareInUrl = false,
  loopOptions,
}: Omit<CausalProviderProps, "labels" | "className" | "children">) {
  const system = useColorScheme();
  const scheme = chosenScheme ?? system.scheme;
  const theme = themes[scheme];
  const stylesheets = useMemo(
    () => ({
      light: createCausalStyle(themes.light, styleOptions),
      dark: createCausalStyle(themes.dark, styleOptions),
    }),
    [themes, styleOptions],
  );

  const [shared] = useState(() => new URLSearchParams(shareInUrl ? location.search : ""));
  const [version, setShownVersion] = useState(() => {
    const requested = shared.get("version") ?? initialVersion;
    const known = dataset.snapshots.some(({ id }) => id === requested);
    return known ? requested! : dataset.snapshots[0].id;
  });
  const snapshot = getSnapshot(dataset, version);

  const layoutNames = useMemo(() => Object.keys(layouts ?? {}), [layouts]);
  const [chosenLayout, setChosenLayout] = useState(() => {
    const requested = shared.get("layout") ?? initialLayout;
    return requested && layouts?.[requested] ? requested : layoutNames[0];
  });
  // A layout that's gone, such as after `layouts` changes, falls back to the first
  const layoutName = layouts?.[chosenLayout] ? chosenLayout : layoutNames[0];

  const graph = useCausalGraph({
    ...graphOptions,
    maxSelected,
    motion: theme.motion,
    initialSelected: (shared.get("selected")?.split(",") ?? initialSelected).filter((id) =>
      snapshot.nodes.some((node) => node.id === id),
    ),
    initialLink: [shared.get("link") ?? initialLink].find((id) =>
      snapshot.edges.some((edge) => edge.id === id),
    ),
  });
  const { cy, selected, selectedLink, clear } = graph;

  /** Whose nodes and links are shown. Null shows everyone's. It stays across versions. */
  const [contributors, setContributors] = useState<string[] | null>(null);
  const contributorList = useMemo(() => listContributors(snapshot), [snapshot]);
  const shownFilter = useRef({ snapshot, contributors });
  /** Hides what the chosen contributors didn't state, such as after the graph is rebuilt. */
  const applyFilter = useCallback((instance: Core) => {
    const { snapshot, contributors } = shownFilter.current;
    hideExceptContributors(instance, snapshot, contributors);
  }, []);
  useEffect(() => {
    shownFilter.current = { snapshot, contributors };
    if (cy.current && !cy.current.destroyed()) applyFilter(cy.current);
  }, [cy, snapshot, contributors, applyFilter]);

  /**
   * Moves to another snapshot. Its nodes differ, so the selection is cleared, unless `focus`
   * names a node or link of the new snapshot to select once it's shown, such as the same node
   * under its name there.
   */
  const pendingFocus = useRef<{ node?: string; link?: string } | null>(null);
  const setVersion = useCallback(
    (id: string, options: { focus?: { node?: string; link?: string } } = {}) => {
      clear();
      pendingFocus.current = options.focus ?? null;
      setShownVersion(id);
    },
    [clear],
  );
  // The graph moves to a new version over a moment, so the focus waits until every node of it is
  // there and the move has settled, then selects as a click would
  const latestGraph = useRef(graph);
  latestGraph.current = graph;
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const started = performance.now();
    let frame = 0;
    const check = () => {
      const instance = cy.current;
      const arrived =
        instance &&
        !instance.destroyed() &&
        !isTransitioning(instance) &&
        snapshot.nodes.every(({ id }) => instance.getElementById(id).length > 0);
      if (arrived) {
        pendingFocus.current = null;
        if (target.link) latestGraph.current.toggleLink(target.link);
        else if (target.node) latestGraph.current.focus(target.node);
      } else if (performance.now() - started < 5000) frame = requestAnimationFrame(check);
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [cy, snapshot]);

  const issues = useMemo(() => validateDataset(dataset), [dataset]);
  const loopSearch = useLoopSearch(snapshot, loopOptions);
  const { loops, complete } = loopSearch;

  const positionCache = useRef<Record<string, Positions>>({});
  const hasPositions = snapshot.nodes.every(({ position }) => position);

  const [baseline, setBaseline] = useState<Baseline>(() => shared.get("since") ?? initialBaseline);
  const comparison = useMemo(() => resolveComparison(dataset, version, baseline), [dataset, version, baseline]);
  const [showChanges, setShowChanges] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareInUrl) return;
    const url = new URL(location.href);
    url.searchParams.set("version", version);
    if (selected.length) url.searchParams.set("selected", selected.join(","));
    else url.searchParams.delete("selected");
    if (selectedLink) url.searchParams.set("link", selectedLink);
    else url.searchParams.delete("link");
    if (layoutName && layoutName !== layoutNames[0]) url.searchParams.set("layout", layoutName);
    else url.searchParams.delete("layout");
    if (baseline !== "previous") url.searchParams.set("since", baseline);
    else url.searchParams.delete("since");
    history.replaceState(null, "", url);
    setCopied(false);
  }, [shareInUrl, version, selected, selectedLink, layoutName, layoutNames, baseline]);

  useEffect(() => {
    const instance = cy.current;
    if (!instance || !comparison) return;
    const diff = diffSnapshots(dataset, comparison.from, comparison.to);
    // Compared with an earlier version, the shown one marks what came; with a later one, what goes.
    // Both mark what changed
    const side = version === comparison.to ? "to" : "from";
    const change = () => highlightChanges(instance, showChanges ? changeMarks(diff, side) : {});
    if (isTransitioning(instance)) change();
    else easeStyles(instance, change, resolveMotion(theme.motion).highlight);
    // A new version's elements can arrive after this runs, as the graph moves to it, so the
    // marks follow them, once a frame at most
    let frame = 0;
    const again = () => {
      if (!frame) frame = requestAnimationFrame(() => (frame = 0, !instance.destroyed() && change()));
    };
    instance.on("add", again);
    return () => {
      cancelAnimationFrame(frame);
      if (!instance.destroyed()) instance.removeListener("add", again);
    };
  }, [cy, dataset, comparison, showChanges, version, theme]);

  return {
    dataset,
    snapshot,
    version,
    setVersion,
    /** The result of `useCausalGraph`, for selection, highlights and the view. */
    graph,
    theme,
    scheme,
    /** Switches light and dark. Null when the `scheme` prop decides. */
    toggleScheme: chosenScheme
      ? null
      : () => system.setScheme(scheme === "dark" ? "light" : "dark"),
    stylesheet: stylesheets[scheme],
    styleOptions,
    /** Everyone who stated part of the shown snapshot, with how much each stated. */
    contributorList,
    contributors,
    setContributors,
    /** Reapplies the contributor filter. `CausalGraph` calls it on each new graph. */
    applyFilter,
    layout: (layoutName && layouts?.[layoutName]) || layout || (hasPositions ? savedLayout : autoLayout),
    /** The chosen layout's name in `layouts`, or undefined without them. */
    layoutName,
    /** Every name in `layouts`, in order. */
    layoutNames,
    /** Moves the graph into another of `layouts`. */
    setLayoutName: setChosenLayout,
    positionCache,
    loops,
    loopsComplete: complete,
    loopSearch,
    issues,
    /** What changes are measured against: "previous", "first" or a version's id. */
    baseline,
    setBaseline,
    /** The two versions changes are measured between, earlier first, or null with one version. */
    comparison,
    showChanges,
    setShowChanges,
    exportImage: () => {
      if (cy.current) exportImage(cy.current, dataset.id, theme.colors.background);
    },
    /** Copies a link to this view. Null unless `shareInUrl` is on. */
    copyLink: shareInUrl
      ? () => navigator.clipboard.writeText(location.href).then(() => setCopied(true))
      : null,
    copied,
  };
}

export type CausalState = ReturnType<typeof useCausalState>;

const CausalContext = createContext<CausalState | null>(null);

/** The state of the surrounding `CausalProvider`, or null outside one. */
export const useOptionalCausal = () => useContext(CausalContext);

/** The dataset, version, selection and view of the surrounding `CausalProvider`. */
export function useCausal() {
  const state = useOptionalCausal();
  if (!state) throw new Error("useCausal needs a surrounding <CausalProvider>");
  return state;
}

/** Fills in a prop from the provider, and explains what's wrong when neither has it. */
export function required<T>(value: T | null | undefined, component: string, prop: string): T {
  if (value === undefined || value === null) {
    throw new Error(`${component} needs a \`${prop}\` prop or a surrounding <CausalProvider>`);
  }
  return value;
}

function Provider({
  className,
  children,
  ...options
}: Omit<CausalProviderProps, "labels">) {
  const state = useCausalState(options);
  return (
    <CausalContext.Provider value={state}>
      <CausalRoot theme={state.theme} className={className} onKeyDown={(event) => {
        // Handle Escape only within this workspace; nested controls can consume it first.
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          state.graph.dismiss();
        }
      }}>
        {children}
      </CausalRoot>
    </CausalContext.Provider>
  );
}

/**
 * Holds everything a causal interface shares. Components inside it connect themselves, so they
 * need no props.
 */
export function CausalProvider({ labels, loopSettings, ...props }: CausalProviderProps) {
  return (
    <CausalLabelsProvider labels={labels}>
      <LoopSettingsProvider settings={loopSettings ?? { title: labels?.loops ?? "Cycles", description: "Directed routes that return to their starting node.", maxLength: props.loopOptions?.maxLength ?? 4, limit: props.loopOptions?.limit ?? 1000 }}>
        <Provider {...props} />
      </LoopSettingsProvider>
    </CausalLabelsProvider>
  );
}
