import { BookOpen, FileCode2, LayoutDashboard, LineChart, Settings2, Users, Video, type LucideIcon } from "lucide-react";

/**
 * Every area of the app, with the colour that identifies it. The sidebar, the
 * top bar breadcrumb, page headers and dashboard cards all read from here, so a
 * candidate can always tell which section they are in.
 */
export type AppModuleId = "dashboard" | "practice" | "interview" | "gd" | "project" | "performance" | "settings";

export interface AppModule {
  id: AppModuleId;
  label: string;
  section: "Overview" | "Training" | "Insights" | "Account";
  href: string;
  /** Path prefixes that belong to this module. */
  match: string[];
  icon: LucideIcon;
  /** Tailwind classes using the module's colour token. */
  text: string;
  chip: string;
  /** Icon tile tint while the nav item is hovered. */
  hover: string;
}

export const APP_MODULES: AppModule[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    section: "Overview",
    href: "/home",
    match: ["/home"],
    icon: LayoutDashboard,
    text: "text-mod-dashboard",
    chip: "bg-mod-dashboard/12 text-mod-dashboard ring-mod-dashboard/25",
    hover: "group-hover:bg-mod-dashboard/10",
  },
  {
    id: "practice",
    label: "Practice Hub",
    section: "Training",
    href: "/journey/practice",
    match: ["/journey/practice"],
    icon: BookOpen,
    text: "text-mod-practice",
    chip: "bg-mod-practice/12 text-mod-practice ring-mod-practice/25",
    hover: "group-hover:bg-mod-practice/10",
  },
  {
    id: "interview",
    label: "Mock Interview",
    section: "Training",
    href: "/interview/setup",
    match: ["/interview"],
    icon: Video,
    text: "text-mod-interview",
    chip: "bg-mod-interview/12 text-mod-interview ring-mod-interview/25",
    hover: "group-hover:bg-mod-interview/10",
  },
  {
    id: "gd",
    label: "Group Discussion",
    section: "Training",
    href: "/gd-room",
    match: ["/gd-room"],
    icon: Users,
    text: "text-mod-gd",
    chip: "bg-mod-gd/12 text-mod-gd ring-mod-gd/25",
    hover: "group-hover:bg-mod-gd/10",
  },
  {
    id: "project",
    label: "Project Review",
    section: "Training",
    href: "/journey/project",
    match: ["/journey/project"],
    icon: FileCode2,
    text: "text-mod-project",
    chip: "bg-mod-project/12 text-mod-project ring-mod-project/25",
    hover: "group-hover:bg-mod-project/10",
  },
  {
    id: "performance",
    label: "Performance",
    section: "Insights",
    href: "/dashboard/performance",
    match: ["/dashboard"],
    icon: LineChart,
    text: "text-mod-performance",
    chip: "bg-mod-performance/12 text-mod-performance ring-mod-performance/25",
    hover: "group-hover:bg-mod-performance/10",
  },
  {
    id: "settings",
    label: "Settings",
    section: "Account",
    href: "/settings",
    match: ["/settings", "/profile"],
    icon: Settings2,
    text: "text-mod-settings",
    chip: "bg-mod-settings/12 text-mod-settings ring-mod-settings/25",
    hover: "group-hover:bg-mod-settings/10",
  },
];

export const MODULE_BY_ID = Object.fromEntries(APP_MODULES.map((m) => [m.id, m])) as Record<AppModuleId, AppModule>;

export function moduleForPath(pathname: string): AppModule {
  let best: AppModule = MODULE_BY_ID.dashboard;
  let bestLength = 0;
  for (const m of APP_MODULES) {
    for (const prefix of m.match) {
      if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && prefix.length > bestLength) {
        best = m;
        bestLength = prefix.length;
      }
    }
  }
  return best;
}
