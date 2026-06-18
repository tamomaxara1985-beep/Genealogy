"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GitBranch, Users, Calendar, Plus, ArrowRight } from "lucide-react"
import type { ITree } from "@/types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Stats {
  treeCount: number
  personCount: number
  eventCount: number
  recentTrees: ITree[]
}

export function DashboardClient() {
  const router = useRouter()
  const { data, isLoading, mutate } = useSWR<Stats>("/api/dashboard/stats", fetcher)
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

  const stats = [
    { label: "Trees", value: data?.treeCount ?? 0, icon: GitBranch },
    { label: "People", value: data?.personCount ?? 0, icon: Users },
    { label: "Events", value: data?.eventCount ?? 0, icon: Calendar },
  ]

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Tree
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create a tree</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createTree} className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="treeName">Tree name</Label>
                <Input
                  id="treeName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Smith Family Tree"
                  required
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Trees</h2>
          <Button variant="ghost" size="sm" className="gap-1 text-amber-600" onClick={() => router.push("/trees")}>
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data?.recentTrees.map((tree) => (
            <Card
              key={tree._id}
              className="cursor-pointer hover:border-amber-400 transition-colors"
              onClick={() => router.push(`/trees/${tree._id}`)}
            >
              <CardHeader>
                <CardTitle className="text-base">{tree.name}</CardTitle>
              </CardHeader>
              {tree.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{tree.description}</p>
                </CardContent>
              )}
            </Card>
          ))}

          {!isLoading && !data?.recentTrees.length && (
            <Card
              className="border-dashed border-2 flex items-center justify-center min-h-32 cursor-pointer hover:border-amber-400 col-span-3"
              onClick={() => setShowForm(true)}
            >
              <CardContent className="text-center pt-6">
                <p className="text-muted-foreground">+ Create your first tree</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
