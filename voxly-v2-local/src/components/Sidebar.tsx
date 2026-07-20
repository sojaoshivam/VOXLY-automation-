"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Video,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Mic,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsCollapsed(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Podcast Studio", href: "/studio", icon: Mic },
    { name: "Movie Studio", href: "/movie-studio", icon: Clapperboard },
    { name: "Projects", href: "/projects", icon: FolderOpen },
  ];

  return (
    <aside
      className={`relative border-r border-[#121222]/80 bg-[#07070c]/90 backdrop-blur-xl flex flex-col p-4 shrink-0 transition-all ${
        isCollapsed ? "w-20" : "w-56"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-6 -right-3 h-6 w-6 rounded-full border border-[#1f1f3a] bg-[#0c0c16] text-zinc-400 flex items-center justify-center z-50"
      >
        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <div className="mt-8 space-y-6">
        {!isCollapsed && (
          <h1 className="text-sm font-extrabold text-white px-2">Voxly Local</h1>
        )}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/projects" && pathname.startsWith("/projects/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  isActive
                    ? item.href === "/movie-studio"
                      ? "bg-amber-950/40 text-white border-l-2 border-amber-500"
                      : "bg-violet-950/40 text-white border-l-2 border-violet-500"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
