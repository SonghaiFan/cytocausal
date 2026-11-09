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

  test(`${theme.name}: lines that stand alone stand out from the background`, () => {
    for (const mark of ["link", "focus", "cause", "conflict"] as const) {
      assert.ok(contrast(colors[mark], colors.background) >= 3, mark);
    }
  });

  test(`${theme.name}: labels stay readable on every fill`, () => {
    const fills = ["node", "cause", "effect", "added", "conflict", "clarification"] as const;
    for (const fill of fills) {
      assert.ok(contrast(textOn(colors[fill]), colors[fill]) >= 4.5, fill);
    }
    for (const badge of ["reinforcing", "balancing"] as const) {
      assert.ok(contrast(colors.nodeText, colors[badge]) >= 4.5, badge);
    }
  });

  test(`${theme.name}: causes and effects are told apart`, () => {
    assert.notEqual(colors.cause, colors.effect);
    assert.notEqual(colors.reinforcing, colors.balancing);
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
  for (const name of [".dimmed", ".focus", ".cause", ".effect", ".cause-link", ".effect-link", ".route-node", ".route-link", ".contributor-hidden"]) {
    assert.ok(selectors.includes(name), name);
  }
});

test("app rules come before the interaction states", () => {
  const rules = createCausalStyle(lightTheme, {
    baseRules: [{ selector: "edge.app", style: {} }] as never,
  }) as unknown as Rule[];
  const index = (selector: string) => rules.findIndex((rule) => rule.selector === selector);
  assert.ok(index("edge.app") > index("edge"));
  assert.ok(index("edge.app") < index("edge.route-link"));
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
  assert.equal(style("edge.route-link").width, undefined);
  assert.equal((createCausalStyle(lightTheme) as unknown as Rule[]).find((rule) => rule.selector === "edge.route-link")!.style.width, 3);
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
  const focus = rules.find(({ selector }) => selector === "node.focus")!.style;
  assert.equal(atZoomOne(focus["border-width"]), 3);
  assert.match(String(focus["border-width"]), /^mapData\(zoomScale/);
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
