import { parseDataset } from "./editing.ts";
import { causalFailure, type CausalResult } from "./document.ts";
import type { CausalDataset } from "./types.ts";
function assertJSONData(value: unknown, ancestors = new Set<object>()): void {
  if (!value || typeof value !== "object") {
    if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint" || typeof value === "number" && !Number.isFinite(value)) throw new Error("Dataset contains a value JSON cannot preserve.");
    return;
  }
  if (ancestors.has(value)) throw new Error("Dataset contains a cycle.");
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new Error("Dataset JSON requires plain objects and arrays.");
  ancestors.add(value); Object.values(value).forEach(item => assertJSONData(item, ancestors)); ancestors.delete(value);
}
/** Parse without modifying a document. Apply explicitly only after checking the result. */
export function parseCausalJSON(text: string): CausalResult<{ dataset: CausalDataset }> {
  try { return { ok: true, value: { dataset: parseDataset(JSON.parse(text)) } }; }
  catch (error) { return causalFailure("InvalidInput", error instanceof Error ? error.message : String(error)); }
}
export function serializeCausalJSON(dataset: CausalDataset): CausalResult<string> {
  try { assertJSONData(dataset); return { ok: true, value: JSON.stringify(parseDataset(dataset), null, 2) }; }
  catch (error) { return causalFailure("InvalidInput", error instanceof Error ? error.message : String(error)); }
}
