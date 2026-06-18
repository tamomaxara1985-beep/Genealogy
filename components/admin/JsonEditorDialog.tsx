"use client"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const READ_ONLY_KEYS = ["_id", "__v", "createdAt", "updatedAt"]

interface JsonEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  doc: Record<string, unknown> | null
  onSave: (data: Record<string, unknown>) => Promise<void>
}

export function JsonEditorDialog({
  open,
  onOpenChange,
  title,
  doc,
  onSave,
}: JsonEditorDialogProps) {
  const readOnly = Object.fromEntries(
    Object.entries(doc ?? {}).filter(([k]) => READ_ONLY_KEYS.includes(k))
  )

  const [text, setText] = useState(() => {
    const editableDoc = Object.fromEntries(
      Object.entries(doc ?? {}).filter(([k]) => !READ_ONLY_KEYS.includes(k))
    )
    return JSON.stringify(editableDoc, null, 2)
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const editableDoc = Object.fromEntries(
      Object.entries(doc ?? {}).filter(([k]) => !READ_ONLY_KEYS.includes(k))
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(JSON.stringify(editableDoc, null, 2))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null)
  }, [doc])

  async function handleSave() {
    try {
      const parsed = JSON.parse(text)
      setSaving(true)
      await onSave(parsed)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof SyntaxError ? `JSON error: ${(e as SyntaxError).message}` : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {Object.keys(readOnly).length > 0 && (
          <div className="rounded-md bg-gray-50 border p-3 text-xs font-mono space-y-1">
            {Object.entries(readOnly).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-400 w-24 flex-shrink-0">{k}:</span>
                <span className="text-gray-600 break-all">{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null) }}
          className="w-full h-64 font-mono text-xs border rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          spellCheck={false}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
