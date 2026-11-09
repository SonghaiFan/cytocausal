"use client";
import type { Route } from "@cytocausal/cytoscape";
import type { ReactNode } from "react";
import { useOptionalCausal } from "./CausalProvider.tsx";

/** A row for a loop or path. It previews the route on hover, and keeps it on click. */
export function RouteButton({
  route,
  active,
  onToggle,
  onPreview,
  children,
}: {
  route: Route;
  active?: Route | null;
  onToggle?: (route: Route) => void;
  onPreview?: (route: Route | null) => void;
  children: ReactNode;
}) {
  const graph = useOptionalCausal()?.graph;
  const current = active ?? graph?.activeRoute;
  const toggle = onToggle ?? graph?.toggleRoute;
  const preview = onPreview ?? graph?.previewRoute;
  return (
    <button
      type="button"
      className="cc-row"
      aria-pressed={current === route}
      onClick={() => {
        // A click decides, so the row shouldn't keep showing a route that was just turned off
        preview?.(null);
        toggle?.(route);
      }}
      onMouseEnter={() => preview?.(route)}
      onMouseLeave={() => preview?.(null)}
      onFocus={() => preview?.(route)}
      onBlur={() => preview?.(null)}
    >
      {children}
    </button>
  );
}
