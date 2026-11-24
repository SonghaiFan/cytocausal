import type { CausalDataset, CausalDocument, EditResult } from "@cytocausal/core";
export interface Selection { nodes: string[]; link: string | null }
export interface DocumentState { dataset: CausalDataset; version: string; selection: Selection }
export type EditorSession = Pick<DocumentState, "version" | "selection">;
export type HistoryAction =
  | { type: "restore"; document: DocumentState }
  | { type: "navigate"; document: DocumentState }
  | { type: "commit"; before: DocumentState; after: DocumentState }
  | { type: "undo" | "redo"; current: DocumentState };
export const unselected = (): Selection => ({ nodes: [], link: null });
/** UI checkpoints belong only to the editor that made them. Dataset history lives in Core. */
export function applyEditorAction(document: CausalDocument, editorId: string, action: HistoryAction): { result: EditResult; session?: EditorSession } {
  const session = (value: DocumentState): EditorSession => ({ version: value.version, selection: value.selection });
  if (action.type === "navigate") return { result: { ok: true, value: { changed: false, revision: document.getState().revision, value: undefined } }, session: session(action.document) };
  if (action.type === "restore") return { result: document.load(action.document.dataset), session: session(action.document) };
  if (action.type === "commit") return {
    result: document.replaceDataset(action.after.dataset, { checkpoint: { before: { editorId, session: session(action.before) }, after: { editorId, session: session(action.after) } } }),
    session: session(action.after),
  };
  const result = action.type === "undo" ? document.undo() : document.redo();
  const checkpoint = result.ok ? result.value.checkpoint as { editorId?: unknown; session?: EditorSession } | undefined : undefined;
  return { result, session: checkpoint?.editorId === editorId ? checkpoint.session : undefined };
}
