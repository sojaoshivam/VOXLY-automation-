"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Library,
  LogOut,
  PenSquare,
  Rocket,
  Settings,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/library", label: "Library", Icon: Library },
  { href: "/create", label: "Create / Publish", Icon: PenSquare },
  { href: "/profile", label: "Profile", Icon: User },
  { href: "/accounts", label: "Accounts", Icon: Users },
  { href: "/settings", label: "Settings", Icon: Settings },
];

const STORAGE_KEY = "voxly-sidebar-collapsed";

export default function SidebarLayout({ user, signOutAction, children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  const sidebarWidth = collapsed ? "4.5rem" : "16rem";

  return (
    <div className="min-h-screen">
      {!collapsed && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[#171717]/20 backdrop-blur-[1px] lg:hidden"
          onClick={toggleCollapsed}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--voxly-line)] bg-[var(--voxly-panel)] shadow-[4px_0_24px_rgba(23,23,23,0.04)] transition-[width,transform] duration-200",
          collapsed ? "w-[4.5rem]" : "w-64",
          !mounted && "w-64",
          collapsed && "max-lg:-translate-x-full max-lg:w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--voxly-line)] px-3">
          <Link href="/" className="flex min-w-0 items-center gap-3 overflow-hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--voxly-accent-soft)] text-[var(--voxly-accent)]">
              <Rocket className="h-4 w-4" />
            </span>
            {!collapsed && (
              <span className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--voxly-ink)]">
                Voxly
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--voxly-muted)] transition-colors hover:bg-[var(--voxly-canvas)] hover:text-[var(--voxly-ink)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--voxly-accent-soft)] text-[var(--voxly-accent)]"
                    : "text-[var(--voxly-muted)] hover:bg-[var(--voxly-canvas)] hover:text-[var(--voxly-ink)]",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--voxly-line)] p-3">
          {!collapsed && user && (
            <div className="mb-3 truncate px-2 text-xs text-[var(--voxly-muted)]">
              {user.name || user.email}
            </div>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--voxly-muted)] transition-colors hover:bg-[#fff0ed] hover:text-[var(--voxly-danger)]",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? "Sign out" : undefined}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </form>
        </div>
      </aside>

      <div
        className="transition-[padding-left] duration-200 max-lg:pl-0"
        style={{ paddingLeft: mounted ? sidebarWidth : "16rem" }}
      >
        <div className="sticky top-0 z-20 flex h-14 items-center border-b border-[var(--voxly-line)] bg-[var(--voxly-panel)] px-4 lg:hidden">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="rounded-lg border border-[var(--voxly-line)] px-3 py-1.5 text-sm font-semibold text-[var(--voxly-ink)]"
          >
            Menu
          </button>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
