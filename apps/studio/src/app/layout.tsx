import type { ReactNode } from "react";
import "@cytocausal/react/styles.css";
import "./globals.css";
export const metadata = { title: "cytocausal Studio — draw a causal graph", description: "Create causal graphs, trace relationships and explore feedback. Stored in your browser, exportable as JSON." };
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
