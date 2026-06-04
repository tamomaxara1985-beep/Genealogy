"use client"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "ka", label: "KA" },
  { code: "he", label: "HE" },
]

export function LanguageSwitcher() {
  const router = useRouter()
  const locale = useLocale()

  function handleChange(newLocale: string) {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`
    router.refresh()
  }

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-20 h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map(({ code, label }) => (
          <SelectItem key={code} value={code}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
