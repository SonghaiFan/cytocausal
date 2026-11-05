"use client";
import dynamic from "next/dynamic";

// Cytoscape needs the DOM, so the app only renders in the browser
export const AppLoader = dynamic(
  () => import("@/components/ExplorerApp").then((module) => module.ExplorerApp),
  { ssr: false, loading: () => <p className="p-4">Loading…</p> },
);
