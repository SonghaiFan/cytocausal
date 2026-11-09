/**
 * Colours for a causal graph and the page around it. One hue only, the accent, and it means one
 * thing: what the reader has chosen to look at. Everything else is neutral, and other meanings
 * use other channels: emphasis is contrast, polarity is line style, support is line width, loop
 * type is a glyph, and cause or effect is the arrow.
 */
export interface CausalColors {
  background: string;
  surface: string;
  border: string;
  text: string;
  mutedText: string;
  /** Fill of a node that holds its label. */
  node: string;
  /** Text on top of a node, for node styles that hold their label inside. */
  nodeText: string;
  /** Links, and dots, at rest. */
  link: string;
  /** The strongest neutral: what a highlight brings forward, rings, and what's new. */
  ink: string;
  /** The one hue: fills what the reader chose, such as a selected node. */
  accent: string;
  /** The accent for lines and rings, dark enough to stand out against the background. */
  accentLine: string;
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
  yellow: "#ffc40a",
  amber: "#a87900",
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
    node: "#ebeae6",
    nodeText: palette.charcoal,
    link: "#8e9196",
    ink: palette.charcoal,
    accent: palette.yellow,
    accentLine: palette.amber,
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
    node: "#2e2d2b",
    nodeText: "#f5f5f3",
    link: "#8e9196",
    ink: "#f5f5f3",
    accent: palette.yellow,
    accentLine: palette.yellow,
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

/**
 * A colour part way from `color` towards `background`, as an opaque hex colour. It looks like
 * `color` at that opacity over the background, without the cost and build-up of transparency.
 */
export function mix(color: string, background: string, amount: number) {
  const channel = (hex: string, start: number) => parseInt(hex.slice(start, start + 2), 16);
  return `#${[1, 3, 5]
    .map((start) => {
      const value = channel(color, start) * amount + channel(background, start) * (1 - amount);
      return Math.round(value).toString(16).padStart(2, "0");
    })
    .join("")}`;
}

/** Exposes a theme to CSS as --cc-* variables, for the page around the graph. */
export function themeVariables({ colors, fontFamily }: CausalTheme) {
  const variables: Record<string, string> = { "--cc-font-family": fontFamily };
  for (const [name, value] of Object.entries(colors)) {
    variables[`--cc-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`] = value;
  }
  return variables;
}
