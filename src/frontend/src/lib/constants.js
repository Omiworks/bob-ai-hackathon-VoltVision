// GridGuardian — severity/category styling + UI-level explanatory labels.
//
// RECOMMENDED_ACTION / STATUS_* are presentation-layer text only: they map a
// precomputed category to an operator-friendly instruction. They are NOT
// computed by any Phase 1-5 algorithm and must not be mistaken for a backend
// value.

export const CATEGORIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

// Muted dark-theme category styling — subtle tinted rings, no glow.
export const CATEGORY_STYLES = {
  CRITICAL: {
    badge: "bg-critical/10 text-critical ring-critical/40",
    bar: "bg-critical",
    text: "text-critical",
    dot: "bg-critical",
    hex: "#c8574f",
  },
  HIGH: {
    badge: "bg-high/10 text-high ring-high/40",
    bar: "bg-high",
    text: "text-high",
    dot: "bg-high",
    hex: "#cf8f3f",
  },
  MEDIUM: {
    badge: "bg-medium/10 text-medium ring-medium/40",
    bar: "bg-medium",
    text: "text-medium",
    dot: "bg-medium",
    hex: "#c0a33d",
  },
  LOW: {
    badge: "bg-low/10 text-low ring-low/40",
    bar: "bg-low",
    text: "text-low",
    dot: "bg-low",
    hex: "#4f9e6b",
  },
};

// Informational / system state (not a risk level).
export const INFO_STYLE = {
  badge: "bg-app-accent/10 text-app-accent ring-app-accent/40",
  bar: "bg-app-accent",
  text: "text-app-accent",
  dot: "bg-app-accent",
  hex: "#4f84c3",
};

// UI explanation of what each maintenance-priority category means in the
// field. Pure presentation text — see the header comment.
export const RECOMMENDED_ACTION = {
  CRITICAL: "Dispatch crew immediately",
  HIGH: "Assign crew; inspect within 24h",
  MEDIUM: "Schedule inspection soon",
  LOW: "Routine monitoring only",
};

// Operational status labels derived (client-side) from priority category.
export const STATUS_BY_PRIORITY = {
  CRITICAL: "Attention required",
  HIGH: "Monitor closely",
  MEDIUM: "Scheduled",
  LOW: "Nominal",
};

// Operational status labels derived (client-side) from alert severity.
export const STATUS_BY_SEVERITY = {
  critical: "Open — action",
  high: "Open — assign",
  medium: "Open — review",
  low: "Monitoring",
};

export const ASSET_TYPE_LABELS = {
  transformer: "Transformer",
  substation: "Substation",
  feeder: "Feeder",
  capacitor_bank: "Capacitor bank",
  breaker: "Breaker",
  recloser: "Recloser",
  line: "Distribution line",
};

export const ASSET_TYPES = ["transformer", "feeder", "capacitor_bank", "breaker", "recloser"];

export const CRITICALITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"];

export function categoryStyle(category) {
  const key = String(category || "").toUpperCase();
  return CATEGORY_STYLES[key] || CATEGORY_STYLES.LOW;
}

export function assetTypeLabel(value) {
  return ASSET_TYPE_LABELS[String(value || "").toLowerCase()] || cap(value || "--");
}

export function cap(value) {
  return String(value).replace(/_/g, " ");
}

export const SEVERITY_FACTOR_LABELS = {
  customers_score: "Customer impact",
  facilities_score: "Critical facilities",
  zones_score: "Zones affected",
  stressed_score: "Stressed assets",
  depth_score: "Cascade depth",
};

export const FOOTER_NOTE =
  "Synthetic demonstration data — not real utility data. Simplified network-impact model, not an electrical power-flow simulator.";