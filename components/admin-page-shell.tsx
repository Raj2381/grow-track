"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { LogoutControl } from "@/components/logout-control";
import { RoleBadge } from "@/components/forecast/role-badge";
import { usePathname } from "next/navigation";
import { GraduationCap, LogOut, Menu, ShieldOff } from "lucide-react";
import { decide } from "@/lib/access";
import { useCurrentUser } from "@/lib/data/hooks";
import { NAV_BY_ROLE, navRoleFor, type NavLink } from "@/lib/admin-nav";
import { homeFor } from "@/lib/supabase/config";

type AdminPageShellProps = {
  title: string;
  children: ReactNode;
};

function navClass(active: boolean) {
  return `flex min-h-[43px] items-center gap-3 rounded-md px-3 text-[12px] transition-colors ${
    active ? "bg-[#315c47] font-semibold text-white" : "text-[#c2d2c7] hover:bg-white/10 hover:text-white"
  }`;
}

function NavGroup({ title, links, divider, pathname, onNavigate }: { title: string; links: NavLink[]; divider?: boolean; pathname: string; onNavigate: () => void }) {
  return (
    <>
      {divider && <div className="my-6 border-t border-white/10" />}
      <p className="mb-3 px-3 text-[10px] font-semibold tracking-[1.5px] text-[#9cb5a6]">{title}</p>
      <div className="space-y-1">
        {links.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link href={href} key={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`${navClass(active)} relative`}>
              {active && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#b5d7bd]" />}
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export function AdminPageShell({ title, children }: AdminPageShellProps) {
  const pathname = usePathname();
  const me = useCurrentUser();
  const nav = NAV_BY_ROLE[navRoleFor(pathname, me.data?.role)];
  const blocked = Boolean(me.data?.role) && decide(pathname, { role: me.data!.role, studentId: me.data!.studentId }).action === "redirect";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  function toggleNavigation() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setSidebarCollapsed((collapsed) => !collapsed);
    } else {
      setMobileMenuOpen((open) => !open);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7f3] text-[#252f28]">
      <div className="flex min-h-screen">
        <aside
          id="admin-sidebar"
          className={`fixed bottom-0 left-0 top-[66px] z-40 flex w-[252px] flex-col overflow-hidden bg-[#193f31] text-white transition-[transform,width,opacity] duration-200 lg:sticky lg:inset-y-0 lg:top-0 lg:h-screen lg:translate-x-0 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } ${
            sidebarCollapsed
              ? "lg:w-0 lg:opacity-0"
              : "lg:w-[252px] lg:opacity-100"
          }`}
        >
          <div className="flex h-[96px] items-center justify-between px-6">
            <Link
              href={nav.home}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25">
                <GraduationCap size={24} strokeWidth={1.7} />
              </span>
              <span>
                <span className="block text-[20px] font-semibold tracking-[-0.6px]">
                  GrowthTrack
                </span>
                <span className="mt-1 block text-[9px] font-semibold tracking-[1.5px] text-[#a7beb0]">
                  STUDENT SUCCESS PLATFORM
                </span>
              </span>
            </Link>
          </div>

          <nav className="flex-1 px-[18px] pt-7">
            <NavGroup title="WORKSPACE" links={nav.workspace} pathname={pathname} onNavigate={closeMenu} />
            {nav.forecast.length > 0 && <NavGroup title="FORECAST" links={nav.forecast} divider pathname={pathname} onNavigate={closeMenu} />}
            <NavGroup title="ADMINISTRATION" links={nav.account} divider pathname={pathname} onNavigate={closeMenu} />
          </nav>

          <div className="border-t border-white/10 p-5">
            <div className="flex items-center gap-3 rounded-md bg-white/[0.06] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d9e7dc] text-[12px] font-semibold text-[#234b38]">
                {(me.data?.displayName ?? nav.label).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold">{me.data?.displayName ?? nav.label}</p>
                <p className="truncate text-[10px] text-[#a8bfb0]">{nav.label}</p>
              </div>
            </div>
          </div>
        </aside>

        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="Close navigation backdrop"
            className="fixed bottom-0 left-0 right-0 top-[66px] z-10 bg-black/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[66px] items-center justify-between border-b border-[#e2e7df] bg-white px-4 sm:px-7 lg:px-9">
            <div className="flex items-center gap-3 text-[12px]">
              <button
                type="button"
                className="rounded-md border border-[#e2e7df] p-2 text-[#47564b]"
                onClick={toggleNavigation}
                aria-label="Toggle navigation"
                aria-controls="admin-sidebar"
                title="Show or hide navigation"
              >
                <Menu size={19} />
              </button>
              <span className="text-[#556057]">Workspace</span>
              <span className="text-[#c3c9c1]">/</span>
              <span className="font-semibold text-[#2b382e]">{title}</span>
            </div>
            <div className="flex items-center gap-3">
              <RoleBadge />
              <LogoutControl
                title="Logout"
                className="inline-flex items-center gap-2 rounded-md border border-[#dfe5dc] px-3 py-2 text-[11px] font-medium text-[#47564b] transition hover:bg-[#f5f7f4] hover:text-[#193f31]"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Logout</span>
              </LogoutControl>
            </div>
          </header>
          <main className="mx-auto max-w-[1580px] px-4 pb-10 pt-7 sm:px-7 lg:px-9">
            {blocked ? (
              <div role="alert" className="mx-auto mt-10 max-w-md rounded-md border border-[#e2e7df] bg-white p-8 text-center">
                <ShieldOff className="mx-auto text-[#8b6fb0]" size={28} aria-hidden="true" />
                <h1 className="mt-3 text-[18px] font-semibold text-[#252f28]">This page is not part of your workspace</h1>
                <p className="mt-2 text-[14px] leading-6 text-[#4b5563]">Your role does not include this area. Your own dashboard has everything you can open.</p>
                <Link href={homeFor(me.data!.role!)} className="mt-5 inline-block rounded-md bg-[#28684e] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1f5340]">Go to my dashboard</Link>
              </div>
            ) : children}
          </main>
        </div>
      </div>
    </div>
  );
}
