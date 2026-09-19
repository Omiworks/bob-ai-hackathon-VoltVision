/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // Class-based dark mode: toggling `dark` on <html> switches every
  // app-* color, since each maps to a CSS variable that html.dark overrides.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        app: {
          // Every token points at a CSS variable so the entire palette can be
          // swapped at runtime (light/dark) without touching component code.
          bg: "var(--gg-bg)",
          sidebar: "var(--gg-sidebar)",
          header: "var(--gg-header)",
          main: "var(--gg-main)",
          panel: "var(--gg-panel)",
          raised: "var(--gg-raised)",
          table: "var(--gg-table)",
          hover: "var(--gg-hover)",
          input: "var(--gg-input)",
          border: "var(--gg-border)",
          borderDim: "var(--gg-borderDim)",
          text: "var(--gg-text)",
          muted: "var(--gg-muted)",
          label: "var(--gg-label)",
          accent: "var(--gg-accent)",
          accentDim: "var(--gg-accentDim)",
          accentBg: "var(--gg-accentBg)",
          accentRing: "var(--gg-accentRing)",
        },
        critical: "var(--gg-critical)",
        high: "var(--gg-high)",
        medium: "var(--gg-medium)",
        low: "var(--gg-low)",
      },
      boxShadow: {
        neu: "3px 3px 7px var(--gg-sh-outer), -3px -3px 7px var(--gg-sh-light)",
        "neu-sm": "2px 2px 4px var(--gg-sh-outer), -2px -2px 4px var(--gg-sh-light)",
        "neu-lg": "6px 6px 14px var(--gg-sh-outer-lg), -6px -6px 14px var(--gg-sh-light)",
        "neu-inset": "inset 2px 2px 5px var(--gg-sh-outer), inset -2px -2px 5px var(--gg-sh-light)",
        "neu-accent": "3px 3px 7px var(--gg-sh-outer), -3px -3px 7px var(--gg-sh-light)",
        "neu-accent-inset": "inset 2px 2px 5px var(--gg-sh-outer), inset -2px -2px 5px var(--gg-sh-light)",
        "neu-press": "inset 2px 2px 4px var(--gg-sh-outer), inset -2px -2px 4px var(--gg-sh-light)",
      },
    },
  },
  plugins: [],
};
