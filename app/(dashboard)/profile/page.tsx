import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { Badge } from "@/components/ui/badge"
import type { IResearcher } from "@/types"

export default async function ProfilePage() {
  const [session, tNav, t] = await Promise.all([
    auth(),
    getTranslations("nav"),
    getTranslations("profile"),
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
          <CardTitle>Researcher</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {researcher ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{researcher.fullName}</span>
                <Badge variant="secondary">{researcher.status}</Badge>
              </div>
              <p className="text-muted-foreground">{researcher.contact}</p>
              {researcher.notes && <p className="text-muted-foreground">{researcher.notes}</p>}
              {researcher.assignmentDate && (
                <p className="text-xs text-muted-foreground">Assigned: {researcher.assignmentDate}</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No researcher assigned yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
