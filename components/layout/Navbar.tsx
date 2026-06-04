"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export function Navbar() {
  const { data: session } = useSession();
  const t = useTranslations("nav");

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <Link href="/dashboard" className="text-xl font-bold text-amber-800">
        FamilyRoots
      </Link>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none">
            <Avatar className="h-9 w-9 cursor-pointer">
              <AvatarImage src={session?.user?.image ?? ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href="/settings" />}>
              {t("settings")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
