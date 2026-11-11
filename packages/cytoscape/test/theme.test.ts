import assert from "node:assert/strict";
import test from "node:test";
import { arrowLength, createCausalStyle } from "../src/style.ts";
import { toElements } from "../src/elements.ts";
import { darkTheme, lightTheme, mix, textOn, themeVariables } from "../src/theme.ts";

type Rule = { selector: string; style: Record<string, unknown> };

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

/** HSL saturation and hue of a six-digit hex colour. */
const hsl = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const lightness = (max + min) / 2;
  const delta = max - min;
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let degrees = 0;
  if (delta > 0) {
    if (max === r) degrees = 60 * (((g - b) / delta) % 6);
    else if (max === g) degrees = 60 * ((b - r) / delta + 2);
    else degrees = 60 * ((r - g) / delta + 4);
  }
  return { saturation: sat, hue: (degrees + 360) % 360 };
};
const saturation = (hex: string) => hsl(hex).saturation;
const hue = (hex: string) => hsl(hex).hue;
/** How far apart two hues are on the colour wheel, in degrees. */
const hueGap = (a: string, b: string) => {
  const gap = Math.abs(hue(a) - hue(b)) % 360;
  return Math.min(gap, 360 - gap);
};

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

for (const theme of [lightTheme, darkTheme]) {
  const { colors } = theme;

  test(`${theme.name}: text meets WCAG AA`, () => {
    for (const surface of [colors.background, colors.surface]) {
      assert.ok(contrast(colors.text, surface) >= 4.5, "text");
      assert.ok(contrast(colors.mutedText, surface) >= 4.5, "muted text");
    }
    assert.ok(contrast(colors.nodeText, colors.node) >= 4.5, "text on a node");
  });

  test(`${theme.name}: marks stand out from the background`, () => {
    for (const mark of ["link", "ink"] as const) {
      assert.ok(contrast(colors[mark], colors.background) >= 3, mark);
    }
    assert.ok(contrast(colors.ink, colors.background) >= 4.5, "ink reads as text");
  });

  test(`${theme.name}: labels stay readable on every fill`, () => {
    for (const fill of ["node", "accent", "ink"] as const) {
      assert.ok(contrast(textOn(colors[fill]), colors[fill]) >= 4.5, fill);
    }
  });

  test(`${theme.name}: hue marks only what was chosen, and changes`, () => {
    const { accent, added, removed, ...neutrals } = colors;
    for (const [name, value] of Object.entries(neutrals)) {
      assert.ok(saturation(value) < 0.12, `${name} ${value} should be neutral`);
    }
    for (const value of [accent, added, removed]) {
      assert.ok(saturation(value) > 0.5, `${value} is a clear hue`);
    }
    // Added and removed sit on opposite sides of the wheel, and apart from the accent
    assert.ok(hueGap(added, removed) > 120, "added and removed");
    assert.ok(hueGap(accent, added) > 60, "accent and added");
    assert.ok(hueGap(accent, removed) > 20, "accent and removed");
  });

  test(`${theme.name}: changes stand out and keep their labels readable`, () => {
    for (const change of ["added", "removed"] as const) {
      assert.ok(contrast(colors[change], colors.background) >= 3, change);
      assert.ok(contrast(textOn(colors[change]), colors[change]) >= 4.5, `text on ${change}`);
    }
  });
}

test("theme variables use kebab case", () => {
  const variables = themeVariables(lightTheme);
  assert.equal(variables["--cc-muted-text"], lightTheme.colors.mutedText);
  assert.equal(variables["--cc-background"], lightTheme.colors.background);
});

test("the stylesheet covers every state interactions set", () => {
  const rules = createCausalStyle(lightTheme) as unknown as Rule[];
  const selectors = rules.map(({ selector }) => selector).join(" ");
  for (const name of [".dimmed", ".focus", ".cause", ".effect", ".cause-link", ".effect-link", ".route-node", ".route-link", ".contributor-hidden", ".diff-added", ".diff-removed", ".diff-changed", ".diff-flipped"]) {
    assert.ok(selectors.includes(name), name);
  }
});

test("app rules come before the interaction states", () => {
  const rules = createCausalStyle(lightTheme, {
    baseRules: [{ selector: "edge.app", style: {} }] as never,
  }) as unknown as Rule[];
  const index = (selector: string) => rules.findIndex((rule) => rule.selector === selector);
  const route = rules.findIndex((rule) => rule.selector.includes("edge.route-link"));
  assert.ok(index("edge.app") > index("edge"));
  assert.ok(index("edge.app") < route);
});

test("only managed labels hide by default", () => {
  const nodeRule = (options: object) =>
    (createCausalStyle(lightTheme, options) as unknown as Rule[]).find(
      ({ selector }) => selector === "node",
    )!.style;
  assert.equal(nodeRule({}).label, "data(label)");
  assert.equal(nodeRule({ node: "dot", managedLabels: true }).label, undefined);
  assert.equal(nodeRule({ node: "dot", sizeByScore: true }).width, "mapData(score, 0, 1, 5, 24)");
});

test("support can set link width without highlights overriding it", () => {
  const rules = createCausalStyle(lightTheme, { weightBySupport: true }) as unknown as Rule[];
  const style = (selector: string) => rules.find((rule) => rule.selector === selector)!.style;
  assert.equal(style("edge").width, "mapData(supportShare, 0, 1, 1.5, 7)");
  assert.equal(rules.find((rule) => rule.selector.includes("edge.route-link"))!.style.width, undefined);
  // Highlights don't touch width with or without support, so width only ever means a quantity
  assert.equal((createCausalStyle(lightTheme) as unknown as Rule[]).find((rule) => rule.selector.includes("edge.route-link"))!.style.width, undefined);
});

test("support share starts at zero for claims nobody shares", () => {
  const link = (id: string, people: string[]) => ({
    id,
    source: "a",
    target: "b",
    evidence: people.map((contributor) => ({ contributor })),
  });
  const shares = (edges: ReturnType<typeof link>[]) =>
    toElements({ id: "s", nodes: [{ id: "a", label: "a" }, { id: "b", label: "b" }], edges }).edges.map(
      ({ data }) => [data.support, data.supportShare],
    );
  assert.deepEqual(shares([link("1", ["p"]), link("2", ["q"])]), [[1, 0], [1, 0]]);
  assert.deepEqual(shares([link("1", ["p"]), link("2", ["p", "q", "r"]), link("3", [])]), [[1, 0], [3, 1], [0, 0]]);
});

test("managed arrows map to a scale Cytoscape accepts", () => {
  const rules = createCausalStyle(lightTheme, { node: "dot", link: "straight", managedLabels: true }) as unknown as Rule[];
  const scale = String(rules.find((rule) => rule.selector === "edge")!.style["arrow-scale"]);
  // arrow-scale must be above 0, so a mapping that starts at 0 would be dropped
  assert.match(scale, /^mapData\(zoomScale, 0, 4, 0\.001, [\d.]+\)$/);
});

const edgeRule = (options: object) =>
  (createCausalStyle(lightTheme, options) as unknown as Rule[]).find(({ selector }) => selector === "edge")!.style;

/** Reads a mapping as Cytoscape would at zoom 1, where `zoomScale` is 1. */
const atZoomOne = (value: unknown) => {
  const mapping = String(value).match(/^mapData\(zoomScale, 0, ([\d.]+), ([\d.]+), ([\d.]+)\)$/);
  if (!mapping) return Number(value);
  const [, range, low, high] = mapping.map(Number);
  return low + (high - low) / range;
};

test("arrow size follows Cytoscape's renderer", () => {
  // Cytoscape's default 3 px line with scale 1 draws an 8.7 px arrow
  assert.equal(arrowLength(3, 1).toFixed(1), "8.7");
  // Thin lines don't make arrows smaller, only the scale does
  assert.equal(arrowLength(0.5, 1), arrowLength(2, 1));
  assert.ok(arrowLength(7, 1) > arrowLength(3, 1));
});

test("arrows are about three times their line, in every link style", () => {
  for (const options of [{ link: "straight" }, { link: "straight", managedLabels: true }, { link: "flowing" }]) {
    const style = edgeRule(options);
    const width = atZoomOne(style.width);
    const arrow = arrowLength(width, atZoomOne(style["arrow-scale"]));
    assert.ok(arrow >= 5.5 && arrow <= 7.5, `${JSON.stringify(options)}: ${arrow}`);
    assert.ok(arrow / width >= 3, `${JSON.stringify(options)}: arrow ${arrow}, line ${width}`);
  }
});

test("receding links are pale but opaque", () => {
  const style = edgeRule({ link: "straight" });
  assert.equal(style.opacity, undefined);
  assert.equal(style["line-color"], mix(lightTheme.colors.link, lightTheme.colors.background, 0.35));
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mix("#123456", "#abcdef", 1), "#123456");
});

test("managed borders keep their size on screen", () => {
  const rules = createCausalStyle(lightTheme, { node: "dot", managedLabels: true }) as unknown as Rule[];
  const cursor = rules.find(({ selector }) => selector === "node.keyboard-cursor")!.style;
  assert.equal(atZoomOne(cursor["outline-width"]), 3);
  assert.match(String(cursor["outline-width"]), /^mapData\(zoomScale/);
});

test("each zoom mode sizes marks from its own factor", () => {
  const style = (zoom: string) =>
    createCausalStyle(lightTheme, { node: "dot", link: "straight", sizeByScore: true, zoom } as never) as unknown as Rule[];
  const rule = (zoom: string, selector: string) => style(zoom).find((item) => item.selector === selector)!.style;

  assert.equal(rule("magnify", "edge").width, 1);
  assert.match(String(rule("spread", "edge").width), /^mapData\(zoomScale, /);
  assert.match(String(rule("balanced", "edge").width), /^mapData\(zoomRoot, /);
  assert.equal(rule("magnify", "node").width, "mapData(score, 0, 1, 5, 24)");

  // Dots combine centrality and zoom: at zoom 2, a spread dot is half as big in model units
  const size = (zoom: string, data: Record<string, number>) =>
    (rule(zoom, "node").width as (ele: { data: (key: string) => number }) => number)({ data: (key) => data[key] });
  assert.equal(size("spread", { score: 1, zoomScale: 0.5, zoomRoot: Math.SQRT1_2 }), 12);
  assert.equal(size("balanced", { score: 0, zoomScale: 0.25, zoomRoot: 0.5 }), 2.5);
});

test("managed labels default to spread, and weights follow the zoom mode", () => {
  const managed = createCausalStyle(lightTheme, { node: "dot", link: "straight", managedLabels: true }) as unknown as Rule[];
  assert.match(String(managed.find((rule) => rule.selector === "edge")!.style.width), /zoomScale/);

  const weighted = (createCausalStyle(lightTheme, { weightBySupport: true, zoom: "spread" }) as unknown as Rule[])
    .find((rule) => rule.selector === "edge")!.style.width as (ele: { data: (key: string) => number }) => number;
  assert.equal(weighted({ data: (key) => ({ supportShare: 1, zoomScale: 0.5 })[key]! }), 3.5);
});

test("each visual channel keeps one meaning", () => {
  for (const options of [{}, { node: "dot", link: "straight", managedLabels: true }, { weightBySupport: true }]) {
    const rules = createCausalStyle(lightTheme, options as never) as unknown as Rule[];
    const states = rules.filter(({ selector }) => /\.(focus|cause|effect|route|diff|dimmed)/.test(selector));
    for (const { selector, style } of states) {
      // Width is for quantities, outlines for an app's own categories, dashes for polarity
      for (const channel of ["width", "border-width", "border-style", "line-style"]) {
        assert.equal(style[channel], undefined, `${selector} sets ${channel}`);
      }
    }
    const dashed = rules.filter(({ style }) => style["line-style"] !== undefined).map(({ selector }) => selector);
    assert.deepEqual(dashed, ['edge[polarity="negative"]']);
    // A border is kept for the node a long press locked the menu on, in ink, never the accent
    const held = rules.find(({ selector }) => selector === "node.menu-held")!;
    assert.ok(held.style["border-width"]);
    assert.equal(held.style["border-color"], lightTheme.colors.ink);
  }
});

test("the accent only ever fills, and a selection outranks changes", () => {
  for (const theme of [lightTheme, darkTheme]) {
    const rules = createCausalStyle(theme) as unknown as Rule[];
    // A line in the accent would read as a change, as a warm line did when it looked removed
    for (const { selector, style } of rules) {
      for (const channel of ["line-color", "target-arrow-color", "border-color"]) {
        assert.notEqual(style[channel], theme.colors.accent, `${selector} uses the accent for ${channel}`);
      }
    }
    const index = (selector: string) => rules.findIndex((rule) => rule.selector.includes(selector));
    for (const change of ["node.diff-added", "edge.diff-removed", "edge.diff-changed"]) {
      assert.ok(index("node.focus") > index(change), `the selection comes after ${change}`);
      assert.ok(index("edge.route-link") > index(change), `a chosen route comes after ${change}`);
    }
  }
});

test("a loop found from another of its nodes is the same route", async () => {
  const { sameRoute } = await import("../src/highlight.ts");
  const fromA = { nodes: ["a", "b", "c"], edges: ["ab", "bc", "ca"] };
  const fromB = { nodes: ["b", "c", "a"], edges: ["bc", "ca", "ab"] };
  assert.ok(sameRoute(fromA, fromB));
  assert.ok(!sameRoute(fromA, { nodes: ["a", "b"], edges: ["ab", "ba"] }));
  assert.ok(!sameRoute(fromA, null));
});
