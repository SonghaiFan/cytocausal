import { createCausalStyle, lightTheme, type CausalTheme } from "@cytocausal/cytoscape";

export const theme: CausalTheme = {
  ...lightTheme,
  name: "explorer",
  dimmedOpacity: 0.12,
  colors: {
    ...lightTheme.colors,
    text: "#000000",
    node: "#1f77b4",
    link: "#cccccc",
    focus: "#111111",
    cause: "#d95f02",
    effect: "#1b9e77",
  },
};

export const CAUSE_COLOR = theme.colors.cause;
export const EFFECT_COLOR = theme.colors.effect;

export const graphStyles = createCausalStyle(theme, {
  link: "straight",
  sizeByScore: true,
  managedLabels: true,
});
