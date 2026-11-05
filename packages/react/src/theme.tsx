"use client";
import { darkTheme, lightTheme, themeVariables, type CausalTheme } from "@cytocausal/cytoscape";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export type ColorScheme = "light" | "dark";

const query = "(prefers-color-scheme: dark)";

/** Follows the system's colour scheme until the reader chooses one. */
export function useColorScheme() {
  const [system, setSystem] = useState<ColorScheme>(() =>
    window.matchMedia(query).matches ? "dark" : "light",
  );
  const [chosen, setChosen] = useState<ColorScheme | null>(null);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return { scheme: chosen ?? system, setScheme: setChosen };
}

export const themeForScheme = (scheme: ColorScheme) => (scheme === "dark" ? darkTheme : lightTheme);

/** Applies a theme to everything inside it through --cc-* CSS variables. */
export function CausalRoot({
  theme,
  className,
  children,
}: {
  theme: CausalTheme;
  className?: string;
  children: ReactNode;
}) {
  const style = {
    ...themeVariables(theme),
    background: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.fontFamily,
  } as CSSProperties;
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
