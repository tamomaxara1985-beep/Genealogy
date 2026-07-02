"use client"
import { useState } from "react"
import useSWR from "swr"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { REGION_CODES } from "@/lib/georgiaRegions"
import { Microscope, Trash2, Pencil } from "lucide-react"
import type { IResearcher, ILocalizedName } from "@/types"

type Form = {
  _id?: string
  name: ILocalizedName
  surname: ILocalizedName
  email: string
  phone: string
  region: string
}
const EMPTY_NAME: ILocalizedName = { en: "", ka: "", he: "" }
const BLANK: Form = { name: { ...EMPTY_NAME }, surname: { ...EMPTY_NAME }, email: "", phone: "", region: "" }

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })

export default function AdminResearcherPage() {
  const t = useTranslations("admin")
  const tr = useTranslations("researcher")
  const tRegions = useTranslations("regions")
  const tc = useTranslations("common")
  const locale = useLocale() as keyof ILocalizedName

  const { data: list = [], mutate } = useSWR<IResearcher[]>("/api/admin/researchers", fetcher)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  const valid = !!form &&
    form.name.en.trim() && form.surname.en.trim() && form.email.trim() &&
    form.phone.trim() && form.region.trim()

  function setField(k: "email" | "phone" | "region", v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f))
  }
  function setLoc(field: "name" | "surname", lang: keyof ILocalizedName, v: string) {
    setForm((f) => (f ? { ...f, [field]: { ...f[field], [lang]: v } } : f))
  }

  async function save() {
    if (!form || !valid) return
    setSaving(true)
    const isEdit = !!form._id
    const url = isEdit ? `/api/admin/researchers/${form._id}` : "/api/admin/researchers"
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) { await mutate(); setForm(null) }
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm(tr("delete"))) return
    const res = await fetch(`/api/admin/researchers/${id}`, { method: "DELETE" })
    if (res.ok) await mutate()
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Microscope className="h-5 w-5 text-amber-500" />
          <h1 className="text-xl font-bold">{t("researcher")}</h1>
        </div>
        {!form && (
          <Button onClick={() => setForm({ ...BLANK, name: { ...EMPTY_NAME }, surname: { ...EMPTY_NAME } })}
            className="bg-amber-500 hover:bg-amber-600 text-white">
            {tr("add")}
          </Button>
        )}
      </div>

      {!form && (
        <div className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{tr("none")}</p>}
          {list.map((r) => (
            <div key={r._id} className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm">
                <p className="font-medium">
                  {(r.name[locale] || r.name.en)} {(r.surname[locale] || r.surname.en)}
                </p>
                <p className="text-muted-foreground">{tRegions(r.region)} · {r.email}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => setForm({ _id: r._id, name: { ...EMPTY_NAME, ...r.name }, surname: { ...EMPTY_NAME, ...r.surname }, email: r.email, phone: r.phone, region: r.region })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => del(r._id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="space-y-4 rounded-md border p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{tr("nameEn")}</Label>
              <Input value={form.name.en} onChange={(e) => setLoc("name", "en", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("nameKa")}</Label>
              <Input value={form.name.ka} onChange={(e) => setLoc("name", "ka", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("nameHe")}</Label>
              <Input value={form.name.he} onChange={(e) => setLoc("name", "he", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("surnameEn")}</Label>
              <Input value={form.surname.en} onChange={(e) => setLoc("surname", "en", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("surnameKa")}</Label>
              <Input value={form.surname.ka} onChange={(e) => setLoc("surname", "ka", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("surnameHe")}</Label>
              <Input value={form.surname.he} onChange={(e) => setLoc("surname", "he", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{tr("email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("phone")}</Label>
              <Input type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{tr("region")}</Label>
            <Select value={form.region} onValueChange={(v) => setField("region", v ?? "")}>
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
            <Button variant="outline" onClick={() => setForm(null)}>{tc("cancel")}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
