// lib/siteSettings.ts
import { unstable_cache } from "next/cache"
import { connectDB } from "@/lib/db"
import SiteSettings from "@/lib/models/SiteSettings"

const DEFAULT_SETTINGS = {
  primaryColor: "oklch(0.596 0.145 162.5)",
  fontFamily: "Inter",
  fontSize: "md" as "sm" | "md" | "lg" | "xl",
  borderRadius: 0.625,
}

export type SiteSettingsData = typeof DEFAULT_SETTINGS

const FONT_SIZE_MAP: Record<string, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
  xl: "20px",
}

const FONT_URL_MAP: Record<string, string> = {
  Inter: "Inter:wght@400;500;600;700",
  Roboto: "Roboto:wght@400;500;700",
  "Playfair Display": "Playfair+Display:wght@400;600;700",
  Lato: "Lato:wght@400;700",
  Merriweather: "Merriweather:wght@400;700",
}

export const getSiteSettings = unstable_cache(
  async (): Promise<SiteSettingsData> => {
    await connectDB()
    const doc = await SiteSettings.findOne().lean() as SiteSettingsData | null
    if (!doc) return DEFAULT_SETTINGS
    return {
      primaryColor: doc.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
      fontFamily: doc.fontFamily ?? DEFAULT_SETTINGS.fontFamily,
      fontSize: doc.fontSize ?? DEFAULT_SETTINGS.fontSize,
      borderRadius: doc.borderRadius ?? DEFAULT_SETTINGS.borderRadius,
    }
  },
  ["site-settings"],
  { revalidate: 60, tags: ["site-settings"] }
)

export function buildThemeStyle(settings: SiteSettingsData): string {
  const fontSize = FONT_SIZE_MAP[settings.fontSize] ?? "16px"
  return `:root{--primary:${settings.primaryColor};--radius:${settings.borderRadius}rem}html{font-size:${fontSize};font-family:'${settings.fontFamily}',sans-serif}`
}

export function getFontUrl(fontFamily: string): string {
  const family = FONT_URL_MAP[fontFamily] ?? FONT_URL_MAP.Inter
  return `https://fonts.googleapis.com/css2?family=${family}&display=swap`
}
