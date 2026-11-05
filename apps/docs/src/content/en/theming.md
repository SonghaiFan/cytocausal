---
title: "Themes and styles"
---

# Themes and styles

A theme sets the colours, font and motion for both the graph and the page around it. Colours are named for what they mean, such as `cause` and `reinforcing`, so changing one updates it everywhere.

## Change colours

Start from `lightTheme` or `darkTheme`, and change what you need:

```ts
import { createCausalStyle, lightTheme, type CausalTheme } from "@cytocausal/cytoscape";

export const theme: CausalTheme = {
  ...lightTheme,
  name: "my-theme",
  colors: { ...lightTheme.colors, node: "#0f766e", cause: "#b45309" },
};

export const stylesheet = createCausalStyle(theme, {
  node: "pill",
  link: "flowing",
});
```

Pass `stylesheet` to `GraphView`. Changing it restyles the graph in place, so nodes stay where they are. With `CausalWorkspace`, pass your themes as `themes` and these options as `styleOptions`.

## Choose shapes

| Option | Values | Use it for |
| :--- | :--- | :--- |
| `node` | `dot`, `pill` | `pill` holds the label inside the node |
| `link` | `bezier`, `flowing`, `straight` | `straight` suits dense graphs |
| `sizeByScore` | `true` | Sizing nodes by their `score` data, from 0 to 1 |
| `managedLabels` | `true` | Labels placed by your own code |
| `baseRules` | Cytoscape rules | Styles specific to your app |

## Add your own rules

Use `baseRules` to style your own data. These rules go before the interaction states, so highlights still show on top:

```ts
import { createCausalStyle, lightTheme } from "@cytocausal/cytoscape";
import type { Stylesheet } from "cytoscape";

const statusRules = [
  { selector: 'node[status = "new"]', style: { "background-color": lightTheme.colors.added } },
] as unknown as Stylesheet[];

export const stylesheet = createCausalStyle(lightTheme, { baseRules: statusRules });
```

## Support dark mode

`useColorScheme` follows the system setting until the reader chooses. `CausalRoot` applies the theme to everything inside it:

```tsx
"use client";
import { CausalRoot, themeForScheme, useColorScheme } from "@cytocausal/react";
import type { ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  const { scheme, setScheme } = useColorScheme();
  return (
    <CausalRoot theme={themeForScheme(scheme)}>
      <button onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}>Switch theme</button>
      {children}
    </CausalRoot>
  );
}
```

## Style the page

`CausalRoot` exposes every colour as a CSS variable, such as `--cc-border` and `--cc-muted-text`, so your own CSS can use the same theme.

## Motion

`theme.motion` sets durations in milliseconds:

| Duration | Used for |
| :--- | :--- |
| `fade` | Elements appearing and disappearing |
| `move` | Nodes moving between versions |
| `focus` | Moving the view to a node |
| `view` | Zooming and fitting |

Pass it to `GraphView` as `motion`. If the reader's system asks for reduced motion, cytocausal skips these animations for you.

## Accessibility

`lightTheme` and `darkTheme` are tested for contrast: text reaches 4.5:1 and graph colours reach 3:1 against the background. Custom themes aren't checked, so test yours.
