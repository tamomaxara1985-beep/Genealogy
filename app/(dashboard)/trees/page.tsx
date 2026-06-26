"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTrees } from "@/hooks/useTrees"

export default function TreesPage() {
  const router = useRouter()
  const tNav = useTranslations("nav")
  const t = useTranslations("tree")
  const tc = useTranslations("common")
  const { owned, shared, isLoading, mutate } = useTrees()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  async function createTree(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const tree = await res.json()
      await mutate()
      setShowForm(false)
      setName("")
      router.push(`/trees/${tree._id}`)
    }
    setCreating(false)
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{tNav("trees")}</h1>
        <Button onClick={() => setShowForm(true)}>{t("newTree")}</Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("createTree")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createTree} className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="treeName">{t("treeName")}</Label>
                <Input
                  id="treeName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("treePlaceholder")}
                  required
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? t("creating") : t("create")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                {tc("cancel")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground">{tc("loading")}</p>}

      {!isLoading && (
        <>
          <h2 className="text-lg font-semibold mb-3">{t("myTrees")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {owned.map((tree) => (
              <Card
                key={tree._id}
                className="cursor-pointer hover:border-amber-400 transition-colors"
                onClick={() => router.push(`/trees/${tree._id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{tree.name}</CardTitle>
                </CardHeader>
                {tree.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{tree.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}

            {owned.length === 0 && (
              <Card
                className="border-dashed border-2 flex items-center justify-center min-h-40 cursor-pointer hover:border-amber-400"
                onClick={() => setShowForm(true)}
              >
                <CardContent className="text-center pt-6">
                  <p className="text-muted-foreground">{t("createFirst")}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {shared.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-8 mb-3">{t("sharedWithMe")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shared.map((tree) => (
                  <Card
                    key={tree._id}
                    className="cursor-pointer hover:border-amber-400 transition-colors"
                    onClick={() => router.push(`/trees/${tree._id}`)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                      <CardTitle className="text-lg">{tree.name}</CardTitle>
                      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 whitespace-nowrap">
                        {t("viewOnly")}
                      </span>
                    </CardHeader>
                    {tree.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{tree.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
