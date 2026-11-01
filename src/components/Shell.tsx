import {
  Activity,
  Award,
  BookOpen,
  Briefcase,
  ExternalLink,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useGetUnreadConversationsQuery } from "../api/adminApi";
import { CLIENT_URL } from "../app/config";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { useIdleLogout } from "../features/auth/useIdleLogout";
import { logout } from "../features/auth/thunks";
import {
  closeSidebar,
  toggleSidebar,
  toggleSidebarCollapsed,
} from "../features/ui/uiSlice";
import { cn } from "../lib/cn";
import { ConnectionPill } from "./ConnectionPill";
import { ToggleSwitch } from "./ToggleSwitch";
import { StatusPill } from "./Badges";

const groups = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/inbox", label: "Inbox", icon: Mail, badge: true },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/projects", label: "Projects", icon: Sparkles },
      { to: "/hero", label: "Hero", icon: Gauge },
      { to: "/about", label: "About", icon: UserRound },
      { to: "/experience", label: "Experience", icon: Briefcase },
      { to: "/skills", label: "Skills", icon: Wrench },
      { to: "/security", label: "Security", icon: ShieldCheck },
      { to: "/credentials", label: "Credentials", icon: GraduationCap },
      { to: "/resume", label: "Resume", icon: BookOpen },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/settings", label: "Settings", icon: SettingsIcon },
      { to: "/account", label: "Account", icon: Award },
      { to: "/activity", label: "Activity", icon: Activity },
    ],
  },
];

const pageTitle = (pathname: string): string => {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/inbox")) return "Inbox";
  if (pathname === "/projects/new") return "New project";
  if (pathname.startsWith("/projects/")) return "Edit project";
  const match = groups
    .flatMap((group) => group.items)
    .find((item) => item.to !== "/" && pathname.startsWith(item.to));
  return match?.label ?? "Admin";
};

export const Shell = ({ children }: { children: ReactNode }) => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { sidebarOpen, sidebarCollapsed } = useAppSelector((state) => state.ui);
  const user = useAppSelector((state) => state.auth.user);
  const { data: unread } = useGetUnreadConversationsQuery(undefined, {
    pollingInterval: 60_000,
    refetchOnFocus: true,
  });
  const { warning, staySignedIn } = useIdleLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    dispatch(closeSidebar());
  }, [location.pathname, dispatch]);

  useEffect(() => {
    const count = unread?.unread ?? 0;
    document.title =
      count > 0
        ? `(${count}) Inbox · Adetoye Daniel Kehinde`
        : `Projects · Adetoye Daniel Kehinde`;
  }, [unread?.unread]);

  return (      <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-on-page)]">
      <button
        type="button"
        aria-label="Close navigation"
        className={cn(
          "fixed inset-0 z-30 bg-black/60 lg:hidden",
          sidebarOpen ? "block" : "hidden",
        )}
        onClick={() => dispatch(closeSidebar())}
      />        <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--color-line)] bg-[var(--color-section)] transition-transform lg:translate-x-0",
          sidebarCollapsed ? "w-[220px] lg:w-[76px]" : "w-[250px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-15 items-center gap-2 border-b border-[var(--color-line)] px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] font-grotesk text-xs font-bold text-[var(--color-accent)]">
            AD
          </div>
          <div className={cn("min-w-0", sidebarCollapsed && "lg:hidden")}>
            <div className="truncate font-grotesk text-sm font-semibold text-[var(--color-on-card)]">
              Admin
            </div>
            <div className="truncate font-mono text-[10px] text-[var(--color-soft)]">
              portfolio_software
            </div>
          </div>
          <button
            type="button"
            className="ml-auto rounded-md p-1 text-[var(--color-soft)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] lg:hidden"
            aria-label="Close sidebar"
            onClick={() => dispatch(closeSidebar())}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.label}>
              <div
                className={cn(
                  "mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-soft)]",
                  sidebarCollapsed && "lg:hidden",
                )}
              >
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      title={item.label}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40"
                            : "text-[var(--color-soft)] hover:bg-[var(--color-accent-soft)]/40 hover:text-[var(--color-accent)]",
                          sidebarCollapsed && "lg:justify-center",
                        )
                      }
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>
                        {item.label}
                      </span>
                      {"badge" in item && item.badge && unread && unread.unread > 0 ? (
                        <span className="ml-auto rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          {unread.unread > 99 ? "99+" : unread.unread}
                        </span>
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="hidden items-center gap-2 border-t border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-soft)] hover:text-[var(--color-accent)] lg:flex"
          onClick={() => dispatch(toggleSidebarCollapsed())}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={15} />
          <span className={cn(sidebarCollapsed && "hidden")}>Collapse</span>
        </button>
      </aside>

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding]",
          sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[250px]",
        )}
      >
        <header className="sticky top-0 z-20 flex h-15 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-card)] px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--color-soft)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] lg:hidden"
            aria-label="Open navigation"
            onClick={() => dispatch(toggleSidebar())}
          >
            <Menu size={20} />
          </button>
          <div className="hidden w-8 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] font-grotesk text-xs font-bold text-[var(--color-accent)]">
              AD
            </div>
          </div>
          <h1 className="font-grotesk text-base font-semibold text-[var(--color-on-card)]">
            {pageTitle(location.pathname)}
          </h1>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ConnectionPill />
            <a
              href={CLIENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white sm:inline-flex"
            >
              View site <ExternalLink size={13} />
            </a>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-2 py-1 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white font-mono text-[10px] text-[var(--color-accent)]">
                  {user?.email.slice(0, 1).toUpperCase() ?? "A"}
                </span>
                <span className="hidden max-w-[150px] truncate sm:block">
                  {user?.email ?? "Account"}
                </span>
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[0_20px_60px_-20px_rgba(13,148,136,0.35)]"
                >
                  <NavLink
                    to="/account"
                    role="menuitem"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-on-card)] hover:bg-[var(--color-accent-soft)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    <UserRound size={15} /> Account & 2FA
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--color-red)] hover:bg-[var(--color-red-soft)]"
                    onClick={() => void dispatch(logout())}
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        <footer className="border-t border-[var(--color-line)] px-4 py-4 font-mono text-[10px] text-[var(--color-soft)] sm:px-6">
          Private admin · single owner account · session data never persisted
        </footer>
      </div>

      {warning ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Session about to expire"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        >
          <div className="window-card w-full max-w-sm p-6 text-center">
            <h2 className="font-grotesk text-base font-semibold text-[var(--color-on-card)]">
              Still there?
            </h2>
            <p className="mt-2 text-sm text-[var(--color-soft)]">
              You will be signed out in about two minutes because of inactivity.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-5 w-full"
              onClick={() => void staySignedIn()}
            >
              Stay signed in
            </button>
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full"
              onClick={() => void dispatch(logout())}
            >
              Sign out now
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
};
