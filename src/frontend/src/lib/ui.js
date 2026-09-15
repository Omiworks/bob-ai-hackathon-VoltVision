// GridGuardian — shared UI class tokens for a restrained industrial
// operations console. Dark charcoal/slate surfaces, hairline gray-blue
// borders, flat panels, compact density. No glow, no gradients.

export const PANEL = "rounded border border-app-border bg-app-panel";

export const PANEL_PADDED = "rounded border border-app-border bg-app-panel p-4";

export const PANEL_HEAD =
  "flex items-center justify-between gap-3 border-b border-app-border px-4 py-2.5";

export const SECTION_TITLE =
  "text-[11px] font-semibold uppercase tracking-wider text-app-label";

export const MUTED = "text-xs text-app-muted";

export const TH =
  "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-app-label";

export const TD = "px-3 py-2 align-middle";

export const TR =
  "border-b border-app-borderDim transition-colors last:border-0 hover:bg-app-hover";

export const TABLE_WRAP = "overflow-x-auto";

export const INPUT =
  "rounded border border-app-border bg-app-bg px-2.5 py-1.5 text-sm text-app-text placeholder-app-label outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent/40";

export const SELECT = `${INPUT} pr-7`;

export const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export const BTN_PRIMARY = `${BTN} border-app-accent bg-app-accent text-white hover:bg-app-accentDim`;

export const BTN_SECONDARY = `${BTN} border-app-border bg-app-raised text-app-text hover:bg-app-hover`;

export const BTN_DANGER = `${BTN} border-critical/40 bg-transparent text-critical hover:bg-critical/10`;

export const LINK =
  "font-medium text-app-text underline-offset-2 hover:text-white hover:underline";

export const MONO = "mono tabular";

export const ROW_KEY = "text-[11px] uppercase tracking-wider text-app-label";