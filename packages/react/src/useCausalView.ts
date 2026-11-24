"use client";
import { useEffect, useMemo } from "react";
import { causalFailure, type CausalResult, type ElementIds } from "@cytocausal/core";
import { centerView, moveCamera, zoomBy, type Positions } from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";
import type { useCausalGraph } from "./useCausalGraph.ts";
export interface ViewControls { zoom?: boolean; pan?: boolean; boxSelection?: boolean; dragging?: boolean }
export interface CausalView {
  fit(options?: { target?: ElementIds; padding?: number; duration?: number }): CausalResult<void>;
  center(options?: { target?: ElementIds; point?: { x: number; y: number }; duration?: number }): CausalResult<void>;
  zoom(options: { factor: number; duration?: number }): CausalResult<void>;
  pan(options: { by: { x: number; y: number }; duration?: number }): CausalResult<void>;
  reset(): CausalResult<void>;
  positions(): CausalResult<Positions>;
  controls(patch: ViewControls): CausalResult<void>;
}
/** Camera and input control remain view-local, including across renderer replacement. */
export function useCausalView(graph: ReturnType<typeof useCausalGraph>) {
  const controller = useMemo(() => {
    let controls: ViewControls = {};
    const cameras = new WeakMap<Core, { zoom: number; pan: { x: number; y: number } }>();
    const applyControls = (cy: Core) => {
      if (controls.zoom !== undefined) cy.userZoomingEnabled(controls.zoom);
      if (controls.pan !== undefined) cy.userPanningEnabled(controls.pan);
      if (controls.boxSelection !== undefined) cy.boxSelectionEnabled(controls.boxSelection);
      if (controls.dragging !== undefined) controls.dragging ? cy.nodes().grabify() : cy.nodes().ungrabify();
    };
    const run = <T,>(fn: (cy: Core) => T): CausalResult<T> => {
      const cy = graph.cy.current;
      if (!cy || cy.destroyed()) return causalFailure("ViewUnavailable", "The graph is not ready.");
      if (!cameras.has(cy)) cameras.set(cy, { zoom: cy.zoom(), pan: { ...cy.pan() } });
      try { return { ok: true, value: fn(cy) }; }
      catch (error) { return causalFailure("InvalidInput", error instanceof Error ? error.message : String(error)); }
    };
    const duration = (value = 0) => { if (!Number.isFinite(value) || value < 0) throw new Error("Duration must be finite and nonnegative."); return value; };
    const point = (value: { x: number; y: number }) => { if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) throw new Error("Coordinates must be finite."); return value; };
    const target = (cy: Core, ids?: ElementIds) => {
      if (!ids) return cy.elements(":visible");
      const names = [...(ids.nodes ?? []), ...(ids.edges ?? [])];
      if (names.some(id => cy.getElementById(id).empty())) throw new Error("The view target contains missing elements.");
      return cy.collection(names.map(id => cy.getElementById(id)[0]));
    };
    const api: CausalView = {
      fit: ({ target: ids, padding = 30, duration: ms } = {}) => run(cy => {
        const time = duration(ms);
        if (!Number.isFinite(padding) || padding < 0) throw new Error("Padding must be finite and nonnegative.");
        const elements = target(cy, ids); if (!elements.length) return;
        const box = elements.boundingBox({ includeLabels: false });
        const zoom = Math.max(cy.minZoom(), Math.min(cy.maxZoom(), Math.max(1, cy.width() - 2 * padding) / Math.max(1, box.w), Math.max(1, cy.height() - 2 * padding) / Math.max(1, box.h)));
        moveCamera(cy, { zoom, pan: { x: (cy.width() - zoom * (box.x1 + box.x2)) / 2, y: (cy.height() - zoom * (box.y1 + box.y2)) / 2 } }, time);
      }),
      center: ({ target: ids, point: position, duration: ms } = {}) => run(cy => {
        const time = duration(ms);
        if (position) centerView(cy, point(position), cy.zoom(), time);
        else { const elements = target(cy, ids); if (elements.length) { const box = elements.boundingBox({ includeLabels: false }); centerView(cy, { x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 }, cy.zoom(), time); } }
      }),
      zoom: ({ factor, duration: ms }) => run(cy => { const time = duration(ms); if (!Number.isFinite(factor) || factor <= 0) throw new Error("Zoom factor must be positive and finite."); zoomBy(cy, factor, time); }),
      pan: ({ by, duration: ms }) => run(cy => { const time = duration(ms); point(by); const pan = cy.pan(); moveCamera(cy, { zoom: cy.zoom(), pan: { x: pan.x + by.x, y: pan.y + by.y } }, time); }),
      reset: () => run(cy => { moveCamera(cy, cameras.get(cy)!); }),
      positions: () => run(cy => Object.fromEntries(cy.nodes().map(node => [node.id(), { ...node.position() }]))),
      controls: patch => run(cy => { if (Object.keys(patch).some(key => !["zoom", "pan", "boxSelection", "dragging"].includes(key)) || Object.values(patch).some(value => value !== undefined && typeof value !== "boolean")) throw new Error("Use boolean zoom, pan, boxSelection and dragging controls."); controls = { ...controls, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) }; applyControls(cy); }),
    };
    return { api, synchronize: () => { const cy = graph.cy.current; if (cy && !cy.destroyed()) applyControls(cy); } };
  }, [graph.cy]);
  useEffect(controller.synchronize, [controller, graph.instanceCount]);
  return { view: controller.api, applyViewControls: controller.synchronize };
}
