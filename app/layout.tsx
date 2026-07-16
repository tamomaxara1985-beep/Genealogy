// app/layout.tsx
import type { Metadata, Viewport } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { Providers } from "@/components/providers"
import { RegisterSW } from "@/components/pwa/RegisterSW"
import { getSiteSettings, buildThemeStyle, getFontUrl } from "@/lib/siteSettings"
import { getSiteContent, applyContentOverrides } from "@/lib/siteContent"
import "./globals.css"

export const metadata: Metadata = {
  title: "FamilyRoots — Discover Your Family History",
  description: "Build, explore, and share your family tree with AI-powered tools",
  appleWebApp: {
    capable: true,
    title: "FamilyRoots",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#059669",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const [settings, overrides] = await Promise.all([
    getSiteSettings().catch(() => null),
    getSiteContent(locale).catch(() => []),
  ])
  const themeStyle = settings ? buildThemeStyle(settings) : ""
  const fontUrl = settings ? getFontUrl(settings.fontFamily) : ""
  const mergedMessages = applyContentOverrides(messages as Record<string, unknown>, overrides)

  return (
    <html lang={locale} dir={locale === "he" ? "rtl" : "ltr"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {fontUrl && <link href={fontUrl} rel="stylesheet" />}
        {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}
      </head>
      <body>
        <RegisterSW />
        <NextIntlClientProvider locale={locale} messages={mergedMessages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
