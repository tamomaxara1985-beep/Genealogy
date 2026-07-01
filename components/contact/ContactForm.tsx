"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ContactForm() {
  const t = useTranslations("contact")
  const [form, setForm] = useState({ fullName: "", email: "", subject: "", message: "", company: "" })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(false)

  const emailOk = /\S+@\S+/.test(form.email)
  const valid =
    form.fullName.trim() && emailOk && form.subject.trim() && form.message.trim()

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setDone(false)
    setError(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSending(true)
    setError(false)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("failed")
      setForm({ fullName: "", email: "", subject: "", message: "", company: "" })
      setDone(true)
    } catch {
      setError(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Honeypot — hidden from users, catches bots */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="company">Company</label>
        <input
          id="company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cf-name">{t("fullName")}</Label>
        <Input id="cf-name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-email">{t("emailField")}</Label>
        <Input id="cf-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-subject">{t("subject")}</Label>
        <Input id="cf-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-message">{t("message")}</Label>
        <Textarea id="cf-message" className="min-h-32" value={form.message} onChange={(e) => set("message", e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={sending || !valid} className="bg-amber-700 hover:bg-amber-800 text-amber-50">
          {sending ? t("sending") : t("send")}
        </Button>
        {done && <span className="text-sm text-green-700">{t("sent")}</span>}
        {error && <span className="text-sm text-red-600">{t("sendError")}</span>}
      </div>
    </form>
  )
}
