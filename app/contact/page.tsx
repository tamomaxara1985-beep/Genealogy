import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import ContactInfo from "@/lib/models/ContactInfo"
import type { IContactInfoDoc } from "@/lib/models/ContactInfo"
import { ContactForm } from "@/components/contact/ContactForm"
import { Navbar } from "@/components/layout/Navbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { ChatWidget } from "@/components/ai/ChatWidget"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Phone, Mail, Clock, ExternalLink, TreePine } from "lucide-react"

export const metadata = { title: "Contact — FamilyRoots" }

type Info = Pick<IContactInfoDoc, "orgName" | "address" | "mapQuery" | "phone" | "email" | "hours" | "socials">

export default async function ContactPage() {
  const [session, t] = await Promise.all([auth(), getTranslations("contact")])
  await connectDB()
  const info = await ContactInfo.findOne().lean<Info | null>()

  const mapQ = (info?.mapQuery || info?.address || "").trim()
  const mapSrc = mapQ ? `https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed` : ""
  const mapLink = mapQ ? `https://www.google.com/maps?q=${encodeURIComponent(mapQ)}` : ""

  const content = (
    <>
      <h1 className="text-4xl font-bold tracking-tight text-[#26332c]">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-[#5a6e62]">{t("intro")}</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Left: info + map */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{info?.orgName || t("notSet")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {info?.address && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                  <span className="whitespace-pre-line">{info.address}</span>
                </p>
              )}
              {info?.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0 text-emerald-700" />
                  <a href={`tel:${info.phone}`} className="hover:underline">{info.phone}</a>
                </p>
              )}
              {info?.email && (
                <p className="flex items-center gap-2">
                  <Mail className="size-4 shrink-0 text-emerald-700" />
                  <a href={`mailto:${info.email}`} className="hover:underline">{info.email}</a>
                </p>
              )}
              {info?.hours && info.hours.length > 0 && (
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                  <table className="text-sm">
                    <tbody>
                      {info.hours.map((h, i) => (
                        <tr key={i}>
                          <td className="pr-4 font-medium">{h.days}</td>
                          <td className="text-[#5a6e62]">{h.hours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {info?.socials && info.socials.length > 0 && (
                <div className="pt-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#79897e]">{t("follow")}</p>
                  <div className="flex flex-wrap gap-2">
                    {info.socials.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/20 bg-white px-3 py-1 text-xs text-[#3c4c43] hover:bg-emerald-50"
                      >
                        <ExternalLink className="size-3" />
                        {s.platform.charAt(0).toUpperCase() + s.platform.slice(1)}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {mapSrc && (
            <div className="overflow-hidden rounded-xl border border-emerald-800/15 bg-white">
              <iframe
                title={t("map")}
                src={mapSrc}
                loading="lazy"
                className="h-64 w-full border-0"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="border-t border-emerald-800/10 px-4 py-2 text-sm">
                <a href={mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-emerald-800 hover:underline">
                  <ExternalLink className="size-3.5" /> {t("viewOnMap")}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right: form */}
        <Card>
          <CardHeader><CardTitle>{t("formTitle")}</CardTitle></CardHeader>
          <CardContent><ContactForm /></CardContent>
        </Card>
      </div>
    </>
  )

  // Logged-in visitors stay inside the dashboard shell (nav + sidebar preserved)
  // so navigating to Contact never looks like a sign-out.
  if (session?.user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6 bg-gray-50">
            <div className="mx-auto max-w-5xl">{content}</div>
          </main>
        </div>
        <ChatWidget />
      </div>
    )
  }

  // Anonymous marketing visitors get the standalone public page.
  return (
    <div className="min-h-dvh bg-[#eef5ef] text-[#33413a]">
      <header className="border-b border-emerald-800/15">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[#2c3a33]">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-700/10 text-emerald-800">
              <TreePine className="size-4" />
            </span>
            FamilyRoots
          </Link>
          <Link href="/login" className="text-sm text-[#4c5f54] hover:text-[#2c3a33]">
            {/* Sign-in link is intentionally plain to match the marketing header */}
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">{content}</main>
    </div>
  )
}
