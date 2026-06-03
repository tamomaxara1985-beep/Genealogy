"use client"
import { useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { ShieldCheck, Trash2, FileText } from "lucide-react"

interface AdminUser {
  _id: string
  name: string
  email: string
  role: "user" | "admin"
  createdAt: string
}

interface CloudinaryResource {
  public_id: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  created_at: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AdminPage() {
  const { data: session } = useSession()
  const { data: users = [], mutate: mutateUsers } = useSWR<AdminUser[]>(
    "/api/admin/users",
    fetcher
  )
  const { data: files = [], mutate: mutateFiles } = useSWR<CloudinaryResource[]>(
    "/api/admin/files",
    fetcher
  )

  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUser | null>(null)
  const [deleteFileTarget, setDeleteFileTarget] = useState<CloudinaryResource | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRoleChange(userId: string, role: string | null) {
    if (!role) return
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    mutateUsers()
  }

  async function handleDeleteUser() {
    if (!deleteUserTarget) return
    setLoading(true)
    await fetch(`/api/admin/users/${deleteUserTarget._id}`, { method: "DELETE" })
    await mutateUsers()
    setDeleteUserTarget(null)
    setLoading(false)
  }

  async function handleDeleteFile() {
    if (!deleteFileTarget) return
    setLoading(true)
    await fetch("/api/admin/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicId: deleteFileTarget.public_id,
        resourceType: deleteFileTarget.resource_type,
      }),
    })
    await mutateFiles()
    setDeleteFileTarget(null)
    setLoading(false)
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
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
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
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
                          onClick={() => setDeleteUserTarget(user)}
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
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file) => (
              <Card key={file.public_id} className="overflow-hidden">
                <div className="h-32 bg-gray-100 flex items-center justify-center">
                  {file.resource_type === "image" ? (
                    <img
                      src={file.secure_url}
                      alt={file.public_id}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileText className="h-10 w-10 text-gray-400" />
                  )}
                </div>
                <CardContent className="p-2 space-y-1">
                  <p className="text-xs font-medium truncate" title={file.public_id}>
                    {file.public_id.split("/").pop()}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{formatBytes(file.bytes)}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteFileTarget(file)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(file.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
            {files.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground py-6 text-center">
                No files uploaded yet.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!deleteUserTarget}
        onOpenChange={(open) => { if (!open) setDeleteUserTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong>{deleteUserTarget?.name}</strong> and all their trees,
            persons, relationships, and events. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={loading}>
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteFileTarget}
        onOpenChange={(open) => { if (!open) setDeleteFileTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong>{deleteFileTarget?.public_id.split("/").pop()}</strong> from
            Cloudinary. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFileTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteFile} disabled={loading}>
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
