import {
  LayoutGrid, MessageSquarePlus, Inbox, ListChecks, BarChart3, UserCog, Users, Building2, Tags,
  ShieldCheck, Fingerprint, Bell, Settings, FileText, UserRound, ClipboardList, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; mobile?: boolean; short?: string };
export type NavGroup = { title?: string; items: NavItem[] };
export type Area = "hr" | "admin";

export const NAV: Record<Area, { name: string; groups: NavGroup[] }> = {
  hr: {
    name: "HR",
    groups: [
      { items: [
        { href: "/hr", label: "Overview", icon: LayoutGrid, mobile: true },
        { href: "/hr/inbox", label: "Feedback inbox", icon: Inbox, mobile: true, short: "Inbox" },
        { href: "/hr/assigned", label: "Assigned cases", icon: ListChecks, mobile: true, short: "Mine" },
        { href: "/hr/reports", label: "Reports", icon: BarChart3, mobile: true },
        { href: "/hr/customers", label: "Customer forms", icon: ClipboardList },
        { href: "/hr/account", label: "My account", icon: UserRound },
      ] },
    ],
  },
  admin: {
    name: "Super Admin",
    groups: [
      { items: [
        { href: "/admin", label: "Overview", icon: LayoutGrid, mobile: true },
        { href: "/admin/feedback", label: "All feedback", icon: Inbox, mobile: true, short: "Cases" },
        { href: "/admin/reports", label: "Reports", icon: BarChart3, mobile: true },
      ] },
      { title: "Customers", items: [
        { href: "/admin/customers", label: "Customer forms", icon: ClipboardList },
      ] },
      { title: "People", items: [
        { href: "/admin/staff", label: "HR & reviewers", icon: UserCog },
        { href: "/admin/departments", label: "Departments", icon: Building2 },
      ] },
      { title: "Restricted", items: [
        { href: "/admin/audit", label: "Audit log", icon: FileText },
      ] },
      { title: "Setup", items: [
        { href: "/admin/categories", label: "Categories", icon: Tags },
        { href: "/admin/notifications", label: "Notifications", icon: Bell },
        { href: "/admin/security", label: "Security", icon: ShieldCheck },
        { href: "/admin/settings", label: "System settings", icon: Settings, mobile: true, short: "Settings" },
      ] },
    ],
  },
};
