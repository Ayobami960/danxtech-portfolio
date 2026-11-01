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
import { CLIENT_URL } from "../utils/config";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useIdleLogout } from "../features/auth/useIdleLogout";
import { logout } from "../features/auth/thunks";
import {
  closeSidebar,
  toggleSidebar,
  toggleSidebarCollapsed,
} from "../features/ui/uiSlice";
import { cn } from "../lib/cn";
import { ConnectionPill } from "./ConnectionPill";
import { OfflineNotice } from "./OfflineNotice";

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
    <div className="min-h-screen">
      <button
        type="button"
        aria-label="Close navigation"
        className={cn("scrim lg:hidden", sidebarOpen ? "block" : "hidden")}
        onClick={() => dispatch(closeSidebar())}
      />
      <aside
        className={cn(
          "side fixed inset-y-0 left-0 z-40 flex flex-col transition-transform lg:translate-x-0",
          sidebarCollapsed ? "w-[220px] lg:w-[76px]" : "w-[250px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="side-head">
          <div className="brand-mark">AD</div>
          <div className={cn("min-w-0", sidebarCollapsed && "lg:hidden")}>
            <div className="brand-name truncate">Admin</div>
            <div className="brand-sub truncate">portfolio_software</div>
          </div>
          <button
            type="button"
            className="tb-ghost ml-auto lg:hidden"
            aria-label="Close sidebar"
            onClick={() => dispatch(closeSidebar())}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.label}>
              <div className={cn("nav-label", sidebarCollapsed && "lg:hidden")}>
                {group.label}
              </div>
              <div className="grid gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      title={item.label}
                      className={cn("nav-link", sidebarCollapsed && "lg:justify-center")}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>
                        {item.label}
                      </span>
                      {"badge" in item && item.badge && unread && unread.unread > 0 ? (
                        <span className={cn("nav-badge", sidebarCollapsed && "lg:hidden")}>
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
          className="collapse-btn"
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
        <OfflineNotice />
        <header className="topbar">
          <button
            type="button"
            className="tb-ghost lg:hidden"
            aria-label="Open navigation"
            onClick={() => dispatch(toggleSidebar())}
          >
            <Menu size={20} />
          </button>
          <p className="topbar-title">{pageTitle(location.pathname)}</p>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ConnectionPill />
            <a
              href={CLIENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="tb-btn tb-site"
            >
              View site <ExternalLink size={13} />
            </a>
            <div className="relative">
              <button
                type="button"
                className="tb-btn"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="avatar">
                  {user?.email.slice(0, 1).toUpperCase() ?? "A"}
                </span>
                <span className="hidden max-w-[150px] truncate sm:block">
                  {user?.email ?? "Account"}
                </span>
              </button>
              {menuOpen ? (
                <div role="menu" className="menu">
                  <NavLink
                    to="/account"
                    role="menuitem"
                    className="menu-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    <UserRound size={15} /> Account & 2FA
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item bad"
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

        <footer className="foot">
          Private admin · single owner account · session data never persisted
        </footer>
      </div>

      {warning ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Session about to expire"
          className="ov"
        >
          <div className="dialog text-center">
            <h2>Still there?</h2>
            <p className="d">You will be signed out in about two minutes because of inactivity.</p>
            <button
              type="button"
              className="btn btn-primary mt-5 w-full"
              onClick={() => void staySignedIn()}
            >
              Stay signed in
            </button>
            <button
              type="button"
              className="btn mt-2 w-full"
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