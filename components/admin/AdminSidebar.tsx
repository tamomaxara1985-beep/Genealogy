"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  LayoutDashboard,
  Palette,
  FileText,
  Database,
  Users,
  FolderOpen,
  ShieldCheck,
  Mail,
  Microscope,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function AdminSidebar() {
  const pathname = usePathname()
  const t = useTranslations("admin")
  const tNav = useTranslations("nav")

  const links = [
    { href: "/admin/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/theme", label: t("theme"), icon: Palette },
    { href: "/admin/content", label: t("content"), icon: FileText },
    { href: "/admin/collections", label: t("collections"), icon: Database },
    { href: "/admin/users", label: t("users"), icon: Users },
    { href: "/admin/files", label: t("files"), icon: FolderOpen },
    { href: "/admin/contact", label: t("contact"), icon: Mail },
    { href: "/admin/researcher", label: t("researcher"), icon: Microscope },
  ]

  return (
    <aside className="w-52 border-r bg-gray-50 min-h-screen pt-4 flex-shrink-0">
      <div className="flex items-center gap-2 px-4 mb-4">
        <ShieldCheck className="h-5 w-5 text-emerald-500" />
        <span className="font-semibold text-sm">{tNav("admin")}</span>
      </div>
      <nav className="space-y-1 px-3">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-emerald-100 text-emerald-800 font-medium"
                : "text-gray-700 hover:bg-emerald-50 hover:text-emerald-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
