import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import type { IResearcher } from "@/types"

export default async function ProfilePage() {
  const [session, tNav, t, tRes, tRegions] = await Promise.all([
    auth(),
    getTranslations("nav"),
    getTranslations("profile"),
    getTranslations("researcher"),
    getTranslations("regions"),
  ]);
  if (!session?.user) redirect("/login");

  await connectDB()
  const me = await User.findById(session.user.id, { researcher: 1 }).lean<{ researcher?: IResearcher } | null>()
  const researcher = me?.researcher

  const initials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "U";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{tNav("profile")}</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 text-xl font-bold">
              {initials}
            </div>
            <div>
              <CardTitle>{session.user.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("memberSince")}
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{tRes("title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {researcher ? (
            <div className="space-y-2">
              <p className="font-medium">{researcher.name} {researcher.surname}</p>
              <p className="text-muted-foreground">{tRes("email")}: {researcher.email}</p>
              <p className="text-muted-foreground">{tRes("phone")}: {researcher.phone}</p>
              <p className="text-muted-foreground">{tRes("region")}: {tRegions(researcher.region)}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">{tRes("none")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
