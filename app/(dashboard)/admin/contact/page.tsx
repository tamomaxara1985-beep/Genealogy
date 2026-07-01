"use client"
import { useState, useEffect } from "react"
import useSWR from "swr"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { SOCIAL_PLATFORMS } from "@/lib/contact"
import { Mail, Trash2, Plus } from "lucide-react"

interface Info {
  orgName: string; address: string; mapQuery: string; phone: string; email: string
  hours: { days: string; hours: string }[]
  socials: { platform: string; url: string }[]
}
interface Message {
  _id: string; fullName: string; email: string; subject: string; message: string
  status: "new" | "read"; createdAt: string
}

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })

const BLANK: Info = { orgName: "", address: "", mapQuery: "", phone: "", email: "", hours: [], socials: [] }

export default function AdminContactPage() {
  const t = useTranslations("contact")
  const tc = useTranslations("common")

  const { data: info, mutate: mutateInfo } = useSWR<Info>("/api/admin/contact-info", fetcher)
  const { data: messages = [], mutate: mutateMsgs } = useSWR<Message[]>("/api/admin/contact-messages", fetcher)

  const [form, setForm] = useState<Info>(BLANK)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [openMsg, setOpenMsg] = useState<Message | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (info) setForm({ ...BLANK, ...info, hours: info.hours ?? [], socials: info.socials ?? [] })
  }, [info])

  function setField(k: keyof Info, v: string) { setForm((f) => ({ ...f, [k]: v })); setSaved(false) }

  async function saveInfo() {
    setSaving(true)
    const res = await fetch("/api/admin/contact-info", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) { await mutateInfo(); setSaved(true) }
    setSaving(false)
  }

  async function markRead(id: string) {
    const res = await fetch(`/api/admin/contact-messages/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "read" }),
    })
    if (res.ok) { await mutateMsgs(); setOpenMsg(null) }
  }
  async function deleteMsg(id: string) {
    const res = await fetch(`/api/admin/contact-messages/${id}`, { method: "DELETE" })
    if (res.ok) { await mutateMsgs(); setOpenMsg(null) }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">{t("info")}</h1>
      </div>

      {/* Info editor */}
      <div className="space-y-4 rounded-md border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("orgName")}</Label>
            <Input value={form.orgName} onChange={(e) => setField("orgName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("phone")}</Label>
            <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("email")}</Label>
            <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("mapQuery")}</Label>
            <Input value={form.mapQuery} onChange={(e) => setField("mapQuery", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("address")}</Label>
          <Textarea value={form.address} onChange={(e) => setField("address", e.target.value)} />
        </div>

        {/* Hours */}
        <div className="space-y-2">
          <Label>{t("hours")}</Label>
          {form.hours.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={t("days")} value={h.days}
                onChange={(e) => { const hours = [...form.hours]; hours[i] = { ...hours[i], days: e.target.value }; setForm((f) => ({ ...f, hours })); setSaved(false) }}
              />
              <Input
                placeholder={t("openHours")} value={h.hours}
                onChange={(e) => { const hours = [...form.hours]; hours[i] = { ...hours[i], hours: e.target.value }; setForm((f) => ({ ...f, hours })); setSaved(false) }}
              />
              <Button variant="outline" size="sm" className="text-destructive"
                onClick={() => setForm((f) => ({ ...f, hours: f.hours.filter((_, j) => j !== i) }))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm"
            onClick={() => setForm((f) => ({ ...f, hours: [...f.hours, { days: "", hours: "" }] }))}>
            <Plus className="mr-1 h-3.5 w-3.5" />{t("addRow")}
          </Button>
        </div>

        {/* Socials */}
        <div className="space-y-2">
          <Label>{t("social")}</Label>
          {form.socials.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={s.platform}
                onValueChange={(v) => { const socials = [...form.socials]; socials[i] = { ...socials[i], platform: v ?? "" }; setForm((f) => ({ ...f, socials })); setSaved(false) }}>
                <SelectTrigger className="w-40"><SelectValue placeholder={t("platform")} /></SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder={t("url")} value={s.url}
                onChange={(e) => { const socials = [...form.socials]; socials[i] = { ...socials[i], url: e.target.value }; setForm((f) => ({ ...f, socials })); setSaved(false) }} />
              <Button variant="outline" size="sm" className="text-destructive"
                onClick={() => setForm((f) => ({ ...f, socials: f.socials.filter((_, j) => j !== i) }))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm"
            onClick={() => setForm((f) => ({ ...f, socials: [...f.socials, { platform: "website", url: "" }] }))}>
            <Plus className="mr-1 h-3.5 w-3.5" />{t("addRow")}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={saveInfo} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
            {saving ? tc("saving") : t("save")}
          </Button>
          {saved && <span className="text-sm text-green-600">{t("saved")}</span>}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("messages")} ({messages.length})</h2>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("fullName")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("subject")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("date")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m._id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => setOpenMsg(m)}>
                  <td className="px-4 py-3 font-medium">{m.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{m.subject}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.status === "new" ? "default" : "secondary"}>
                      {m.status === "new" ? t("statusNew") : t("statusRead")}
                    </Badge>
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">{t("noMessages")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!openMsg} onOpenChange={(open) => { if (!open) setOpenMsg(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{openMsg?.subject}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">{openMsg?.fullName}</span> · <a href={`mailto:${openMsg?.email}`} className="text-amber-700 hover:underline">{openMsg?.email}</a></p>
            <p className="whitespace-pre-line text-muted-foreground">{openMsg?.message}</p>
          </div>
          <DialogFooter className="gap-2">
            {openMsg?.status === "new" && (
              <Button variant="outline" onClick={() => openMsg && markRead(openMsg._id)} className="mr-auto">{t("markRead")}</Button>
            )}
            <Button variant="outline" onClick={() => setOpenMsg(null)}>{tc("cancel")}</Button>
            <Button variant="destructive" onClick={() => openMsg && deleteMsg(openMsg._id)}>{tc("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
