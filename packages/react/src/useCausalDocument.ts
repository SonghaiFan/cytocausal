"use client";
import { createCausalDocument, type CausalDataset, type CausalDocument, type CausalDocumentState } from "@cytocausal/core";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Creates one document for this mount. Persistence belongs to the caller. */
export function useCausalDocument({ initialDataset, onChange, idFactory, historyLimit }: {
  initialDataset: CausalDataset;
  onChange?: (dataset: CausalDataset) => void;
  idFactory?: (kind: "node" | "edge") => string;
  historyLimit?: number;
}): CausalDocument {
  const [document] = useState(() => createCausalDocument(initialDataset, { idFactory, historyLimit }));
  const latest = useRef(onChange); latest.current = onChange;
  useEffect(() => document.subscribe(() => {
    const state = document.getState();
    if (state.change !== "load") latest.current?.(structuredClone(state.dataset));
  }), [document]);
  return document;
}
const noSubscribe = () => () => {};
const emptySnapshot = () => null;
/** Subscribes without creating a second dataset or history. */
export function useCausalDocumentState(document: CausalDocument): CausalDocumentState;
export function useCausalDocumentState(document?: CausalDocument): CausalDocumentState | null;
export function useCausalDocumentState(document?: CausalDocument) {
  return useSyncExternalStore(document?.subscribe ?? noSubscribe, document?.getState ?? emptySnapshot, document?.getState ?? emptySnapshot);
}
