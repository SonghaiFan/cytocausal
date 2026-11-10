import assert from "node:assert/strict";
import test from "node:test";
import { wrappedTextSize } from "../src/text-size.ts";

const measure = (text: string) => text.length * 3;
test("pill measurement preserves explicit lines and wraps words", () => {
  assert.deepEqual(wrappedTextSize("one\ntwo", 6, 50, measure), { width: 9, height: 12 });
  assert.deepEqual(wrappedTextSize("one two three", 6, 25, measure), { width: 24, height: 12 });
});
test("unbreakable text can exceed max width and empty pills still have dimensions", () => {
  assert.deepEqual(wrappedTextSize("abcdefghij", 6, 10, measure), { width: 30, height: 6 });
  assert.deepEqual(wrappedTextSize("", 6, 50, measure), { width: 1, height: 6 });
});
