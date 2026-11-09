import type { Collection, Core, SingularElementArgument } from "cytoscape";

const NODE_STYLES = ["opacity", "background-color", "border-color"];
const LINK_STYLES = ["opacity", "line-color", "target-arrow-color"];
const ALL_STYLES = [...new Set([...NODE_STYLES, ...LINK_STYLES])].join(" ");

const read = (ele: SingularElementArgument) =>
  Object.fromEntries(
    (ele.isNode() ? NODE_STYLES : LINK_STYLES).map((name) => [name, String(ele.style(name))]),
  );

/**
 * Ends any fade right away. Call this before stopping animations some other way: Cytoscape
 * skips `complete` on a stopped animation, which would leave a fading element stuck part way.
 */
export function settleStyles(cy: Core) {
  const fading: Collection | undefined = cy.scratch("causalFades");
  if (!fading) return;
  fading.stop(true, false);
  fading.removeStyle(ALL_STYLES);
  cy.removeScratch("causalFades");
}

/**
 * Applies a change to the graph's classes, easing elements to their new look. Each fade starts
 * from what's on screen, so it can reverse half way. Cytoscape's own style transitions can't:
 * they finish the old fade first, then jump.
 */
export function easeStyles(cy: Core, change: () => void, duration: number) {
  if (duration === 0) {
    settleStyles(cy);
    cy.batch(change);
    return;
  }

  const elements = cy.elements();
  const before = new Map(elements.map((ele) => [ele.id(), read(ele)]));
  settleStyles(cy);
  cy.batch(change);

  const fading: SingularElementArgument[] = [];
  const starts: Record<string, string>[] = [];
  const ends: Record<string, string>[] = [];
  elements.forEach((ele) => {
    const start = before.get(ele.id())!;
    const end = read(ele);
    const changed = Object.keys(end).filter((name) => end[name] !== start[name]);
    if (changed.length === 0) return;
    fading.push(ele);
    starts.push(Object.fromEntries(changed.map((name) => [name, start[name]])));
    ends.push(Object.fromEntries(changed.map((name) => [name, end[name]])));
  });
  if (fading.length === 0) return;

  const collection = cy.collection(fading);
  cy.scratch("causalFades", collection);
  cy.batch(() => fading.forEach((ele, index) => ele.style(starts[index])));
  fading.forEach((ele, index) => {
    ele.animate(
      { style: ends[index] },
      {
        duration,
        easing: "ease-out",
        queue: false,
        complete: () => ele.removeStyle(Object.keys(ends[index]).join(" ")),
      },
    );
  });
}
