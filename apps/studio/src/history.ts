import type { CausalDataset } from "@cytocausal/core";

export interface Selection { nodes: string[]; link: string | null }
export interface DocumentState { dataset: CausalDataset; version: string; selection: Selection }
export interface History { present: DocumentState; past: DocumentState[]; future: DocumentState[]; revision: number }
export type HistoryAction =
  | { type: "restore"; document: DocumentState }
  | { type: "navigate"; document: DocumentState }
  | { type: "commit"; before: DocumentState; after: DocumentState }
  | { type: "undo" | "redo"; current: DocumentState };
export const unselected = (): Selection => ({ nodes: [], link: null });
export function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === "restore") return { present: action.document, past: [], future: [], revision: 0 };
  if (action.type === "navigate") return { ...state, present: action.document };
  if (action.type === "commit") {
    if (JSON.stringify(action.before.dataset) === JSON.stringify(action.after.dataset)) return state;
    return { present: action.after, past: [...state.past.slice(-49), action.before], future: [], revision: state.revision + 1 };
  }
  const source = action.type === "undo" ? state.past : state.future;
  if (!source.length) return state;
  return action.type === "undo"
    ? { present: source.at(-1)!, past: source.slice(0, -1), future: [...state.future, action.current], revision: state.revision + 1 }
    : { present: source.at(-1)!, past: [...state.past, action.current], future: source.slice(0, -1), revision: state.revision + 1 };
}
