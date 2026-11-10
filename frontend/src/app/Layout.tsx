import { useEffect, useState } from "react";
import {
  NavLink,
  Link,
  Outlet,
  useNavigate,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  CloudOff,
  Download,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  useAuth,
  useConfig,
  useOnline,
  useToast,
  useLiveUpdates,
} from "./context";
import { Logo, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { syncDrafts } from "../lib/offline";
import { syncSensorQueue } from "../lib/sensorQueue";
import type { Notification, Role } from "../types";
export function Protected({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner text="Restoring your session…" />;
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
export function Layout() {
  const { user, logout } = useAuth();
  const client = useQueryClient();
  const { data: config } = useConfig();
  const online = useOnline();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: androidDownload } = useQuery({
    queryKey: ["android-download"],
    enabled: !Capacitor.isNativePlatform(),
    queryFn: async () => {
      const response = await fetch("/download/build.json", { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return null;
      return response.json() as Promise<{ applicationId?: string }>;
    },
    retry: false,
    staleTime: 60000,
  });
  useLiveUpdates();
  useEffect(() => {
    if (online && user) {
      void syncDrafts(user.id)
        .then((r) => {
          if (r.length) {
            toast(
              `${r.length} saved report${r.length === 1 ? "" : "s"} synced.`,
            );
            void client.invalidateQueries();
          }
        })
        .catch(() => {});
      void syncSensorQueue(user.id);
    }
  }, [online, user?.id]);
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Notification[]>("/notifications"),
    enabled: !!user,
    refetchInterval: 60000,
  });
  const staff =
    user?.role === "MUNICIPAL_OFFICER" || user?.role === "SUPER_ADMIN";
  const unread = notifications.filter((n) => !n.isRead).length;
  const links = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Overview" },
    { to: "/map", icon: Map, label: "Live hazard map" },
    { to: "/my-reports", icon: ClipboardList, label: "My reports" },
    { to: "/monitor", icon: Activity, label: "Road monitoring" },
    { to: "/rewards", icon: Trophy, label: "Community rewards" },
    { to: "/notifications", icon: Bell, label: "Notifications", count: unread },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={"sidebar " + (open ? "open" : "")}>
        <div className="sidebar-brand">
          <Logo light />
          <button
            className="mobile-only icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          <span className="city-avatar">
            <Map size={20} />
          </span>
          <div>
            <strong>Ludhiana</strong>
            <small>Community workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">YOUR WORKSPACE</div>
        <nav>
          {links.map(({ to, icon: Icon, label, count }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              <Icon size={19} />
              <span>{label}</span>
              {!!count && <b className="nav-count">{count}</b>}
            </NavLink>
          ))}
          {staff && (
            <>
              <div className="nav-caption">CITY OPERATIONS</div>
              <NavLink to="/municipal" onClick={() => setOpen(false)}>
                <ShieldCheck size={19} />
                Municipal dashboard
              </NavLink>
              <NavLink to="/analytics" onClick={() => setOpen(false)}>
                <ChartNoAxesCombined size={19} />
                Road insights
              </NavLink>
            </>
          )}
          {user?.role === "SUPER_ADMIN" && (
            <NavLink to="/admin" onClick={() => setOpen(false)}>
              <Users size={19} />
              Administration
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-callout">
            <Sparkles size={20} />
            <h3>
              Small reports.
              <br />
              Safer journeys.
            </h3>
            <p>Your next report could make someone’s way home safer.</p>
            <Link to="/report">
              Make a difference <ArrowUpRight size={16} />
            </Link>
          </div>
          {androidDownload?.applicationId === "in.roadsaathi.app" && (
            <a href="/download/">
              <Download size={18} />
              Get Android app
            </a>
          )}
          <NavLink to={user ? "/settings" : "/login"}>
            <Settings size={18} />
            {user ? "Settings" : "Sign in"}
          </NavLink>
          {user && (
            <button
              onClick={async () => {
                try {
                  await logout();
                  navigate("/login");
                } catch (e) {
                  toast((e as Error).message, true);
                }
              }}
            >
              <LogOut size={18} />
              Sign out
            </button>
          )}
          <div className="sidebar-user">
            <span className="avatar">{user?.name.charAt(0) || "G"}</span>
            <div>
              <strong>{user?.name || "Guest"}</strong>
              <small>{staff ? "City team" : "Citizen contributor"}</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="row">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>RoadSaathi AI</strong>
            </span>
          </div>
          <div className="row">
            <span className="city-pill">
              <span className="live-dot" /> Ludhiana
            </span>
            <Link
              className="notification-button"
              to="/notifications"
              aria-label={`Notifications, ${unread} unread`}
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </Link>
            <span className="avatar small">{user?.name.charAt(0) || "G"}</span>
          </div>
        </header>
        {config?.demoMode && (
          <div className="demo-banner">
            <span>DEMO WORKSPACE</span> Sample reports are illustrations, not
            live municipal records. Your submissions are saved separately.
          </div>
        )}
        {!online && (
          <div className="offline-banner">
            <CloudOff size={16} />
            You’re offline. Save reports to your outbox and sync when you
            reconnect.
          </div>
        )}
        <main id="main-content" className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Made for safer journeys.</span>
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/about">About RoadSaathi</Link>
            <span>Use only when safely stopped.</span>
          </div>
        </footer>
      </div>
      <nav className="mobile-nav">
        <NavLink to="/dashboard">
          <LayoutDashboard size={20} />
          Home
        </NavLink>
        <NavLink to="/map">
          <Map size={20} />
          Map
        </NavLink>
        <NavLink to="/report" className="mobile-report">
          <Plus size={22} />
          Report
        </NavLink>
        <NavLink to="/my-reports">
          <ClipboardList size={20} />
          Reports
        </NavLink>
        <NavLink to="/monitor">
          <Activity size={20} />
          Monitor
        </NavLink>
      </nav>
    </div>
  );
}
