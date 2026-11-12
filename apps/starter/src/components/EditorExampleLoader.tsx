"use client";
import dynamic from "next/dynamic";
export const EditorExampleLoader = dynamic(
  () => import("./EditorExample").then(module => module.EditorExamples),
  { ssr: false, loading: () => <p>Opening editor…</p> },
);
