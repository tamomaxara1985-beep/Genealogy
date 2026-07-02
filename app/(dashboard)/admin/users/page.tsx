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
import { Users, Trash2 } from "lucide-react"

interface AdminUser {
  _id: string
  name: string
  email: string
  role: "user" | "admin"
  createdAt: string
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`)
    return r.json()
  })

export default function AdminUsersPage() {
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const { data: session } = useSession()
  const { data: users = [], mutate } = useSWR<AdminUser[]>("/api/admin/users", fetcher)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(false)

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
        <Users className="h-5 w-5 text-emerald-500" />
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
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSelf}
                      onClick={() => setDeleteTarget(user)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">
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
    </div>
  )
}
