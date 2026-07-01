"use client"
import { useState, useEffect } from "react"
import useSWR from "swr"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { REGION_CODES } from "@/lib/georgiaRegions"
import { Microscope } from "lucide-react"

interface Info { name: string; surname: string; email: string; phone: string; region: string }
const BLANK: Info = { name: "", surname: "", email: "", phone: "", region: "" }

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })

export default function AdminResearcherPage() {
  const t = useTranslations("admin")
  const tr = useTranslations("researcher")
  const tRegions = useTranslations("regions")
  const tc = useTranslations("common")

  const { data, mutate } = useSWR<Info>("/api/admin/researcher-info", fetcher)
  const [form, setForm] = useState<Info>(BLANK)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setForm({ ...BLANK, ...data })
  }, [data])

  const valid =
    form.name.trim() && form.surname.trim() && form.email.trim() &&
    form.phone.trim() && form.region.trim()

  function set(k: keyof Info, v: string) { setForm((f) => ({ ...f, [k]: v })); setSaved(false) }

  async function save() {
    if (!valid) return
    setSaving(true)
    const res = await fetch("/api/admin/researcher-info", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) { await mutate(); setSaved(true) }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Microscope className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">{t("researcher")}</h1>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{tr("name")}</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("surname")}</Label>
            <Input value={form.surname} onChange={(e) => set("surname", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("email")}</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("phone")}</Label>
            <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tr("region")}</Label>
          <Select value={form.region} onValueChange={(v) => set("region", v ?? "")}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REGION_CODES.map((c) => (
                <SelectItem key={c} value={c}>{tRegions(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving || !valid} className="bg-amber-500 hover:bg-amber-600 text-white">
            {saving ? tc("saving") : tc("save")}
          </Button>
          {saved && <span className="text-sm text-green-600">{t("savedTheme")}</span>}
        </div>
      </div>
    </div>
  )
}
