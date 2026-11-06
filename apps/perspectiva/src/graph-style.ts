import { createCausalStyle, lightTheme, type CausalTheme } from "@cytocausal/cytoscape";
import type { Stylesheet } from "cytoscape";

export const colorSchema = [
  { index: "2", label: "Relationship needs clarification", color: "#e97451" },
  { index: "3", label: "Conflict with other participants", color: "#2a79ef" },
  { index: "1", label: "Added", color: "#809b88" },
];

const theme: CausalTheme = {
  ...lightTheme,
  name: "perspectiva",
  colors: {
    ...lightTheme.colors,
    background: "#f8fafc",
    link: "#d9dadc",
  },
};

const annotations = colorSchema.flatMap(({ index, color }) => [
  { selector: `node[color = "${index}"]`, style: { "background-color": color } },
  {
    selector: `edge[color="${index}"]`,
    style: { "line-color": color, "target-arrow-color": color },
  },
]) as unknown as Stylesheet[];

export const graphStyles = createCausalStyle(theme, {
  node: "pill",
  link: "flowing",
  baseRules: annotations,
});
