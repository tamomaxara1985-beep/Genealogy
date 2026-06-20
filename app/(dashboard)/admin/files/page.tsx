// app/(dashboard)/admin/files/page.tsx
"use client"
import { useState } from "react"
import useSWR from "swr"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FolderOpen, FileText, Trash2 } from "lucide-react"

interface CloudinaryResource {
  public_id: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  created_at: string
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`)
    return r.json()
  })

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AdminFilesPage() {
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const { data: files = [], mutate } = useSWR<CloudinaryResource[]>("/api/admin/files", fetcher)
  const [deleteTarget, setDeleteTarget] = useState<CloudinaryResource | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setLoading(true)
    const res = await fetch("/api/admin/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicId: deleteTarget.public_id,
        resourceType: deleteTarget.resource_type,
      }),
    })
    if (res.ok) {
      await mutate()
      setDeleteTarget(null)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">{t("filesCount", { count: files.length })}</h1>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {files.map((file) => (
          <Card key={file.public_id} className="overflow-hidden">
            <div className="h-32 bg-gray-100 flex items-center justify-center">
              {file.resource_type === "image" ? (
                <img src={file.secure_url} alt={file.public_id} className="h-full w-full object-cover" />
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
                  onClick={() => setDeleteTarget(file)}
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
            {t("noFiles")}
          </p>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteFile")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("deleteFileDesc", { name: deleteTarget?.public_id.split("/").pop() ?? "" })}
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
