import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/db"
import ResearcherInfo from "@/lib/models/ResearcherInfo"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Info { name: string; surname: string; email: string; phone: string; region: string }

export default async function ResearcherPage() {
  const [session, tNav, tr, tRegions] = await Promise.all([
    auth(),
    getTranslations("nav"),
    getTranslations("researcher"),
    getTranslations("regions"),
  ])
  if (!session?.user) redirect("/login")

  await connectDB()
  const info = await ResearcherInfo.findOne().lean<Info | null>()
  const has = info && info.name

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{tNav("researcher")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{tr("title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {has ? (
            <div className="space-y-2">
              <p className="font-medium">{info!.name} {info!.surname}</p>
              {info!.email && (
                <p className="text-muted-foreground">
                  {tr("email")}: <a href={`mailto:${info!.email}`} className="hover:underline">{info!.email}</a>
                </p>
              )}
              {info!.phone && (
                <p className="text-muted-foreground">
                  {tr("phone")}: <a href={`tel:${info!.phone}`} className="hover:underline">{info!.phone}</a>
                </p>
              )}
              {info!.region && (
                <p className="text-muted-foreground">{tr("region")}: {tRegions(info!.region)}</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">{tr("none")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
