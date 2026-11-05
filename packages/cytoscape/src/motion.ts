import { defaultMotion, type CausalMotion } from "./theme.ts";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Applies the reader's system setting: durations are 0 if they prefer less motion. */
export function resolveMotion(motion: CausalMotion = defaultMotion): CausalMotion {
  return prefersReducedMotion() ? { fade: 0, move: 0, focus: 0, view: 0 } : motion;
}
