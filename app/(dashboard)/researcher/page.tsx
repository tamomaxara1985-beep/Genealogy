import { getTranslations, getLocale } from "next-intl/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/db"
import Researcher from "@/lib/models/Researcher"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ILocalizedName } from "@/types"

interface Row {
  _id: string
  name: ILocalizedName
  surname: ILocalizedName
  email: string
  phone: string
  region: string
}

export default async function ResearcherPage() {
  const [session, locale, tNav, tr, tRegions] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("researcher"),
    getTranslations("regions"),
  ])
  if (!session?.user) redirect("/login")

  await connectDB()
  const list = await Researcher.find().sort({ createdAt: 1 }).lean<Row[]>()
  const lang = locale as keyof ILocalizedName

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{tNav("researcher")}</h1>
      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">{tr("none")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((r) => (
            <Card key={r._id}>
              <CardHeader>
                <CardTitle>{(r.name[lang] || r.name.en)} {(r.surname[lang] || r.surname.en)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {r.email && (
                  <p className="text-muted-foreground">
                    {tr("email")}: <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                  </p>
                )}
                {r.phone && (
                  <p className="text-muted-foreground">
                    {tr("phone")}: <a href={`tel:${r.phone}`} className="hover:underline">{r.phone}</a>
                  </p>
                )}
                {r.region && (
                  <p className="text-muted-foreground">{tr("region")}: {tRegions(r.region)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
