"use client";
import dynamic from "next/dynamic";

// Graphs need the DOM, so the app only renders in the browser
export const AppLoader = dynamic(() => import("@/components/App").then((module) => module.App), {
  ssr: false,
  loading: () => <p>Loading…</p>,
});
