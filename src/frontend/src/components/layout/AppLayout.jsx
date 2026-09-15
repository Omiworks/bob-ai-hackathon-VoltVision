import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  Bell,
  ClipboardList,
  Database,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Shield,
  X,
  Zap,
} from "lucide-react";
import { getHealth } from "../../services/api";
import { cx } from "../../lib/format";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/assets", label: "Asset Inventory", icon: Activity },
  { to: "/simulate", label: "What-If Simulation", icon: FlaskConical },
  { to: "/priority", label: "Maintenance Priority", icon: ClipboardList },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/brief", label: "AI Operations Brief", icon: Shield },
  { to: "/model", label: "Model & Data", icon: Database },
];

// Sidebar sections — subtle grouping, not cards.
const GROUPS = [
  { title: "Operations", items: NAV.filter((n) => ["/", "/assets", "/simulate", "/priority"].includes(n.to)) },
  { title: "Analytics & Records", items: NAV.filter((n) => ["/alerts", "/brief", "/model"].includes(n.to)) },
];

function pageTitle(pathname) {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/assets/")) return "Asset Detail";
  const match = NAV.find(
    (n) => n.to !== "/" && (pathname === n.to || pathname.startsWith(`${n.to}/`))
  );
  return match ? match.label : "Overview";
}

function fmt() {
  const d = new Date();
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [updated, setUpdated] = useState(fmt);
  const { pathname } = useLocation();

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
    setUpdated(fmt());
  }, []);

  useEffect(() => {
    setUpdated(fmt());
  }, [pathname]);

  const navItemClass = (isActive) =>
    cx(
      "flex items-center gap-3 rounded-[11px] border px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide transition-colors duration-150",
      isActive
        ? "border-app-accent/60 bg-app-accent/15 text-app-text hover:bg-app-accent/25"
        : "border-transparent font-medium text-app-muted hover:border-white/75 hover:bg-app-hover hover:text-app-text"
    );

  const sidebar = (
    <nav className="flex h-full flex-col px-2 py-3">
      <div className="flex items-center gap-3 px-3 pb-4 pt-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-accent">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-app-text">GRIDGUARDIAN</p>
          <p className="text-[9px] uppercase tracking-[0.2em] text-app-label">
            Distribution operations
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto py-3">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-2">
            <p className="px-4 pb-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-app-label">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => navItemClass(isActive)}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span className="leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-app-border px-3 py-3">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-muted">
          <span
            className={cx("h-1.5 w-1.5 rounded-full", health ? "bg-low" : "bg-medium")}
          />
          System online
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-app-label">
          Synthetic demo data
        </p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <aside className="fixed left-3 top-3 z-40 hidden h-[calc(100%-1.5rem)] w-[240px] rounded-xl border border-app-border bg-app-sidebar lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[240px] border-r border-app-border">{sidebar}</aside>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-3 rounded p-1 text-app-muted hover:text-app-text"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-app-border bg-app-header px-5 py-1.5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded p-1 text-app-muted hover:bg-app-hover lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-baseline gap-2">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-app-label sm:block">
                Grid Operations
              </p>
              <p className="text-[14px] font-semibold uppercase tracking-wide text-app-text">
                {pageTitle(pathname)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="hidden text-app-label xl:inline">
              Last updated: <span className="mono tabular text-app-muted">{updated}</span>
            </span>
            <span className="hidden text-app-label sm:inline">Synthetic data</span>
            <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-app-muted">
              <span
                className={cx("h-1.5 w-1.5 rounded-full", health ? "bg-low" : "bg-medium")}
              />
              System online
            </span>
          </div>
        </header>

        <main className="px-5 py-4">
          <Outlet />
        </main>

        <footer className="border-t border-app-border px-5 py-3 text-center">
          <p className="text-[11px] leading-relaxed text-app-label">
            Synthetic demonstration data — not real utility data. Simplified
            network-impact model, not an electrical power-flow simulator, and
            not to be used for real grid operational decisions.
          </p>
        </footer>
      </div>
    </div>
  );
}