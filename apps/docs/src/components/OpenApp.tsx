import type { ReactNode } from "react";
import { appLinks } from "./app-links.ts";

/** A button that opens an example app. */
export function OpenApp({ app, children }: { app: keyof typeof appLinks; children: ReactNode }) {
  return (
    <a
      href={appLinks[app]}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 36,
        marginTop: "1rem",
        padding: "8px 15px",
        borderRadius: 10,
        background: "#fbbf24",
        color: "#000",
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {children} ↗
    </a>
  );
}
