"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Settings2, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Brand } from "@/components/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_MODULES, moduleForPath, type AppModule } from "@/lib/modules";
import { trackLabel } from "@/lib/domain";
import { useAiStatus } from "@/lib/use-ai-status";
import { cn } from "@/lib/utils";

const SECTIONS = ["Overview", "Training", "Insights", "Account"] as const;

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function useSignOutAndLeave() {
  const { signOut } = useAuth();
  const router = useRouter();
  return async () => {
    await signOut();
    router.replace("/login");
  };
}

function Avatar({ size = "md" }: { size?: "sm" | "md" }) {
  const { user, profile } = useAuth();
  const photo = profile?.photoUrl ?? user?.photoURL;
  const cls = size === "sm" ? "size-7 text-[10px]" : "size-9 text-[11px]";
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element -- provider avatars come from several hosts
    return <img src={photo} alt="" referrerPolicy="no-referrer" className={cn(cls, "shrink-0 rounded-full border object-cover")} />;
  }
  return (
    <span className={cn(cls, "flex shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-soft font-mono font-semibold text-accent")}>
      {initials(profile?.name ?? user?.displayName, profile?.email ?? user?.email)}
    </span>
  );
}

function NavItem({ item, active, collapsed, onNavigate }: { item: AppModule; active: boolean; collapsed?: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg border px-2 py-1.5 text-[13px] font-medium transition-all",
        active
          ? "border-sidebar-border bg-sidebar-accent text-foreground shadow-panel"
          : "border-transparent text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
      )}
    >
      {active && <span aria-hidden className={cn("absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-current", item.text)} />}
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md ring-1 transition-colors",
          active ? item.chip : cn("bg-transparent ring-transparent", item.hover),
          !active && item.text
        )}
      >
        <Icon className="size-4" />
      </span>
      {!collapsed && item.label}
    </Link>
  );
}

function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const current = moduleForPath(pathname);
  const { user, profile } = useAuth();
  const leave = useSignOutAndLeave();

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href="/home" onClick={onNavigate} aria-label="Blackbox dashboard">
          {collapsed ? <span className="text-lg font-semibold text-accent">B</span> : <Brand />}
        </Link>
      </div>

      <nav className={cn("flex-1 overflow-y-auto py-4 scrollbar-thin", collapsed ? "px-2" : "px-3")} aria-label="Primary">
        {SECTIONS.map((section) => (
          <div key={section} className="mb-5">
            {!collapsed && <p className="eyebrow px-2 pb-2">{section}</p>}
            <ul className="space-y-1">
              {APP_MODULES.filter((m) => m.section === section).map((item) => (
                <li key={item.id}>
                  <NavItem item={item} active={current.id === item.id} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        <div className={cn("flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent p-2 shadow-panel", collapsed && "justify-center")}>
          <Avatar />
          {!collapsed && <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-4">{profile?.name ?? user?.displayName ?? "Candidate"}</p>
            <p className="truncate text-[11px] leading-4 text-muted-foreground">{trackLabel(profile?.targetRole)}</p>
          </div>}
        </div>
        {!collapsed && <button
          type="button"
          onClick={leave}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
        >
          <LogOut className="size-3.5" />
          Log out
        </button>}
      </div>
    </div>
  );
}

function AiStatusPill() {
  const status = useAiStatus();
  const dot =
    status.mode === "live"
      ? "bg-success"
      : status.mode === "checking"
        ? "bg-subtle"
        : status.mode === "no-internet"
          ? "bg-danger"
          : "bg-warning";
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground sm:inline-flex"
      title={status.detail}
    >
      <span className={cn("relative size-1.5 rounded-full", dot)}>
        {status.mode === "live" && <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />}
      </span>
      {status.label}
    </span>
  );
}

function AccountMenu() {
  const { user, profile } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const leave = useSignOutAndLeave();
  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border bg-card py-0.5 pl-0.5 pr-2 text-[13px] font-medium transition-colors hover:border-border-strong data-[state=open]:border-border-strong">
        <Avatar size="sm" />
        <span className="hidden max-w-32 truncate md:inline">{profile?.name?.split(" ")[0] ?? "Account"}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-[13px] font-medium">{profile?.name ?? user?.displayName ?? "Candidate"}</p>
          <p className="truncate text-[12px] text-muted-foreground">{profile?.email ?? user?.email ?? (user?.isDemo ? "Demo account" : "")}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings2 /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun /> : <Moon />} {isDark ? "Light theme" : "Dark theme"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void leave()}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Desktop top bar: where you are, AI status, settings and account. */
function TopBar({ current, sidebarCollapsed, onToggleSidebar }: { current: AppModule; sidebarCollapsed: boolean; onToggleSidebar: () => void }) {
  const Icon = current.icon;
  return (
    <div className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-4 border-b bg-background/85 px-6 backdrop-blur-md lg:flex lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:border-border-strong hover:text-accent"
          aria-label={sidebarCollapsed ? "Expand navigation" : "Minimize navigation"}
          title={sidebarCollapsed ? "Expand navigation" : "Minimize navigation"}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">{current.section}</span>
          <ChevronRight className="size-3.5 text-subtle" />
          <span className="flex items-center gap-2 font-medium">
            <span className={cn("flex size-6 items-center justify-center rounded-md ring-1", current.chip)}>
              <Icon className="size-3.5" />
            </span>
            {current.label}
          </span>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <AiStatusPill />
        <Link
          href="/settings"
          className="inline-flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          aria-label="Settings"
          title="Settings"
        >
          <Settings2 className="size-4" />
        </Link>
        <AccountMenu />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname() ?? "";
  const current = moduleForPath(pathname);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <RequireAuth>
      <div className="min-h-dvh bg-background">
        <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:block", sidebarCollapsed ? "w-16" : "w-64")}>
          <SidebarContent collapsed={sidebarCollapsed} />
        </aside>

        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <Link href="/home" aria-label="Blackbox dashboard">
            <Brand />
          </Link>
          <div className="flex items-center gap-2">
            <AccountMenu />
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex size-9 items-center justify-center rounded-md border text-muted-foreground"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
            >
              <Menu className="size-4" />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 border-r bg-sidebar shadow-xl animate-in slide-in-from-left duration-200">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3.5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <main className={cn("transition-[padding] duration-200", sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")} data-module={current.id}>
          <TopBar current={current} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((value) => !value)} />
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
        </main>
      </div>
    </RequireAuth>
  );
}
