import { Palette } from "lucide-react"
import { ThemeEditor } from "@/components/admin/ThemeEditor"
import { getSiteSettings } from "@/lib/siteSettings"

export default async function AdminThemePage() {
  const settings = await getSiteSettings()
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">Theme</h1>
      </div>
      <ThemeEditor initial={settings} />
    </div>
  )
}
