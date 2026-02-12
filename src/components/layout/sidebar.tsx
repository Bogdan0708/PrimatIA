"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  Car,
  Calculator,
  CreditCard,
  Settings,
  Building,
  UserCog,
  ClipboardList,
  FileDown,
  ScrollText,
  Shield,
  FileText,
  BarChart3,
  AlertTriangle,
  Database,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { Role } from "@/lib/constants";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

const mainNavItems: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/contribuabili",
    labelKey: "taxpayers",
    icon: Users,
  },
  {
    href: "/proprietati/cladiri",
    labelKey: "buildings",
    icon: Building2,
  },
  {
    href: "/proprietati/terenuri",
    labelKey: "land",
    icon: MapPin,
  },
  {
    href: "/proprietati/vehicule",
    labelKey: "vehicles",
    icon: Car,
  },
  {
    href: "/plati",
    labelKey: "payments",
    icon: CreditCard,
  },
  {
    href: "/documente",
    labelKey: "documents",
    icon: FileText,
  },
  {
    href: "/rapoarte",
    labelKey: "reports",
    icon: BarChart3,
  },
  {
    href: "/somatii",
    labelKey: "somatii",
    icon: AlertTriangle,
  },
];

const adminNavItems: NavItem[] = [
  {
    href: "/admin/hcl",
    labelKey: "hclDecisions",
    icon: ClipboardList,
    roles: ["super_admin", "primaria_admin"],
  },
  {
    href: "/admin/scutiri",
    labelKey: "exemptions",
    icon: Shield,
    roles: ["super_admin", "primaria_admin"],
  },
  {
    href: "/admin/calcul",
    labelKey: "taxes",
    icon: Calculator,
    roles: ["super_admin", "primaria_admin"],
  },
  {
    href: "/admin/import",
    labelKey: "imports",
    icon: FileDown,
    roles: ["super_admin", "primaria_admin"],
  },
  {
    href: "/admin/patrimven",
    labelKey: "patrimven",
    icon: Database,
    roles: ["super_admin", "primaria_admin"],
  },
  {
    href: "/admin/notificari",
    labelKey: "notifications",
    icon: Bell,
    roles: ["super_admin", "primaria_admin"],
  },
];

const systemNavItems: NavItem[] = [
  {
    href: "/admin/tenants",
    labelKey: "tenants",
    icon: Building,
    roles: ["super_admin"],
  },
  {
    href: "/admin/users",
    labelKey: "users",
    icon: UserCog,
    roles: ["super_admin", "primaria_admin"],
  },
  {
    href: "/audit-log",
    labelKey: "auditLog",
    icon: ScrollText,
    roles: ["super_admin", "primaria_admin"],
  },
  {
    href: "/settings",
    labelKey: "settings",
    icon: Settings,
    roles: ["super_admin", "primaria_admin"],
  },
];

interface SidebarProps {
  userRole: Role;
  className?: string;
}

export function Sidebar({ userRole, className }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || item.roles.includes(userRole));

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r bg-card",
        className
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Building2 className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">PrimărIA</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname.startsWith(item.href)}
              label={t(item.labelKey)}
            />
          ))}
        </div>

        {filterByRole(adminNavItems).length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-1">
              {filterByRole(adminNavItems).map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname.startsWith(item.href)}
                  label={t(item.labelKey)}
                />
              ))}
            </div>
          </>
        )}

        {filterByRole(systemNavItems).length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-1">
              {filterByRole(systemNavItems).map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname.startsWith(item.href)}
                  label={t(item.labelKey)}
                />
              ))}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}

function NavLink({
  item,
  isActive,
  label,
}: {
  item: NavItem;
  isActive: boolean;
  label: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
