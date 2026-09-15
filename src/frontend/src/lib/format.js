// GridGuardian AI — formatting and class helpers used across the UI.

export function num(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function pct(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return `${num(n, digits)}%`;
}

export function int(value) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("en-US");
}

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function cap(value) {
  return value == null ? "--" : String(value).replace(/_/g, " ");
}