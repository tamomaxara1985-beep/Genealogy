// app/(dashboard)/admin/users/page.tsx
"use client"
import { useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { REGION_CODES } from "@/lib/georgiaRegions"
import type { IResearcher } from "@/types"
import { Users, Trash2, Microscope } from "lucide-react"

interface AdminUser {
  _id: string
  name: string
  email: string
  role: "user" | "admin"
  createdAt: string
  researcher?: IResearcher
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`)
    return r.json()
  })

export default function AdminUsersPage() {
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const tr = useTranslations("researcher")
  const tRegions = useTranslations("regions")
  const { data: session } = useSession()
  const { data: users = [], mutate } = useSWR<AdminUser[]>("/api/admin/users", fetcher)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(false)

  const [researcherTarget, setResearcherTarget] = useState<AdminUser | null>(null)
  const [rForm, setRForm] = useState({
    name: "", surname: "", email: "", phone: "", region: "",
  })
  const [rSaving, setRSaving] = useState(false)

  const rValid =
    rForm.name.trim() && rForm.surname.trim() && rForm.email.trim() &&
    rForm.phone.trim() && rForm.region.trim()

  function openResearcher(user: AdminUser) {
    const r = user.researcher
    setRForm({
      name: r?.name ?? "",
      surname: r?.surname ?? "",
      email: r?.email ?? "",
      phone: r?.phone ?? "",
      region: r?.region ?? "",
    })
    setResearcherTarget(user)
  }

  async function saveResearcher() {
    if (!researcherTarget || !rValid) return
    setRSaving(true)
    const res = await fetch(`/api/admin/users/${researcherTarget._id}/researcher`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rForm),
    })
    if (res.ok) { await mutate(); setResearcherTarget(null) }
    setRSaving(false)
  }

  async function unassignResearcher() {
    if (!researcherTarget) return
    setRSaving(true)
    const res = await fetch(`/api/admin/users/${researcherTarget._id}/researcher`, {
      method: "DELETE",
    })
    if (res.ok) { await mutate(); setResearcherTarget(null) }
    setRSaving(false)
  }

  async function handleRoleChange(userId: string, role: string | null) {
    if (!role) return
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    if (res.ok) mutate()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setLoading(true)
    const res = await fetch(`/api/admin/users/${deleteTarget._id}`, { method: "DELETE" })
    if (res.ok) {
      await mutate()
      setDeleteTarget(null)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">{t("users")} ({users.length})</h1>
      </div>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("name")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("email")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("role")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("joined")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{tr("title")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user._id === session?.user?.id
              return (
                <tr key={user._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.role}
                      onValueChange={(role) => handleRoleChange(user._id, role)}
                      disabled={isSelf}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t("roleUser")}</SelectItem>
                        <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.researcher
                      ? `${user.researcher.name} ${user.researcher.surname}`
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant={user.researcher ? "outline" : "default"}
                        size="sm"
                        onClick={() => openResearcher(user)}
                      >
                        <Microscope className="h-3.5 w-3.5 mr-1" />
                        {user.researcher ? tr("edit") : tr("add")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => setDeleteTarget(user)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-sm">
                  {t("noUsers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteUser")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("deleteUserDesc", { name: deleteTarget?.name ?? "" })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{tc("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? tc("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!researcherTarget} onOpenChange={(open) => { if (!open) setResearcherTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("title")} — {researcherTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{tr("name")}</Label>
              <Input value={rForm.name} onChange={(e) => setRForm({ ...rForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("surname")}</Label>
              <Input value={rForm.surname} onChange={(e) => setRForm({ ...rForm, surname: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("email")}</Label>
              <Input type="email" value={rForm.email} onChange={(e) => setRForm({ ...rForm, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("phone")}</Label>
              <Input type="tel" value={rForm.phone} onChange={(e) => setRForm({ ...rForm, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("region")}</Label>
              <Select value={rForm.region} onValueChange={(v) => setRForm({ ...rForm, region: v ?? "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGION_CODES.map((c) => (
                    <SelectItem key={c} value={c}>{tRegions(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {researcherTarget?.researcher && (
              <Button variant="outline" onClick={unassignResearcher} disabled={rSaving} className="text-destructive hover:text-destructive mr-auto">
                {tc("delete")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setResearcherTarget(null)}>{tc("cancel")}</Button>
            <Button onClick={saveResearcher} disabled={rSaving || !rValid}>
              {rSaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
