import Link from "next/link";
import { Home, Trees, User, Dna } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/trees", label: "My Trees", icon: Trees },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/dna", label: "DNA Matches", icon: Dna },
];

export function Sidebar() {
  return (
    <aside className="w-56 border-r bg-gray-50 min-h-screen pt-4">
      <nav className="space-y-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
