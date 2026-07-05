import Link from "next/link";
import { Home, Trees, User, Dna, ShieldCheck, Microscope, Mail, Search, Inbox } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { RequestsBadge } from "@/components/layout/NavBadges";

export async function Sidebar() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  const t = await getTranslations("nav");

  const nav = [
    { href: "/dashboard", label: t("dashboard"), icon: Home },
    { href: "/trees", label: t("trees"), icon: Trees },
    { href: "/search", label: t("search"), icon: Search },
    { href: "/requests", label: t("requests"), icon: Inbox },
    { href: "/profile", label: t("profile"), icon: User },
    { href: "/researcher", label: t("researcher"), icon: Microscope },
    { href: "/contact", label: t("contact"), icon: Mail },
    { href: "/dna", label: t("dna"), icon: Dna },
  ];

  return (
    <aside className="w-56 border-r bg-gray-50 min-h-screen pt-4">
      <nav className="space-y-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
          >
            <Icon className="h-4 w-4" />
            {label}
            {href === "/requests" && <RequestsBadge />}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            {t("admin")}
          </Link>
        )}
      </nav>
    </aside>
  );
}
