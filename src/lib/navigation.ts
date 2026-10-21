import {
  Bell,
  Briefcase,
  Dumbbell,
  GraduationCap,
  Home,
  LineChart,
  ListChecks,
  type LucideIcon,
  Salad,
  Scale,
  Settings,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Modules whose screens arrive in phase 2 are marked, never hidden. */
  upcoming?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** The 16 modules, grouped the way the user thinks about their day. */
export const navGroups: NavGroup[] = [
  {
    label: "Today",
    items: [
      { href: "/home", label: "Twin home", icon: Home },
      { href: "/productivity", label: "Productivity", icon: ListChecks },
      { href: "/academic", label: "Academic", icon: GraduationCap },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/goals", label: "Goals & planning", icon: Target },
      { href: "/regreter", label: "Regreter & future self", icon: Scale },
      { href: "/insights", label: "Insights & reviews", icon: LineChart, upcoming: true },
    ],
  },
  {
    label: "Life",
    items: [
      { href: "/health", label: "Health", icon: Dumbbell },
      { href: "/nutrition", label: "Nutrition", icon: Salad },
      { href: "/finance", label: "Finance", icon: Wallet },
      { href: "/career", label: "Career", icon: Briefcase },
    ],
  },
  {
    label: "Twin",
    items: [
      { href: "/twin", label: "Ask my twin", icon: Sparkles },
      { href: "/reminders", label: "Reminders", icon: Bell, upcoming: true },
      { href: "/settings", label: "Privacy & control", icon: Settings, upcoming: true },
    ],
  },
];

/** Bottom navigation keeps to five destinations. */
export const mobileNav: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/productivity", label: "Plan", icon: ListChecks },
  { href: "/twin", label: "Twin", icon: Sparkles },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/academic", label: "Academic", icon: GraduationCap },
];

export const allNavItems = navGroups.flatMap((group) => group.items);
