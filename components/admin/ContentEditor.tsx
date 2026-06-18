// components/admin/ContentEditor.tsx
"use client"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Override {
  _id: string
  key: string
  value: string
}

interface ContentEditorProps {
  defaults: Record<string, string>
  initialOverrides: Record<string, Override>
  locale: string
}

export function ContentEditor({ defaults, initialOverrides, locale }: ContentEditorProps) {
  const router = useRouter()
  const [overrides, setOverrides] = useState<Record<string, Override>>(initialOverrides)
  const [pending, setPending] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState("")

  const keys = Object.keys(defaults).filter(
    (k) =>
      !search ||
      k.toLowerCase().includes(search.toLowerCase()) ||
      defaults[k].toLowerCase().includes(search.toLowerCase())
  )

  async function save(key: string) {
    const value = pending[key]
    if (value === undefined) return
    setSaving((prev) => ({ ...prev, [key]: true }))
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, key, value }),
    })
    if (res.ok) {
      const doc = await res.json()
      setOverrides((prev) => ({ ...prev, [key]: doc }))
      setPending((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      router.refresh()
    }
    setSaving((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function remove(key: string) {
    const override = overrides[key]
    if (!override) return
    await fetch(`/api/admin/content/${override._id}`, { method: "DELETE" })
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setPending((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    router.refresh()
  }

  const currentValue = useCallback(
    (key: string) => pending[key] ?? overrides[key]?.value ?? defaults[key] ?? "",
    [pending, overrides, defaults]
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search keys or values…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-1/3">Key</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-1/3">Default</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Override</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const hasOverride = !!overrides[key]
              return (
                <tr
                  key={key}
                  className={cn("border-b last:border-0", hasOverride ? "bg-amber-50" : "")}
                >
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{key}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{defaults[key]}</td>
                  <td className="px-4 py-2">
                    <Input
                      value={currentValue(key)}
                      onChange={(e) =>
                        setPending((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && save(key)}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 flex items-center gap-1">
                    {pending[key] !== undefined && (
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => save(key)}
                        disabled={saving[key]}
                      >
                        {saving[key] ? "…" : <Check className="h-3 w-3" />}
                      </Button>
                    )}
                    {hasOverride && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground"
                        onClick={() => remove(key)}
                        title="Remove override"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
