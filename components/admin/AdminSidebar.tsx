"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Palette,
  FileText,
  Database,
  Users,
  FolderOpen,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/theme", label: "Theme", icon: Palette },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/collections", label: "Collections", icon: Database },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/files", label: "Files", icon: FolderOpen },
]

export function AdminSidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-52 border-r bg-gray-50 min-h-screen pt-4 flex-shrink-0">
      <div className="flex items-center gap-2 px-4 mb-4">
        <ShieldCheck className="h-5 w-5 text-amber-500" />
        <span className="font-semibold text-sm">Admin</span>
      </div>
      <nav className="space-y-1 px-3">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-amber-100 text-amber-800 font-medium"
                : "text-gray-700 hover:bg-amber-50 hover:text-amber-800"
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
