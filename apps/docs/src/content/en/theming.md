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

## Line, arrow and text sizes

These defaults come from reading Cytoscape 3.31's renderer, not from guessing. A few of its rules aren't in its documentation, and they decide what looks right.

**Sizes are in model units.** Cytoscape's docs say sizes are "as specified at zoom 1". A 2 px line is 6 px wide at zoom 3. That suits a small diagram, which you look at whole. On a dense graph that people zoom into, lines, rings and text would swell, so `managedLabels` keeps them a constant size on screen instead.

**Arrows have a minimum size.** The renderer draws a triangle `0.3 × size` long and wide, where:

```
size = max((width × 13.37) ^ 0.9, 29) × arrow-scale
```

Below a line width of about 3, the arrow ignores the line and depends on `arrow-scale` alone. That's why thinning a line doesn't shrink its arrow. Cytoscape's own default, a 3 px line with scale 1, draws an 8.7 px arrow, about three times the line. `arrowLength(width, scale)` works this out for you.

**`<pos>-arrow-width` isn't the arrow's size.** It's the stroke width of a hollow arrow.

**Transparency costs twice.** When a link's `opacity` is below 1, the renderer first erases the area under each arrow, then draws it, and overlapping links get darker where they cross. Receding links are drawn in a pale opaque colour instead, made with `mix(color, background, amount)`. Only a highlight's dimming uses `opacity`.

**Clicks have a fixed reach.** A pointer counts as on a link within 8 screen pixels, or 24 on touch, at any zoom. So thin lines stay as easy to click as thick ones.

**Arrows need `straight` or `bezier`.** `haystack` is Cytoscape's fastest edge, but it can't draw a target arrow, which a causal link needs.

| | Line | Arrow | Ring on a selected node |
| :--- | :--- | :--- | :--- |
| Small diagrams (`flowing`) | 2 px | 7 px | 2 px |
| Dense graphs (`straight`) | 1 px, pale | 6 px | 3 px |
| Highlighted | 2 px, or 3 px for a route | Same as unhighlighted | Same |
| `weightBySupport` | 1.5 to 7 px | Grows with lines over 3 px | Same |

Labels drawn smaller than `min-zoomed-font-size` are skipped, as they can't be read and still cost time: 6 px for labels beside dots, and 3 px for the smaller text inside pills.

## Motion

The default palette is blue, yellow and black. Nodes are yellow, and labels switch between black and white to stay readable on each colour. `textOn(color)` picks between them for your own rules.

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
