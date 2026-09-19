// GridGuardian theming — Light / Dark / System mode + user-selectable accent.
//
// The whole palette lives in CSS variables (see index.css). This module:
//   1. defines the available accents and their light/dark variants,
//   2. resolves "system" to the OS color-scheme preference,
//   3. applies the saved choice to CSS custom properties on <html>,
//   4. toggles the `dark` class used by Tailwind's class-based dark mode,
//   5. persists both choices in localStorage.
//
// Accent colors are muted and low-saturation to keep the professional,
// non-neon character of the operations console in both modes.

export const ACCENTS = {
  blue: {
    label: "Slate blue (default)",
    light: { accent: "#5B7E9E", accentDim: "#4A6A87" },
    dark: { accent: "#7FA3C4", accentDim: "#9BBAD6" },
  },
  pink: {
    label: "Rose",
    light: { accent: "#B05A78", accentDim: "#93455F" },
    dark: { accent: "#DE8AA6", accentDim: "#EDABC2" },
  },
  green: {
    label: "Sage green",
    light: { accent: "#5C8A64", accentDim: "#47724F" },
    dark: { accent: "#8CC498", accentDim: "#ABD9B4" },
  },
  teal: {
    label: "Teal",
    light: { accent: "#4E8A85", accentDim: "#3B706B" },
    dark: { accent: "#7FC0BA", accentDim: "#A3D7D2" },
  },
  purple: {
    label: "Violet",
    light: { accent: "#7A6399", accentDim: "#624D80" },
    dark: { accent: "#B29BCE", accentDim: "#C8B7DE" },
  },
  orange: {
    label: "Amber",
    light: { accent: "#B07D35", accentDim: "#8F6220" },
    dark: { accent: "#DBA55C", accentDim: "#E9C088" },
  },
  red: {
    label: "Brick red",
    light: { accent: "#AC5350", accentDim: "#8F403E" },
    dark: { accent: "#DD8380", accentDim: "#ECA3A1" },
  },
};

const MODE_KEY = "gg.theme.mode"; // "light" | "dark" | "system"
const ACCENT_KEY = "gg.theme.accent"; // key of ACCENTS

// Status category colors per mode. CSS variables handle most UI, but SVG
// attributes (recharts fills) cannot use var(), so charts read these resolved
// values instead. Keep in sync with index.css.
export const STATUS_COLORS = {
  light: { CRITICAL: "#B0524A", HIGH: "#B97F35", MEDIUM: "#A08A32", LOW: "#5A8F6D" },
  dark: { CRITICAL: "#D97A70", HIGH: "#DBA25A", MEDIUM: "#C7B15E", LOW: "#7FB892" },
};

// Low-alpha tints of the status colors for SVG fills (diagram boxes).
export const STATUS_TINTS = {
  light: { critical: "rgba(176,82,74,0.10)", high: "rgba(185,127,53,0.10)" },
  dark: { critical: "rgba(217,122,112,0.18)", high: "rgba(219,162,90,0.18)" },
};

export function statusColor(category, mode) {
  const key = String(category || "").toUpperCase();
  const set = STATUS_COLORS[mode] || STATUS_COLORS.light;
  return set[key] || set.LOW;
}

// Read the current resolved value of a theme CSS variable.
export function cssVar(name) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Fired whenever the theme changes so chart components can re-resolve colors.
export const THEME_EVENT = "gg-theme-change";
export function onThemeChange(handler) {
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbaFromHex(hex, alpha) {
  return `rgba(${hexToRgb(hex).join(",")},${alpha})`;
}

function osPrefersDark() {
  return typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Read the saved preference: "light" | "dark" | "system". Legacy values
// ("light"/"dark" from older builds) remain valid; missing defaults to light
// so the app always opens in the classic warm-cream look unless the user
// explicitly picks Dark or System from the theme button.
export function getStoredPreference() {
  const saved = localStorage.getItem(MODE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "light";
}

// Resolve the effective mode ("light" | "dark") after applying the OS
// preference when the user chose "system".
export function getMode() {
  const pref = getStoredPreference();
  if (pref === "system") return osPrefersDark() ? "dark" : "light";
  return pref;
}

export function getAccentKey() {
  const saved = localStorage.getItem(ACCENT_KEY);
  return saved && ACCENTS[saved] ? saved : "blue";
}

// Apply mode + accent to <html>. Safe to call repeatedly.
export function applyTheme(mode, accentKey) {
  const accent = ACCENTS[accentKey] || ACCENTS.blue;
  const root = document.documentElement;

  root.classList.toggle("dark", mode === "dark");

  const v = mode === "dark" ? accent.dark : accent.light;
  root.style.setProperty("--gg-accent", v.accent);
  root.style.setProperty("--gg-accentDim", v.accentDim);
  root.style.setProperty("--gg-accentBg", rgbaFromHex(v.accent, mode === "dark" ? 0.16 : 0.12));
  root.style.setProperty("--gg-accentRing", rgbaFromHex(v.accent, mode === "dark" ? 0.45 : 0.4));
}

// Convenience: read saved values, apply them, return them.
export function initTheme() {
  const pref = getStoredPreference();
  const accentKey = getAccentKey();
  applyTheme(getMode(), accentKey);
  watchSystemTheme();
  return { mode: getMode(), accentKey, preference: pref };
}

// Keep "system" mode live: re-apply when the OS switches between light/dark.
let systemWatcherInstalled = false;
export function watchSystemTheme() {
  if (systemWatcherInstalled || typeof window === "undefined") return;
  if (!window.matchMedia) return;
  systemWatcherInstalled = true;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getStoredPreference() === "system") {
      applyTheme(getMode(), getAccentKey());
      window.dispatchEvent(new Event(THEME_EVENT));
    }
  };
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange); // older Safari
}

export function setMode(preference) {
  if (!["light", "dark", "system"].includes(preference)) return;
  localStorage.setItem(MODE_KEY, preference);
  applyTheme(getMode(), getAccentKey());
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function setAccent(accentKey) {
  if (!ACCENTS[accentKey]) return;
  localStorage.setItem(ACCENT_KEY, accentKey);
  applyTheme(getMode(), accentKey);
  window.dispatchEvent(new Event(THEME_EVENT));
}

// Small helper so accents stay in sync with category status colors, which are
// switched by index.css (light/dark variants) rather than this module.
export function accentSwatch(accentKey, mode) {
  const a = ACCENTS[accentKey];
  return a ? (mode === "dark" ? a.dark.accent : a.light.accent) : "#5B7E9E";
}
