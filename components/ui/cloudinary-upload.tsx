"use client"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

type SingleProps = {
  mode: "single"
  folder: "genealogy/photos" | "genealogy/documents"
  value: string
  onChange: (url: string) => void
  accept?: string
}

type MultiProps = {
  mode: "multi"
  folder: "genealogy/photos" | "genealogy/documents"
  value: string[]
  onChange: (urls: string[]) => void
  accept?: string
  maxFiles?: number
}

type Props = SingleProps | MultiProps

export async function uploadFile(file: File, folder: string): Promise<string> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  })
  if (!signRes.ok) throw new Error("Failed to get upload signature")
  const { signature, timestamp, apiKey, cloudName } = await signRes.json()

  const form = new FormData()
  form.append("file", file)
  form.append("api_key", apiKey)
  form.append("timestamp", String(timestamp))
  form.append("signature", signature)
  form.append("folder", folder)

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: form }
  )
  if (!uploadRes.ok) throw new Error("Upload to Cloudinary failed")
  const data = await uploadRes.json()
  if (!data.secure_url) throw new Error("Upload failed: no URL returned")
  return data.secure_url as string
}

export function CloudinaryUpload(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxFiles = props.mode === "multi" ? (props.maxFiles ?? 10) : 1

  async function handleFiles(files: FileList) {
    setError(null)
    const arr = Array.from(files)

    for (const f of arr) {
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" exceeds the 2 MB limit`)
        return
      }
    }

    setUploading(true)
    try {
      if (props.mode === "single") {
        const url = await uploadFile(arr[0], props.folder)
        props.onChange(url)
      } else {
        const remaining = maxFiles - props.value.length
        const toUpload = arr.slice(0, remaining)
        const urls = await Promise.all(toUpload.map((f) => uploadFile(f, props.folder)))
        props.onChange([...props.value, ...urls])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  if (props.mode === "single") {
    return (
      <div className="space-y-2">
        {props.value && (
          <img
            src={props.value}
            alt="Preview"
            className="h-24 w-24 rounded-md object-cover border cursor-pointer"
            onClick={() => inputRef.current?.click()}
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept={props.accept}
          className="hidden"
          onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : props.value ? "Replace photo" : "Upload photo"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // multi mode
  return (
    <div className="space-y-2">
      {props.value.length > 0 && (
        <ul className="space-y-1">
          {props.value.map((url, i) => (
            <li key={url} className="flex items-center gap-2 text-sm">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate max-w-xs text-emerald-600 hover:underline"
              >
                Document {i + 1}
              </a>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive text-xs"
                onClick={() =>
                  props.onChange(props.value.filter((_, j) => j !== i))
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={props.accept}
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
      />
      {props.value.length < maxFiles && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Add document"}
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
