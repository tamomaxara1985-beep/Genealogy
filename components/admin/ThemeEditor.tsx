"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ThemePreview } from "@/components/admin/ThemePreview"
import { hexToOklch, oklchToHex } from "@/lib/colorUtils"
import type { SiteSettingsData } from "@/lib/siteSettings"

const FONT_FAMILIES = ["Inter", "Roboto", "Playfair Display", "Lato", "Merriweather"]
const FONT_SIZES = [
  { value: "sm", label: "Small (14px)" },
  { value: "md", label: "Medium (16px)" },
  { value: "lg", label: "Large (18px)" },
  { value: "xl", label: "XL (20px)" },
]

export function ThemeEditor({ initial }: { initial: SiteSettingsData }) {
  const router = useRouter()
  const [settings, setSettings] = useState<SiteSettingsData>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof SiteSettingsData>(key: K, value: SiteSettingsData[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    if (res.ok) {
      setSaved(true)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Primary Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={oklchToHex(settings.primaryColor)}
              onChange={(e) => set("primaryColor", hexToOklch(e.target.value))}
              className="h-10 w-16 cursor-pointer rounded border p-1"
            />
            <span className="text-sm font-mono text-muted-foreground">{settings.primaryColor}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select value={settings.fontFamily} onValueChange={(v) => { if (v) set("fontFamily", v) }}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Font Size</Label>
          <Select value={settings.fontSize} onValueChange={(v) => set("fontSize", v as SiteSettingsData["fontSize"])}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Border Radius: {settings.borderRadius}rem</Label>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.125}
            value={settings.borderRadius}
            onChange={(e) => set("borderRadius", parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving..." : saved ? "Saved" : "Save Theme"}
        </Button>
      </div>

      <ThemePreview
        primaryColor={settings.primaryColor}
        fontFamily={settings.fontFamily}
        fontSize={settings.fontSize}
        borderRadius={settings.borderRadius}
      />
    </div>
  )
}
