// GridGuardian — shared UI class tokens for a restrained bright-cream
// operations console. Warm paper surfaces, soft neumorphic embossing, hairline
// taupe borders, compact density. Skeuomorphic, but quiet — no glow, no neon.

export const PANEL =
  "rounded-xl2 border border-app-border/70 bg-app-panel shadow-neu";

export const PANEL_PADDED =
  "rounded-xl2 border border-app-border/70 bg-app-panel p-4 shadow-neu";

export const PANEL_HEAD =
  "flex items-center justify-between gap-3 border-b border-app-borderDim px-4 py-2.5";

export const SECTION_TITLE =
  "text-[11px] font-semibold uppercase tracking-wider text-app-label etched";

export const MUTED = "text-xs text-app-muted";

export const TH =
  "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-app-label";

export const TD = "px-3 py-2 align-middle";

export const TR =
  "border-b border-app-borderDim transition-colors last:border-0 hover:bg-app-hover";

export const TABLE_WRAP = "overflow-x-auto";

export const INPUT =
  "rounded-lg border border-app-border/80 bg-app-input px-2.5 py-1.5 text-sm text-app-text placeholder-app-label shadow-neu-inset outline-none transition-shadow focus:border-app-accent focus:ring-1 focus:ring-app-accent/40";

export const SELECT = `${INPUT} pr-7`;

// Buttons: visibly distinct states in BOTH themes —
//   default  → subtle raised control surface (L4 input tone)
//   hover    → elevation + restrained accent hint
//   pressed  → inset effect
//   disabled → reduced contrast
export const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-app-border/70 bg-app-input px-3 py-1.5 text-sm font-medium text-app-text shadow-neu-sm transition-all duration-150 hover:border-app-accent/50 hover:shadow-neu active:shadow-neu-press disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";

export const BTN_PRIMARY = `${BTN} border-app-accent/60 bg-app-accent text-white shadow-neu-accent hover:border-app-accent hover:bg-app-accentDim active:shadow-neu-accent-inset`;

export const BTN_SECONDARY = `${BTN} bg-app-panel hover:bg-app-hover`;

export const BTN_DANGER = `${BTN} bg-app-panel text-critical hover:bg-critical/10`;

export const LINK =
  "font-medium text-app-accent underline-offset-2 hover:text-app-accentDim hover:underline";

export const MONO = "mono tabular";

export const ROW_KEY = "text-[11px] uppercase tracking-wider text-app-label";