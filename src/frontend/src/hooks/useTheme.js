import { useEffect, useState } from "react";
import { onThemeChange, cssVar, getMode } from "../lib/theme";

// Resolves CSS variables to concrete color strings and re-resolves whenever
// the theme changes. Needed because SVG attributes (recharts fills, strokes)
// cannot reference var() — they need actual color values.
//
// Usage: const [panel, border, accent] = useThemeColors("--gg-panel", "--gg-border", "--gg-accent");
export function useThemeColors(...names) {
  const [colors, setColors] = useState(() => names.map((n) => cssVar(n)));

  useEffect(() => {
    const resolve = () => setColors(names.map((n) => cssVar(n)));
    resolve();
    // Re-resolve when fonts/layout settle and whenever the theme changes.
    const t = setTimeout(resolve, 50);
    const off = onThemeChange(resolve);
    return () => {
      clearTimeout(t);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names.join("|")]);

  return colors;
}

// Returns the current effective mode ("light" | "dark") and re-renders on change.
export function useThemeMode() {
  const [mode, setModeState] = useState(() => getMode());

  useEffect(() => {
    const sync = () => setModeState(getMode());
    const off = onThemeChange(sync);
    return () => {
      off();
    };
  }, []);

  return mode;
}
