"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GitBranch, Users, Calendar, ArrowRight } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Stats {
  treeCount: number
  personCount: number
  eventCount: number
  bio: string
}

export function DashboardClient() {
  const router = useRouter()
  const tNav = useTranslations("nav")
  const tDash = useTranslations("dashboard")
  const tc = useTranslations("common")
  const { data, isLoading, mutate } = useSWR<Stats>("/api/dashboard/stats", fetcher)
  const [bio, setBio] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data?.bio !== undefined) setBio(data.bio)
  }, [data?.bio])

  async function saveBio() {
    setSaving(true)
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    })
    setSaving(false)
    setSaved(true)
    mutate({ ...data!, bio }, false)
    setTimeout(() => setSaved(false), 2000)
  }

  const stats = [
    { label: tDash("statTrees"), value: data?.treeCount ?? 0, icon: GitBranch },
    { label: tDash("statPeople"), value: data?.personCount ?? 0, icon: Users },
    { label: tDash("statEvents"), value: data?.eventCount ?? 0, icon: Calendar },
  ]

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">{tNav("dashboard")}</h1>

      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Icon className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "—" : value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tDash("about")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full min-h-40 rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder={tDash("bioPlaceholder")}
            value={bio}
            onChange={(e) => { setBio(e.target.value); setSaved(false) }}
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={saveBio}
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving ? tc("saving") : tc("save")}
            </Button>
            {saved && <span className="text-sm text-green-600">{tDash("saved")}</span>}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{tNav("trees")}</h2>
        <Button variant="ghost" size="sm" className="gap-1 text-amber-600" onClick={() => router.push("/trees")}>
          {tDash("viewAll")} <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
