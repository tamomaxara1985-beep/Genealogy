// lib/siteContent.ts
import { connectDB } from "@/lib/db"
import SiteContent from "@/lib/models/SiteContent"

export async function getSiteContent(locale: string): Promise<{ key: string; value: string }[]> {
  await connectDB()
  const docs = await SiteContent.find({ locale }).lean()
  return docs.map((d) => ({ key: d.key, value: d.value }))
}

export function applyContentOverrides(
  messages: Record<string, unknown>,
  overrides: { key: string; value: string }[]
): Record<string, unknown> {
  const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"])
  const result = structuredClone(messages)
  for (const { key, value } of overrides) {
    const parts = key.split(".")
    let obj = result as Record<string, unknown>
    for (let i = 0; i < parts.length - 1; i++) {
      if (UNSAFE_KEYS.has(parts[i])) break  // skip prototype pollution attempt
      if (typeof obj[parts[i]] !== "object" || obj[parts[i]] === null) {
        obj[parts[i]] = {}
      }
      obj = obj[parts[i]] as Record<string, unknown>
    }
    const lastKey = parts[parts.length - 1]
    if (!UNSAFE_KEYS.has(lastKey)) {
      obj[lastKey] = value
    }
  }
  return result
}
