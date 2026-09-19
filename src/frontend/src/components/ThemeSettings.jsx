import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun, Check } from "lucide-react";
import {
  ACCENTS,
  getMode,
  getStoredPreference,
  getAccentKey,
  setMode,
  setAccent,
  applyTheme,
  onThemeChange,
} from "../lib/theme";

// Navigation-bar theme control: a clearly visible Sun/Moon button that opens a
// small popover with Light / Dark / System, plus accent color selection.
// The current choice is visually obvious (accent treatment + check mark).
// Works globally: sets state in lib/theme.js, which toggles `dark` on <html>
// and rewrites the CSS-variable palette, so every surface follows instantly.

const MODE_OPTIONS = [
  { value: "light", label: "Light", hint: "Warm cream workspace", icon: Sun },
  { value: "dark", label: "Dark", hint: "Warm charcoal workspace", icon: Moon },
  { value: "system", label: "System", hint: "Follow OS setting", icon: Monitor },
];

export default function ThemeSettings() {
  const [open, setOpen] = useState(false);
  const [pref, setPrefState] = useState(() => getStoredPreference());
  const [accent, setAccentState] = useState(() => getAccentKey());
  const ref = useRef(null);

  // Keep <html> in sync on first mount (covers the OS-preference default).
  useEffect(() => {
    applyTheme(getMode(), accent);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow OS changes live while the popover is open in System mode.
  useEffect(() => {
    const off = onThemeChange(() => setPrefState(getStoredPreference()));
    return off;
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choosePref = (next) => {
    setMode(next);
    setPrefState(next);
  };

  const chooseAccent = (key) => {
    setAccent(key);
    setAccentState(key);
  };

  const effective = getMode();

  return (
    <div className="relative" ref={ref}>
      {/* Theme trigger — always visible in the header, no Settings needed */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-app-border/70 bg-app-input px-2.5 py-1.5 text-app-muted shadow-neu-sm transition-all duration-150 hover:text-app-text hover:shadow-neu active:shadow-neu-press"
        title="Theme & appearance"
        aria-label="Theme and appearance settings"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {pref === "system" ? (
          <Monitor className="h-4 w-4" />
        ) : pref === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        <span className="hidden text-[11px] font-semibold uppercase tracking-wider md:inline">
          {pref === "system" ? "System" : pref === "dark" ? "Dark" : "Light"}
        </span>
        <span
          className="h-2.5 w-2.5 rounded-full border border-white/70 shadow-sm"
          style={{ backgroundColor: "var(--gg-accent)" }}
          aria-hidden="true"
        />
      </button>

      {/* Theme popover */}
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-app-border/80 bg-app-panel p-2 shadow-neu-lg"
          role="menu"
          aria-label="Appearance"
        >
          <p className="px-2 pb-1 pt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-app-label">
            Appearance
          </p>

          {MODE_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
            const active = pref === value;
            return (
              <button
                key={value}
                onClick={() => choosePref(value)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all duration-150 ${
                  active
                    ? "border-app-accent/40 bg-app-accent/10 shadow-neu-inset"
                    : "border-transparent hover:bg-app-hover/60"
                }`}
                role="menuitemradio"
                aria-checked={active}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                    active
                      ? "border-app-accent/40 bg-app-accent/15 text-app-accent"
                      : "border-app-borderDim bg-app-raised text-app-muted"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1">
                  <span
                    className={`block text-xs font-semibold ${
                      active ? "text-app-accentDim" : "text-app-text"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="block text-[10px] text-app-label">{hint}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-app-accent" />}
              </button>
            );
          })}

          <div className="my-1.5 h-px bg-app-borderDim" />

          <p className="px-2 pb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-app-label">
            Accent color
          </p>
          <div className="grid grid-cols-7 gap-1 px-1 pb-1">
            {Object.entries(ACCENTS).map(([key, a]) => {
              const swatch = effective === "dark" ? a.dark.accent : a.light.accent;
              const active = key === accent;
              return (
                <button
                  key={key}
                  onClick={() => chooseAccent(key)}
                  title={a.label}
                  aria-label={`Accent: ${a.label}`}
                  className={`flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                    active ? "ring-2 ring-app-accent ring-offset-1 ring-offset-app-panel" : ""
                  }`}
                  role="menuitemradio"
                  aria-checked={active}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-white/60 shadow-sm"
                    style={{ backgroundColor: swatch }}
                  />
                </button>
              );
            })}
          </div>

          <p className="px-2 pb-0.5 pt-1.5 text-[9px] leading-relaxed text-app-label">
            Remembered on this device. System follows your OS appearance.
          </p>
        </div>
      )}
    </div>
  );
}
