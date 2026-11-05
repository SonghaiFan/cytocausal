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
}

export interface CausalTheme {
  name: string;
  colors: CausalColors;
  fontFamily: string;
  /** Opacity of whatever a highlight pushes into the background. */
  dimmedOpacity: number;
  motion: CausalMotion;
}

export const defaultMotion: CausalMotion = { fade: 400, move: 800, focus: 600 };

const shared = {
  fontFamily: "system-ui, sans-serif",
  dimmedOpacity: 0.15,
  motion: defaultMotion,
};

export const lightTheme: CausalTheme = {
  ...shared,
  name: "light",
  colors: {
    background: "#ffffff",
    surface: "#f8fafc",
    border: "#cbd5e1",
    text: "#1e293b",
    mutedText: "#475569",
    node: "#4f46e5",
    nodeText: "#ffffff",
    link: "#64748b",
    focus: "#0f172a",
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
    background: "#0f172a",
    surface: "#1e293b",
    border: "#475569",
    text: "#e2e8f0",
    mutedText: "#94a3b8",
    node: "#818cf8",
    nodeText: "#0f172a",
    link: "#94a3b8",
    focus: "#f8fafc",
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
