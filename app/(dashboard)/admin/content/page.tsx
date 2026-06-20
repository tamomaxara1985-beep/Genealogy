// app/(dashboard)/admin/content/page.tsx
import { getTranslations } from "next-intl/server"
import { FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContentEditor } from "@/components/admin/ContentEditor"
import { connectDB } from "@/lib/db"
import SiteContent from "@/lib/models/SiteContent"
import enMessages from "@/messages/en.json"
import heMessages from "@/messages/he.json"
import kaMessages from "@/messages/ka.json"

function flattenMessages(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce(
    (acc, [key, val]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof val === "object" && val !== null) {
        Object.assign(acc, flattenMessages(val as Record<string, unknown>, fullKey))
      } else {
        acc[fullKey] = String(val)
      }
      return acc
    },
    {} as Record<string, string>
  )
}

const DEFAULT_MESSAGES: Record<string, Record<string, string>> = {
  en: flattenMessages(enMessages as unknown as Record<string, unknown>),
  he: flattenMessages(heMessages as unknown as Record<string, unknown>),
  ka: flattenMessages(kaMessages as unknown as Record<string, unknown>),
}

async function getOverridesForLocale(locale: string) {
  await connectDB()
  const docs = await SiteContent.find({ locale }).lean()
  return Object.fromEntries(
    docs.map((d) => [d.key, { _id: String(d._id), key: d.key, value: d.value }])
  )
}

export default async function AdminContentPage() {
  const [enOverrides, heOverrides, kaOverrides, t] = await Promise.all([
    getOverridesForLocale("en"),
    getOverridesForLocale("he"),
    getOverridesForLocale("ka"),
    getTranslations("admin"),
  ])

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">{t("content")}</h1>
      </div>

      <Tabs defaultValue="en">
        <TabsList>
          <TabsTrigger value="en">EN</TabsTrigger>
          <TabsTrigger value="he">HE</TabsTrigger>
          <TabsTrigger value="ka">KA</TabsTrigger>
        </TabsList>
        <TabsContent value="en" className="mt-4">
          <ContentEditor defaults={DEFAULT_MESSAGES.en} initialOverrides={enOverrides} locale="en" />
        </TabsContent>
        <TabsContent value="he" className="mt-4">
          <ContentEditor defaults={DEFAULT_MESSAGES.he} initialOverrides={heOverrides} locale="he" />
        </TabsContent>
        <TabsContent value="ka" className="mt-4">
          <ContentEditor defaults={DEFAULT_MESSAGES.ka} initialOverrides={kaOverrides} locale="ka" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
