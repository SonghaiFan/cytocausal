import { createCausalStyle, darkTheme, lightTheme } from "@cytocausal/cytoscape";

// Change colours by editing a copy of lightTheme and darkTheme, and node and link
// shapes through the options of createCausalStyle
export const styles = {
  light: createCausalStyle(lightTheme),
  dark: createCausalStyle(darkTheme),
};
