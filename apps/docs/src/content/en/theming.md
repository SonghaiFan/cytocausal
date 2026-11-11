---
title: "Themes and styles"
---

# Themes and styles

A theme sets the colours, font and motion for both the graph and the page around it. Colours are named for what they mean, such as `ink` and `accent`, so changing one updates it everywhere.

## Visual meanings

The default styles use arrows for direction, line styles and signs for polarity, and colour for selection and version changes. Line width can encode contributor support; node size can encode a score. Preserve these meanings when adding custom rules, so selection remains distinguishable from data values.

Use node outlines for application-specific categories. The keyboard cursor uses a separate halo. Selection styles take precedence over version-change styles, keeping a selected path or loop visible.

## Change colours

Start from `lightTheme` or `darkTheme`, and change what you need:

```ts
import { createCausalStyle, lightTheme, type CausalTheme } from "@cytocausal/cytoscape";

export const theme: CausalTheme = {
  ...lightTheme,
  name: "my-theme",
  colors: { ...lightTheme.colors, accent: "#12b886" },
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
| `node` | `pill` (default), `dot` | `pill` holds the label inside the node. `dot` suits large graphs |
| `link` | `flowing` (default), `bezier`, `straight` | `straight` suits dense graphs |
| `sizeByScore` | `true` | Sizing nodes by their `score` data, from 0 to 1 |
| `managedLabels` | `true` | Labels placed by your own code |
| `baseRules` | Cytoscape rules | Styles specific to your app |

## Match ROC UI

The components use the same spacing, corners and control sizes as [ROC UI](https://github.com/SonghaiFan/roc-ui). If your page sets its `--roc-*` tokens, such as `--roc-radius-control` or `--roc-control-height`, the components follow them. Colours still come from the theme.

## Add your own rules

Use `baseRules` to style your own data. These rules go before the interaction states, so highlights still show on top:

```ts
import { createCausalStyle, lightTheme } from "@cytocausal/cytoscape";
import type { Stylesheet } from "cytoscape";

const statusRules = [
  { selector: 'node[status = "new"]', style: { "border-width": 2, "border-color": lightTheme.colors.ink } },
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

## What zooming does

`zoom` in `createCausalStyle`, or in `styleOptions` on `CausalProvider`, sets one rule for every mark at once: dots, text, lines, arrows and rings.

| Mode | Zooming in 4 times makes marks | Suits |
| :--- | :--- | :--- |
| `magnify` | 4 times bigger, like a photo | A small diagram read whole, with labels inside nodes, such as Perspectiva |
| `balanced` | 2 times bigger, by the square root of the zoom, as Sigma.js does | Somewhere between |
| `spread` | The same size on screen, while nodes move apart | A dense network people zoom into to separate crowded nodes, such as Causal Explorer |

```ts
import { createCausalStyle, lightTheme } from "@cytocausal/cytoscape";

export const stylesheet = createCausalStyle(lightTheme, { node: "dot", link: "straight", zoom: "spread" });
```

The default is `spread` with `managedLabels`, and `magnify` otherwise. Managed labels keep their text a constant size in every mode, so it stays readable.

Cytoscape sizes everything in model units, so `spread` and `balanced` need the size written for each zoom. `keepConstantSize(cy)` does that on every zoom step, so marks don't swell and snap back. `keepLabelsReadable`, and `readableLabels` in `useCausalGraph`, turn it on for you. Causal Explorer has a switch for comparing the three.

Use the same zoom mode for nodes, links and labels to preserve their relative visual weight.

## Line, arrow and text sizes

Cytoscape measures sizes in model units: a 2 px line at zoom 1 appears 6 px wide at zoom 3. Use `spread` when marks should keep a constant screen size, or `balanced` for slower growth during zooming.

Arrow size also depends on `arrow-scale`; reducing line width alone may not make an arrow smaller. Use `arrowLength(width, scale)` when calculating custom arrow sizes. Choose `flowing`, `bezier` or `straight` links for directed causal graphs.

For readable labels on dense graphs, enable `readableLabels` on `useCausalGraph`. See [Scale and performance](/en/scale-performance/).

## Motion

Use `textOn(color)` to choose black or white text for a custom background colour.

`theme.motion` sets durations in milliseconds:

| Duration | Used for |
| :--- | :--- |
| `fade` | Elements appearing and disappearing |
| `move` | Nodes moving between versions |
| `focus` | Moving the view to a node |
| `view` | Zooming and fitting |
| `highlight` | Fading highlights in and out, on hover and selection |

Pass it to `GraphView` as `motion`. If the reader's system asks for reduced motion, cytocausal skips these animations for you.

## Accessibility

`lightTheme` and `darkTheme` are tested for contrast: text reaches 4.5:1 and graph colours reach 3:1 against the background. Custom themes aren't checked, so test yours.
