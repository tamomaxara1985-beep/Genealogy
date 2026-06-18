"use client"
import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { JsonEditorDialog } from "@/components/admin/JsonEditorDialog"
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react"

interface CollectionTableProps {
  collection: string
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`)
    return r.json()
  })

export function CollectionTable({ collection }: CollectionTableProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [editDoc, setEditDoc] = useState<Record<string, unknown> | null>(null)
  const [newDoc, setNewDoc] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  const [confirmInput, setConfirmInput] = useState("")
  const [deleting, setDeleting] = useState(false)

  const url = `/api/admin/collections/${collection}?page=${page}&limit=20${search ? `&q=${encodeURIComponent(search)}` : ""}`
  const { data, mutate, isLoading } = useSWR<{
    docs: Record<string, unknown>[]
    total: number
    page: number
    pages: number
  }>(url, fetcher)

  const columns =
    data?.docs.length
      ? Object.keys(data.docs[0])
          .filter((k) => k !== "__v")
          .slice(0, 6)
      : []

  function cellValue(val: unknown): string {
    if (val === null || val === undefined) return "—"
    if (typeof val === "object") return JSON.stringify(val).slice(0, 40) + "…"
    return String(val).slice(0, 60)
  }

  async function handleSaveEdit(parsed: Record<string, unknown>) {
    if (!editDoc) return
    await fetch(`/api/admin/collections/${collection}/${editDoc._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    })
    mutate()
  }

  async function handleCreate(parsed: Record<string, unknown>) {
    await fetch(`/api/admin/collections/${collection}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    })
    mutate()
  }

  async function handleDelete() {
    if (!deleteTarget || confirmInput !== collection) return
    setDeleting(true)
    await fetch(`/api/admin/collections/${collection}/${deleteTarget.id}`, { method: "DELETE" })
    setDeleting(false)
    setDeleteTarget(null)
    setConfirmInput("")
    mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setSearch(searchInput); setPage(1) }
          }}
          className="max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={() => { setSearch(searchInput); setPage(1) }}>
          Search
        </Button>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setNewDoc(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Document
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="text-left px-3 py-2 font-medium text-gray-600">
                    {col}
                  </th>
                ))}
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {data?.docs.map((doc) => (
                <tr key={String(doc._id)} className="border-b last:border-0 hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 text-gray-700 max-w-[200px] truncate">
                      {cellValue(doc[col])}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setEditDoc(doc)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() =>
                          setDeleteTarget({
                            id: String(doc._id),
                            label: String(doc.name ?? doc.firstName ?? doc._id),
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.docs.length && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                    No documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground">
            Page {data.page} of {data.pages} ({data.total} total)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <JsonEditorDialog
        open={!!editDoc}
        onOpenChange={(open) => { if (!open) setEditDoc(null) }}
        title={`Edit ${collection} document`}
        doc={editDoc}
        onSave={handleSaveEdit}
      />

      <JsonEditorDialog
        open={newDoc}
        onOpenChange={setNewDoc}
        title={`New ${collection} document`}
        doc={{}}
        onSave={handleCreate}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setConfirmInput("") } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong>{deleteTarget?.label}</strong>. This cannot be undone.
          </p>
          <p className="text-sm">
            Type <strong>{collection}</strong> to confirm:
          </p>
          <Input
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={collection}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setConfirmInput("") }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmInput !== collection || deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
