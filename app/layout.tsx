// app/layout.tsx
import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { Providers } from "@/components/providers"
import { getSiteSettings, buildThemeStyle, getFontUrl } from "@/lib/siteSettings"
import "./globals.css"

export const metadata: Metadata = {
  title: "FamilyRoots — Discover Your Family History",
  description: "Build, explore, and share your family tree with AI-powered tools",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const settings = await getSiteSettings()
  const themeStyle = buildThemeStyle(settings)
  const fontUrl = getFontUrl(settings.fontFamily)

  return (
    <html lang={locale} dir={locale === "he" ? "rtl" : "ltr"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={fontUrl} rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
