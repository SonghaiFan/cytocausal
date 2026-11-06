"use client";
import {
  diffSnapshots,
  findFeedbackLoops,
  validateDataset,
  type CausalDataset,
} from "@cytocausal/core";
import {
  autoLayout,
  createCausalStyle,
  darkTheme,
  exportImage,
  highlightChanges,
  lightTheme,
  savedLayout,
  type CausalStyleOptions,
  type CausalTheme,
  type Positions,
} from "@cytocausal/cytoscape";
import type { LayoutOptions } from "cytoscape";
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
import { useCausalGraph } from "./useCausalGraph.ts";

export interface CausalProviderProps {
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
  /** How many nodes can be selected at once. */
  maxSelected?: number;
  /** Nodes to start with selected. */
  initialSelected?: string[];
  /** The snapshot to start on. Defaults to the first. */
  initialVersion?: string;
  /** Keep the version and selection in the page address, so a link reopens the same view. */
  shareInUrl?: boolean;
  className?: string;
  children: ReactNode;
}

const defaultThemes = { light: lightTheme, dark: darkTheme };

// The number of loops can explode on large graphs, so only short ones are listed
const LARGE_GRAPH = 60;
const LARGE_GRAPH_SEARCH = { maxLength: 6 };

function useCausalState({
  dataset,
  themes = defaultThemes,
  scheme: chosenScheme,
  styleOptions,
  layout,
  maxSelected = 2,
  initialSelected = [],
  initialVersion,
  shareInUrl = false,
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
  const snapshot = dataset.snapshots.find(({ id }) => id === version)!;

  const graph = useCausalGraph({
    maxSelected,
    motion: theme.motion,
    initialSelected: (shared.get("selected")?.split(",") ?? initialSelected).filter((id) =>
      snapshot.nodes.some((node) => node.id === id),
    ),
  });
  const { cy, selected, clear } = graph;

  /** Moves to another snapshot. Its nodes differ, so the selection is cleared. */
  const setVersion = useCallback(
    (id: string) => {
      clear();
      setShownVersion(id);
    },
    [clear],
  );

  const issues = useMemo(() => validateDataset(dataset), [dataset]);
  const { loops, complete } = useMemo(
    () =>
      findFeedbackLoops(
        snapshot,
        snapshot.nodes.length > LARGE_GRAPH ? LARGE_GRAPH_SEARCH : undefined,
      ),
    [snapshot],
  );

  const positionCache = useRef<Record<string, Positions>>({});
  const hasPositions = snapshot.nodes.every(({ position }) => position);

  const first = dataset.snapshots[0].id;
  const last = dataset.snapshots[dataset.snapshots.length - 1].id;
  const [showChanges, setShowChanges] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareInUrl) return;
    const url = new URL(location.href);
    url.searchParams.set("version", version);
    if (selected.length) url.searchParams.set("selected", selected.join(","));
    else url.searchParams.delete("selected");
    history.replaceState(null, "", url);
    setCopied(false);
  }, [shareInUrl, version, selected]);

  useEffect(() => {
    const instance = cy.current;
    if (!instance || first === last) return;
    if (!showChanges) {
      highlightChanges(instance, [], []);
      return;
    }
    const diff = diffSnapshots(dataset, first, last);
    const ids = (items: { id: string }[]) => items.map(({ id }) => id);
    if (version === last) {
      highlightChanges(instance, [...ids(diff.addedNodes), ...ids(diff.addedLinks)], []);
    } else {
      highlightChanges(instance, [], [...ids(diff.removedNodes), ...ids(diff.removedLinks)]);
    }
  }, [cy, dataset, first, last, showChanges, version]);

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
    layout: layout ?? (hasPositions ? savedLayout : autoLayout),
    positionCache,
    loops,
    loopsComplete: complete,
    issues,
    /** The snapshots that changes are measured between. */
    firstVersion: first,
    lastVersion: last,
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
      <CausalRoot theme={state.theme} className={className}>
        {children}
      </CausalRoot>
    </CausalContext.Provider>
  );
}

/**
 * Holds everything a causal interface shares. Components inside it connect themselves, so they
 * need no props.
 */
export function CausalProvider({ labels, ...props }: CausalProviderProps) {
  return (
    <CausalLabelsProvider labels={labels}>
      <Provider {...props} />
    </CausalLabelsProvider>
  );
}
