"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CloudinaryUpload } from "@/components/ui/cloudinary-upload"
import type { IEvent } from "@/types"

const EVENT_TYPES = ["birth", "death", "marriage", "divorce", "immigration", "other"] as const

const EVENT_ICONS: Record<string, string> = {
  birth: "👶", death: "✝️", marriage: "💍", divorce: "📄", immigration: "🚢", other: "📌",
}

interface Props {
  personId: string
  onSuccess: () => void
}

export function EventForm({ personId, onSuccess }: Props) {
  const t = useTranslations("event")
  const [form, setForm] = useState<Partial<IEvent>>({ type: "birth", documentUrls: [] })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/persons/${personId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("Failed to save event")
      onSuccess()
      setForm({ type: "birth", documentUrls: [] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label>{t("type")}</Label>
        <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as IEvent["type"] }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="capitalize">
                {EVENT_ICONS[type]} {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{t("date")}</Label>
          <Input type="date" value={form.date ?? ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>{t("place")}</Label>
          <Input value={form.place ?? ""} onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>{t("description")}</Label>
        <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>

      <div className="space-y-1">
        <Label>{t("documents")}</Label>
        <CloudinaryUpload mode="multi" folder="genealogy/documents" value={form.documentUrls ?? []} onChange={(urls) => setForm((f) => ({ ...f, documentUrls: urls }))} />
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? t("adding") : t("add")}
      </Button>
    </form>
  )
}
