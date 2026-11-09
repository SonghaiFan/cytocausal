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
  /** How long a highlight takes to fade in or out. */
  highlight: number;
}

export interface CausalTheme {
  name: string;
  colors: CausalColors;
  fontFamily: string;
  /** Opacity of whatever a highlight pushes into the background. */
  dimmedOpacity: number;
  motion: CausalMotion;
}

export const defaultMotion: CausalMotion = { fade: 400, move: 800, focus: 600, view: 300, highlight: 200 };

const shared = {
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  dimmedOpacity: 0.15,
  motion: defaultMotion,
};

const palette = {
  blue: "#679bf1",
  lightBlue: "#8ab9f1",
  paleYellow: "#f8de7e",
  yellow: "#ffc40a",
  charcoal: "#2f2e2c",
  black: "#050505",
};

export const lightTheme: CausalTheme = {
  ...shared,
  name: "light",
  colors: {
    background: "#ffffff",
    surface: "#fafafa",
    border: "#e5e5e5",
    text: palette.charcoal,
    mutedText: "#737373",
    node: palette.yellow,
    nodeText: palette.black,
    link: "#8e9196",
    focus: palette.black,
    cause: palette.charcoal,
    effect: palette.blue,
    reinforcing: palette.yellow,
    balancing: palette.blue,
    added: palette.lightBlue,
    conflict: palette.black,
    clarification: palette.paleYellow,
  },
};

export const darkTheme: CausalTheme = {
  ...shared,
  name: "dark",
  colors: {
    background: palette.black,
    surface: "#171716",
    border: "#3b3a38",
    text: "#f5f5f3",
    mutedText: "#a3a29f",
    node: palette.yellow,
    nodeText: palette.black,
    link: "#8e9196",
    focus: "#ffffff",
    cause: palette.paleYellow,
    effect: palette.blue,
    reinforcing: palette.yellow,
    balancing: palette.blue,
    added: palette.lightBlue,
    conflict: "#f5f5f3",
    clarification: palette.paleYellow,
  },
};

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

/** Black or white, whichever reads better on a colour. Takes a six-digit hex colour. */
export const textOn = (color: string) => (luminance(color) > 0.18 ? palette.black : "#ffffff");

/** Exposes a theme to CSS as --cc-* variables, for the page around the graph. */
export function themeVariables({ colors, fontFamily }: CausalTheme) {
  const variables: Record<string, string> = { "--cc-font-family": fontFamily };
  for (const [name, value] of Object.entries(colors)) {
    variables[`--cc-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`] = value;
  }
  return variables;
}
