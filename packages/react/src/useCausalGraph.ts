"use client";
import type { FeedbackLoop } from "@cytocausal/core";
import {
  fitNodes,
  focusNode,
  highlightCausalNeighbours,
  highlightLoop,
  keepLabelsReadable,
  resolveMotion,
  zoomBy,
  type CausalMotion,
} from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";
import { useCallback, useEffect, useRef, useState } from "react";

export interface CausalGraphOptions {
  /** How many nodes can be selected at once, such as 2 to compare them. */
  maxSelected?: number;
  /** Select and highlight nodes on tap and hover. Turn off to control selection yourself. */
  selectable?: boolean;
  /** Keep labels from overlapping. Needs `managedLabels` in `createCausalStyle`. */
  readableLabels?: boolean;
  /** Zoom level for `focus`. Without it, the zoom doesn't change. */
  focusZoom?: number;
  motion?: CausalMotion;
}

/**
 * Selection, hover, loop highlighting and view controls for one graph. Pass `attach` to the
 * `onReady` prop of `GraphView`. A loop takes priority over selected nodes, and selected nodes
 * over the hovered one.
 */
export function useCausalGraph({
  maxSelected = 1,
  selectable = true,
  readableLabels = false,
  focusZoom,
  motion,
}: CausalGraphOptions = {}) {
  const cy = useRef<Core | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeLoop, setActiveLoop] = useState<FeedbackLoop | null>(null);

  const latest = useRef({ selected, hovered, activeLoop });

  const applyHighlight = useCallback(() => {
    const instance = cy.current;
    if (!instance || instance.destroyed()) return;
    const { selected, hovered, activeLoop } = latest.current;
    if (activeLoop) {
      highlightCausalNeighbours(instance, []);
      highlightLoop(instance, activeLoop);
    } else {
      highlightLoop(instance, null);
      highlightCausalNeighbours(instance, selected.length ? selected : hovered ? [hovered] : []);
    }
  }, []);

  useEffect(() => {
    latest.current = { selected, hovered, activeLoop };
    applyHighlight();
  }, [selected, hovered, activeLoop, applyHighlight]);

  const add = useCallback(
    (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id].slice(-maxSelected)),
    [maxSelected],
  );

  /** Selects a node, or deselects it if it's already selected. */
  const toggle = useCallback(
    (id: string) => {
      setActiveLoop(null);
      setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : add(ids, id)));
    },
    [add],
  );

  /** Selects a node and moves the view to it. */
  const focus = useCallback(
    (id: string) => {
      setActiveLoop(null);
      setSelected((ids) => add(ids, id));
      if (cy.current) {
        focusNode(cy.current, id, { zoom: focusZoom ?? cy.current.zoom(), motion });
      }
    },
    [add, focusZoom, motion],
  );

  /** Clears the selection and any highlighted loop. */
  const clear = useCallback(() => {
    setSelected([]);
    setActiveLoop(null);
  }, []);

  /** Keeps only the selected nodes that pass a test, such as after filtering the graph. */
  const keepSelected = useCallback((test: (id: string) => boolean) => {
    setSelected((ids) => ids.filter(test));
  }, []);

  /** Highlights a loop, or removes the highlight if it's already showing. */
  const toggleLoop = useCallback((loop: FeedbackLoop) => {
    setActiveLoop((current) => (current === loop ? null : loop));
  }, []);

  const fit = useCallback(() => {
    if (cy.current) fitNodes(cy.current, resolveMotion(motion).view);
  }, [motion]);

  const zoomIn = useCallback(() => {
    if (cy.current) zoomBy(cy.current, 1.5, resolveMotion(motion).view);
  }, [motion]);

  const zoomOut = useCallback(() => {
    if (cy.current) zoomBy(cy.current, 1 / 1.5, resolveMotion(motion).view);
  }, [motion]);

  /** Connects a Cytoscape instance. A rebuilt graph brings a new one. */
  const attach = useCallback(
    (instance: Core) => {
      cy.current = instance;
      if (readableLabels) {
        fitNodes(instance);
        keepLabelsReadable(instance);
      }
      if (selectable) {
        instance.on("tap", "node", (event) => toggle(event.target.id()));
        instance.on("tap", (event) => {
          if (event.target === instance) clear();
        });
        instance.on("mouseover", "node", (event) => setHovered(event.target.id()));
        instance.on("mouseout", "node", () => setHovered(null));
      }
      applyHighlight();
    },
    [applyHighlight, clear, readableLabels, selectable, toggle],
  );

  return {
    attach,
    /** The connected Cytoscape instance, for anything this hook doesn't cover. */
    cy,
    selected,
    hovered,
    activeLoop,
    toggle,
    focus,
    clear,
    keepSelected,
    toggleLoop,
    fit,
    zoomIn,
    zoomOut,
  };
}
