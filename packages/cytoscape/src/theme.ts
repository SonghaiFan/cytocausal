export interface CausalColors {
  background: string;
  surface: string;
  border: string;
  text: string;
  mutedText: string;
  node: string;
  /** Text on top of a node, for node styles that hold their label inside. */
  nodeText: string;
  link: string;
  focus: string;
  cause: string;
  effect: string;
  reinforcing: string;
  balancing: string;
  added: string;
  conflict: string;
  clarification: string;
}

/** Durations in milliseconds. */
export interface CausalMotion {
  fade: number;
  move: number;
  focus: number;
  view: number;
}

export interface CausalTheme {
  name: string;
  colors: CausalColors;
  fontFamily: string;
  /** Opacity of whatever a highlight pushes into the background. */
  dimmedOpacity: number;
  motion: CausalMotion;
}

export const defaultMotion: CausalMotion = { fade: 400, move: 800, focus: 600, view: 300 };

const shared = {
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  dimmedOpacity: 0.15,
  motion: defaultMotion,
};

export const lightTheme: CausalTheme = {
  ...shared,
  name: "light",
  colors: {
    background: "#ffffff",
    surface: "#fafafa",
    border: "#e5e5e5",
    text: "#252525",
    mutedText: "#737373",
    node: "#fbbf24",
    nodeText: "#000000",
    link: "#8e9196",
    focus: "#111111",
    cause: "#c2410c",
    effect: "#047857",
    reinforcing: "#b91c1c",
    balancing: "#1d4ed8",
    added: "#4d7c0f",
    conflict: "#1d4ed8",
    clarification: "#c2410c",
  },
};

export const darkTheme: CausalTheme = {
  ...shared,
  name: "dark",
  colors: {
    background: "#141416",
    surface: "#1c1c1e",
    border: "#3b3b3d",
    text: "#eeeeee",
    mutedText: "#a3a3a3",
    node: "#fbbf24",
    nodeText: "#000000",
    link: "#8e9196",
    focus: "#f5f5f5",
    cause: "#fb923c",
    effect: "#34d399",
    reinforcing: "#f87171",
    balancing: "#60a5fa",
    added: "#a3e635",
    conflict: "#60a5fa",
    clarification: "#fb923c",
  },
};

/** Exposes a theme to CSS as --cc-* variables, for the page around the graph. */
export function themeVariables({ colors, fontFamily }: CausalTheme) {
  const variables: Record<string, string> = { "--cc-font-family": fontFamily };
  for (const [name, value] of Object.entries(colors)) {
    variables[`--cc-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`] = value;
  }
  return variables;
}
