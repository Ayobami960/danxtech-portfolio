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

  // Unread chat count in the tab title, so it is visible from another tab.
  useEffect(() => {
    const count = unread?.unread ?? 0;
    document.title =
      count > 0
        ? `(${count}) Inbox · Adetoye Daniel Kehinde`
        : "Admin · Adetoye Daniel Kehinde";
  }, [unread?.unread]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-[#e6edf7]">
      <button
        type="button"
        aria-label="Close navigation"
        className={cn(
          "fixed inset-0 z-30 bg-black/60 lg:hidden",
          sidebarOpen ? "block" : "hidden",
        )}
        onClick={() => dispatch(closeSidebar())}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/5 bg-[#0e1528] transition-transform lg:translate-x-0",
          sidebarCollapsed ? "w-[220px] lg:w-[76px]" : "w-[250px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/5 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/10 font-grotesk text-xs font-bold text-[#3b82f6]">
            AD
          </div>
          <div className={cn("min-w-0", sidebarCollapsed && "lg:hidden")}>
            <div className="truncate font-grotesk text-sm font-semibold text-white">
              Admin
            </div>
            <div className="truncate font-mono text-[10px] text-[#5f7189]">
              portfolio_software
            </div>
          </div>
          <button
            type="button"
            className="ml-auto rounded-md p-1 text-[#7c8fa6] hover:bg-white/5 hover:text-white lg:hidden"
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
                  "mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#4d5f77]",
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
                            ? "bg-[#3b82f6]/15 text-white ring-1 ring-[#3b82f6]/25"
                            : "text-[#8fa1b8] hover:bg-white/5 hover:text-white",
                          sidebarCollapsed && "lg:justify-center",
                        )
                      }
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>
                        {item.label}
                      </span>
                      {"badge" in item && item.badge && unread && unread.unread > 0 ? (
                        <span className="ml-auto rounded-full bg-[#3b82f6] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
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
          className="hidden items-center gap-2 border-t border-white/5 px-4 py-3 text-xs text-[#7c8fa6] hover:text-white lg:flex"
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
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/5 bg-[#0a0f1e]/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-md p-1.5 text-[#9db0c6] hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Open navigation"
            onClick={() => dispatch(toggleSidebar())}
          >
            <Menu size={20} />
          </button>
          <h1 className="font-grotesk text-base font-semibold text-white">
            {pageTitle(location.pathname)}
          </h1>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ConnectionPill />
            <a
              href={CLIENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[#9db0c6] hover:border-[#3b82f6]/40 hover:text-white sm:inline-flex"
            >
              View site <ExternalLink size={13} />
            </a>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-[#cbd8e8] hover:border-[#3b82f6]/40"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3b82f6]/20 font-mono text-[10px] text-[#93c5fd]">
                  {user?.email.slice(0, 1).toUpperCase() ?? "A"}
                </span>
                <span className="hidden max-w-[150px] truncate sm:block">
                  {user?.email ?? "Account"}
                </span>
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#131c35] shadow-2xl"
                >
                  <NavLink
                    to="/account"
                    role="menuitem"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#cbd8e8] hover:bg-white/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    <UserRound size={15} /> Account & 2FA
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/10"
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

        <footer className="border-t border-white/5 px-4 py-4 font-mono text-[10px] text-[#4d5f77] sm:px-6">
          Private admin · single owner account · session data never persisted
        </footer>
      </div>

      {warning ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Session about to expire"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="window-card w-full max-w-sm p-6 text-center">
            <h2 className="font-grotesk text-lg font-semibold text-white">
              Still there?
            </h2>
            <p className="mt-2 text-sm text-[#9db0c6]">
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
