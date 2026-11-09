import assert from "node:assert/strict";
import test from "node:test";
import { createCausalStyle } from "../src/style.ts";
import { darkTheme, lightTheme, textOn, themeVariables } from "../src/theme.ts";

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
  for (const name of [".dimmed", ".focus", ".cause", ".effect", ".cause-link", ".effect-link", ".route-node", ".route-link"]) {
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
