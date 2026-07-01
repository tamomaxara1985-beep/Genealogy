# Contact Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public Contact page (org info, embedded map, social links, and a validated "Contact Us" form that stores messages) plus an admin panel to edit all contact information and manage submitted messages, in English/Georgian/Hebrew.

**Architecture:** A `ContactInfo` singleton document (mirrors `SiteSettings`) holds all editable info; a `ContactMessage` collection stores form submissions. The public `/contact` server component reads `ContactInfo` directly and renders info + a Google-Maps embed + a client form that POSTs to a public `/api/contact` route (honeypot + validation + store). Admin routes (all `getAdminSession`-gated) edit the info and manage messages; a new `/admin/contact` page drives them.

**Tech Stack:** Next.js 16 (App Router), React 19, Mongoose 9, next-intl 4, SWR, shadcn/ui (Base UI), Vitest 3, TypeScript.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/components/...`, `@/types`.
- Mongoose models export with hot-reload guard: `models.X ?? model("X", Schema)`.
- Every admin API handler enforces `getAdminSession()` from `@/lib/adminAuth` → `403` when not admin, before any DB work. The public `POST /api/contact` has NO auth.
- Supported locales: `en`, `ka` (Georgian), `he` (Hebrew, RTL). All three message files must gain identical keys. RTL is already handled by the root layout (`dir`).
- Social platforms, exact set (verbatim): `facebook, x, instagram, linkedin, youtube, tiktok, telegram, whatsapp, website`.
- Message status enum, exact: `new`, `read`.
- Do NOT use lucide brand icons (Facebook/Instagram/etc.) — this lucide-react version removed them. Use the generic `ExternalLink` icon plus a capitalized platform label for socials. `Mail` (sidebar) and `ExternalLink` are standard and available.
- Tests run with `npm test` (`vitest run`).
- Public page + form are public; anti-spam is a hidden honeypot field named `company` only (no captcha, no rate limiting).

---

### Task 1: Data models

**Files:**
- Create: `lib/models/ContactInfo.ts`
- Create: `lib/models/ContactMessage.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ContactInfo` default export; `IContactInfoDoc` with `{ orgName, address, mapQuery, phone, email: string; hours: {days,hours}[]; socials: {platform,url}[] }`.
  - `ContactMessage` default export; `IContactMessageDoc` with `{ fullName, email, subject, message: string; status: "new"|"read" }`.

- [ ] **Step 1: Create `lib/models/ContactInfo.ts`**

```ts
import { Schema, Document, models, model } from "mongoose";

export interface IContactInfoDoc extends Document {
  orgName: string;
  address: string;
  mapQuery: string;
  phone: string;
  email: string;
  hours: { days: string; hours: string }[];
  socials: { platform: string; url: string }[];
  updatedAt: Date;
}

const HourSchema = new Schema(
  { days: { type: String, default: "" }, hours: { type: String, default: "" } },
  { _id: false }
);
const SocialSchema = new Schema(
  { platform: { type: String, default: "" }, url: { type: String, default: "" } },
  { _id: false }
);

const ContactInfoSchema = new Schema<IContactInfoDoc>(
  {
    orgName: { type: String, default: "" },
    address: { type: String, default: "" },
    mapQuery: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    hours: { type: [HourSchema], default: [] },
    socials: { type: [SocialSchema], default: [] },
  },
  { timestamps: true }
);

export default models.ContactInfo ?? model<IContactInfoDoc>("ContactInfo", ContactInfoSchema);
```

- [ ] **Step 2: Create `lib/models/ContactMessage.ts`**

```ts
import { Schema, Document, models, model } from "mongoose";

export interface IContactMessageDoc extends Document {
  fullName: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read";
  createdAt: Date;
  updatedAt: Date;
}

const ContactMessageSchema = new Schema<IContactMessageDoc>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["new", "read"], default: "new" },
  },
  { timestamps: true }
);

export default models.ContactMessage ?? model<IContactMessageDoc>("ContactMessage", ContactMessageSchema);
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors in the two new model files.

- [ ] **Step 4: Commit**

```bash
git add lib/models/ContactInfo.ts lib/models/ContactMessage.ts
git commit -m "feat: add ContactInfo + ContactMessage models"
```

---

### Task 2: Constants + validators (TDD)

**Files:**
- Create: `lib/contact.ts`
- Test: `lib/contact.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SOCIAL_PLATFORMS: readonly SocialPlatform[]`, `type SocialPlatform`.
  - `validateContactMessage(input: unknown): { ok: true; value: { fullName, email, subject, message: string } } | { ok: false; error: string }`.
  - `validateContactInfo(input: unknown): { ok: true; value: { orgName, address, mapQuery, phone, email: string; hours: {days,hours}[]; socials: {platform,url}[] } } | { ok: false; error: string }`.

- [ ] **Step 1: Write the failing test — create `lib/contact.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateContactMessage, validateContactInfo } from "./contact";

const MSG = { fullName: "Jane Roe", email: "jane@example.com", subject: "Hi", message: "Hello there" };

describe("validateContactMessage", () => {
  it("accepts a valid payload and trims", () => {
    const r = validateContactMessage({ ...MSG, fullName: "  Jane Roe  " });
    expect(r).toEqual({ ok: true, value: MSG });
  });

  it("rejects each missing field", () => {
    for (const k of ["fullName", "email", "subject", "message"]) {
      expect(validateContactMessage({ ...MSG, [k]: "  " }).ok).toBe(false);
    }
    expect(validateContactMessage({}).ok).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(validateContactMessage({ ...MSG, email: "nope" }).ok).toBe(false);
  });

  it("rejects an over-long message", () => {
    expect(validateContactMessage({ ...MSG, message: "x".repeat(5001) }).ok).toBe(false);
    expect(validateContactMessage({ ...MSG, subject: "x".repeat(201) }).ok).toBe(false);
  });
});

describe("validateContactInfo", () => {
  it("sanitizes scalars and defaults arrays", () => {
    const r = validateContactInfo({ orgName: "  Acme ", phone: " 123 " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.orgName).toBe("Acme");
      expect(r.value.phone).toBe("123");
      expect(r.value.hours).toEqual([]);
      expect(r.value.socials).toEqual([]);
      expect(r.value.address).toBe("");
    }
  });

  it("drops empty hour rows and keeps filled ones", () => {
    const r = validateContactInfo({ hours: [{ days: "Mon–Fri", hours: "9–5" }, { days: "", hours: "" }] });
    expect(r.ok && r.value.hours).toEqual([{ days: "Mon–Fri", hours: "9–5" }]);
  });

  it("keeps only known-platform socials with a valid url", () => {
    const r = validateContactInfo({
      socials: [
        { platform: "facebook", url: "https://fb.com/x" },
        { platform: "myspace", url: "https://m.com" },
        { platform: "x", url: "not-a-url" },
      ],
    });
    expect(r.ok && r.value.socials).toEqual([{ platform: "facebook", url: "https://fb.com/x" }]);
  });

  it("rejects a malformed email when present", () => {
    expect(validateContactInfo({ email: "bad" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- contact`
Expected: FAIL — `./contact` has no exports yet.

- [ ] **Step 3: Implement `lib/contact.ts`**

```ts
export const SOCIAL_PLATFORMS = [
  "facebook", "x", "instagram", "linkedin", "youtube", "tiktok", "telegram", "whatsapp", "website",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

type MsgResult =
  | { ok: true; value: { fullName: string; email: string; subject: string; message: string } }
  | { ok: false; error: string };

type InfoValue = {
  orgName: string; address: string; mapQuery: string; phone: string; email: string;
  hours: { days: string; hours: string }[];
  socials: { platform: string; url: string }[];
};
type InfoResult = { ok: true; value: InfoValue } | { ok: false; error: string };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function isEmail(v: string): boolean {
  const at = v.indexOf("@");
  return at > 0 && at < v.length - 1 && !v.includes(" ");
}
function isUrl(v: string): boolean {
  return /^https?:\/\/\S+$/.test(v);
}

export function validateContactMessage(input: unknown): MsgResult {
  const o = (input ?? {}) as Record<string, unknown>;
  const fullName = str(o.fullName);
  const email = str(o.email);
  const subject = str(o.subject);
  const message = str(o.message);

  if (!fullName) return { ok: false, error: "fullName is required" };
  if (!email) return { ok: false, error: "email is required" };
  if (!isEmail(email)) return { ok: false, error: "invalid email" };
  if (!subject) return { ok: false, error: "subject is required" };
  if (!message) return { ok: false, error: "message is required" };
  if (fullName.length > 200 || email.length > 200 || subject.length > 200)
    return { ok: false, error: "field too long" };
  if (message.length > 5000) return { ok: false, error: "message too long" };

  return { ok: true, value: { fullName, email, subject, message } };
}

export function validateContactInfo(input: unknown): InfoResult {
  const o = (input ?? {}) as Record<string, unknown>;
  const email = str(o.email);
  if (email && !isEmail(email)) return { ok: false, error: "invalid email" };

  const rawHours = Array.isArray(o.hours) ? o.hours : [];
  const hours = rawHours
    .map((h) => ({ days: str((h as Record<string, unknown>)?.days), hours: str((h as Record<string, unknown>)?.hours) }))
    .filter((h) => h.days || h.hours)
    .slice(0, 20);

  const known = new Set<string>(SOCIAL_PLATFORMS);
  const rawSocials = Array.isArray(o.socials) ? o.socials : [];
  const socials = rawSocials
    .map((s) => ({ platform: str((s as Record<string, unknown>)?.platform), url: str((s as Record<string, unknown>)?.url) }))
    .filter((s) => known.has(s.platform) && isUrl(s.url))
    .slice(0, 20);

  return {
    ok: true,
    value: {
      orgName: str(o.orgName),
      address: str(o.address),
      mapQuery: str(o.mapQuery),
      phone: str(o.phone),
      email,
      hours,
      socials,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- contact`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/contact.ts lib/contact.test.ts
git commit -m "feat: contact validators + social platform constants"
```

---

### Task 3: Public contact API

**Files:**
- Create: `app/api/contact/route.ts`

**Interfaces:**
- Consumes: `validateContactMessage` (Task 2), `ContactMessage` (Task 1).
- Produces: `POST /api/contact` accepting `{ fullName, email, subject, message, company }`.

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ContactMessage from "@/lib/models/ContactMessage";
import { validateContactMessage } from "@/lib/contact";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Honeypot: bots fill the hidden "company" field. Silently accept, don't store.
  if (typeof body?.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const result = validateContactMessage(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  await ContactMessage.create(result.value);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors in `app/api/contact/route.ts`.

- [ ] **Step 3: Smoke-test the endpoint (dev server must be running on :3000)**

Run:
```bash
curl -s -X POST http://localhost:3000/api/contact -H "Content-Type: application/json" -d '{"fullName":"Test User","email":"t@e.com","subject":"Hi","message":"Hello"}'
curl -s -X POST http://localhost:3000/api/contact -H "Content-Type: application/json" -d '{"fullName":"","email":"bad","subject":"","message":""}'
curl -s -X POST http://localhost:3000/api/contact -H "Content-Type: application/json" -d '{"fullName":"Bot","email":"b@b.com","subject":"x","message":"y","company":"spam"}'
```
Expected: first → `{"ok":true}`; second → `{"error":"..."}` (400); third → `{"ok":true}` (honeypot, not stored). If the dev server is not running, skip and rely on tsc + the manual test in Task 9.

- [ ] **Step 4: Commit**

```bash
git add app/api/contact/route.ts
git commit -m "feat: public POST /api/contact with honeypot + validation"
```

---

### Task 4: Admin APIs (contact-info + contact-messages)

**Files:**
- Create: `app/api/admin/contact-info/route.ts`
- Create: `app/api/admin/contact-messages/route.ts`
- Create: `app/api/admin/contact-messages/[id]/route.ts`

**Interfaces:**
- Consumes: `getAdminSession` (`@/lib/adminAuth`), `connectDB` (`@/lib/db`), `ContactInfo`/`ContactMessage` (Task 1), `validateContactInfo` (Task 2).
- Produces:
  - `GET /api/admin/contact-info` → info doc or blank default; `PUT` → validated update.
  - `GET /api/admin/contact-messages` → array newest-first.
  - `PATCH /api/admin/contact-messages/[id]` `{ status }`; `DELETE` same path.

- [ ] **Step 1: Create `app/api/admin/contact-info/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import ContactInfo from "@/lib/models/ContactInfo";
import { validateContactInfo } from "@/lib/contact";

const BLANK = { orgName: "", address: "", mapQuery: "", phone: "", email: "", hours: [], socials: [] };

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const info = await ContactInfo.findOne().lean();
  return NextResponse.json(info ?? BLANK);
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = validateContactInfo(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  const info = await ContactInfo.findOneAndUpdate(
    {},
    { $set: result.value },
    { upsert: true, new: true }
  ).lean();
  return NextResponse.json(info);
}
```

- [ ] **Step 2: Create `app/api/admin/contact-messages/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import ContactMessage from "@/lib/models/ContactMessage";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json(messages);
}
```

- [ ] **Step 3: Create `app/api/admin/contact-messages/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import ContactMessage from "@/lib/models/ContactMessage";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body?.status !== "new" && body?.status !== "read")
    return NextResponse.json({ error: "invalid status" }, { status: 400 });

  await connectDB();
  const msg = await ContactMessage.findByIdAndUpdate(id, { $set: { status: body.status } }, { new: true }).lean();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(msg);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectDB();
  const msg = await ContactMessage.findByIdAndDelete(id).lean();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors in the three new route files.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/contact-info/route.ts app/api/admin/contact-messages
git commit -m "feat: admin contact-info + contact-messages APIs"
```

---

### Task 5: i18n — contact namespace

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ka.json`
- Modify: `messages/he.json`

**Interfaces:**
- Consumes: nothing.
- Produces: a top-level `contact` namespace (keys below) + `admin.contact` in all three locales. UI tasks depend on these keys.

- [ ] **Step 1: Add the `contact` namespace + `admin.contact` to `messages/en.json`**

Insert a new top-level `"contact"` namespace (mind JSON commas), and add `"contact": "Contact"` inside the existing `"admin"` object:

```json
  "contact": {
    "title": "Contact Us",
    "intro": "We'd love to hear from you. Reach out using the details below or send us a message.",
    "orgName": "Organization",
    "address": "Address",
    "phone": "Phone",
    "email": "Email",
    "hours": "Business hours",
    "map": "Location",
    "viewOnMap": "View on Google Maps",
    "social": "Social media",
    "follow": "Follow us",
    "notSet": "Not set",
    "formTitle": "Send us a message",
    "fullName": "Full name",
    "emailField": "Email",
    "subject": "Subject",
    "message": "Message",
    "send": "Send message",
    "sending": "Sending…",
    "sent": "Thanks! Your message has been sent.",
    "sendError": "Something went wrong. Please try again.",
    "info": "Contact information",
    "messages": "Messages",
    "addRow": "Add row",
    "remove": "Remove",
    "markRead": "Mark read",
    "status": "Status",
    "statusNew": "New",
    "statusRead": "Read",
    "noMessages": "No messages yet.",
    "platform": "Platform",
    "url": "URL",
    "save": "Save",
    "saved": "Saved",
    "days": "Days",
    "openHours": "Hours",
    "date": "Date",
    "mapQuery": "Map search (address or place)"
  }
```

Add to the `"admin"` namespace: `"contact": "Contact"`.

- [ ] **Step 2: Add the same keys to `messages/ka.json` (Georgian)**

```json
  "contact": {
    "title": "დაგვიკავშირდით",
    "intro": "სიამოვნებით მოგისმენთ. დაგვიკავშირდით ქვემოთ მოცემული დეტალებით ან გამოგვიგზავნეთ შეტყობინება.",
    "orgName": "ორგანიზაცია",
    "address": "მისამართი",
    "phone": "ტელეფონი",
    "email": "ელფოსტა",
    "hours": "სამუშაო საათები",
    "map": "მდებარეობა",
    "viewOnMap": "ნახვა Google Maps-ზე",
    "social": "სოციალური ქსელები",
    "follow": "გამოგვყევით",
    "notSet": "არ არის მითითებული",
    "formTitle": "გამოგვიგზავნეთ შეტყობინება",
    "fullName": "სახელი და გვარი",
    "emailField": "ელფოსტა",
    "subject": "თემა",
    "message": "შეტყობინება",
    "send": "შეტყობინების გაგზავნა",
    "sending": "იგზავნება…",
    "sent": "მადლობა! თქვენი შეტყობინება გაიგზავნა.",
    "sendError": "დაფიქსირდა შეცდომა. სცადეთ თავიდან.",
    "info": "საკონტაქტო ინფორმაცია",
    "messages": "შეტყობინებები",
    "addRow": "მწკრივის დამატება",
    "remove": "წაშლა",
    "markRead": "წაკითხულად მონიშვნა",
    "status": "სტატუსი",
    "statusNew": "ახალი",
    "statusRead": "წაკითხული",
    "noMessages": "შეტყობინებები ჯერ არ არის.",
    "platform": "პლატფორმა",
    "url": "URL",
    "save": "შენახვა",
    "saved": "შენახულია",
    "days": "დღეები",
    "openHours": "საათები",
    "date": "თარიღი",
    "mapQuery": "რუკის ძებნა (მისამართი ან ადგილი)"
  }
```

Add to `"admin"`: `"contact": "კონტაქტი"`.

- [ ] **Step 3: Add the same keys to `messages/he.json` (Hebrew)**

```json
  "contact": {
    "title": "צור קשר",
    "intro": "נשמח לשמוע ממך. פנה אלינו באמצעות הפרטים שלהלן או שלח לנו הודעה.",
    "orgName": "ארגון",
    "address": "כתובת",
    "phone": "טלפון",
    "email": "דוא\"ל",
    "hours": "שעות פעילות",
    "map": "מיקום",
    "viewOnMap": "הצג ב-Google Maps",
    "social": "רשתות חברתיות",
    "follow": "עקבו אחרינו",
    "notSet": "לא הוגדר",
    "formTitle": "שלחו לנו הודעה",
    "fullName": "שם מלא",
    "emailField": "דוא\"ל",
    "subject": "נושא",
    "message": "הודעה",
    "send": "שליחת הודעה",
    "sending": "שולח…",
    "sent": "תודה! הודעתך נשלחה.",
    "sendError": "משהו השתבש. נסה שוב.",
    "info": "פרטי התקשרות",
    "messages": "הודעות",
    "addRow": "הוספת שורה",
    "remove": "הסרה",
    "markRead": "סמן כנקרא",
    "status": "סטטוס",
    "statusNew": "חדש",
    "statusRead": "נקרא",
    "noMessages": "אין הודעות עדיין.",
    "platform": "פלטפורמה",
    "url": "כתובת URL",
    "save": "שמירה",
    "saved": "נשמר",
    "days": "ימים",
    "openHours": "שעות",
    "date": "תאריך",
    "mapQuery": "חיפוש במפה (כתובת או מקום)"
  }
```

Add to `"admin"`: `"contact": "צור קשר"`.

- [ ] **Step 4: Verify JSON validity + key parity**

Run:
```bash
node -e "const ks=Object.keys(require('./messages/en.json').contact).sort(); ['en','ka','he'].forEach(l=>{const m=require('./messages/'+l+'.json'); if(!m.contact||JSON.stringify(Object.keys(m.contact).sort())!==JSON.stringify(ks)) throw new Error(l+' contact keys mismatch'); if(!m.admin.contact) throw new Error(l+' admin.contact missing'); }); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/ka.json messages/he.json
git commit -m "feat: add contact i18n namespace (en/ka/he)"
```

---

### Task 6: Public /contact page + form

**Files:**
- Create: `components/contact/ContactForm.tsx`
- Create: `app/contact/page.tsx`

**Interfaces:**
- Consumes: `ContactInfo` (Task 1), `SOCIAL_PLATFORMS` type only if needed, `contact` i18n (Task 5), `POST /api/contact` (Task 3).
- Produces: a public page at `/contact`.

- [ ] **Step 1: Create the client form `components/contact/ContactForm.tsx`**

```tsx
"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ContactForm() {
  const t = useTranslations("contact")
  const [form, setForm] = useState({ fullName: "", email: "", subject: "", message: "", company: "" })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(false)

  const emailOk = /\S+@\S+/.test(form.email)
  const valid =
    form.fullName.trim() && emailOk && form.subject.trim() && form.message.trim()

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setDone(false)
    setError(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSending(true)
    setError(false)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("failed")
      setForm({ fullName: "", email: "", subject: "", message: "", company: "" })
      setDone(true)
    } catch {
      setError(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Honeypot — hidden from users, catches bots */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="company">Company</label>
        <input
          id="company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cf-name">{t("fullName")}</Label>
        <Input id="cf-name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-email">{t("emailField")}</Label>
        <Input id="cf-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-subject">{t("subject")}</Label>
        <Input id="cf-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-message">{t("message")}</Label>
        <Textarea id="cf-message" className="min-h-32" value={form.message} onChange={(e) => set("message", e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={sending || !valid} className="bg-amber-700 hover:bg-amber-800 text-amber-50">
          {sending ? t("sending") : t("send")}
        </Button>
        {done && <span className="text-sm text-green-700">{t("sent")}</span>}
        {error && <span className="text-sm text-red-600">{t("sendError")}</span>}
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create the public page `app/contact/page.tsx`**

```tsx
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { connectDB } from "@/lib/db"
import ContactInfo from "@/lib/models/ContactInfo"
import type { IContactInfoDoc } from "@/lib/models/ContactInfo"
import { ContactForm } from "@/components/contact/ContactForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Phone, Mail, Clock, ExternalLink, TreePine } from "lucide-react"

export const metadata = { title: "Contact — FamilyRoots" }

type Info = Pick<IContactInfoDoc, "orgName" | "address" | "mapQuery" | "phone" | "email" | "hours" | "socials">

export default async function ContactPage() {
  const t = await getTranslations("contact")
  await connectDB()
  const info = await ContactInfo.findOne().lean<Info | null>()

  const mapQ = (info?.mapQuery || info?.address || "").trim()
  const mapSrc = mapQ ? `https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed` : ""
  const mapLink = mapQ ? `https://www.google.com/maps?q=${encodeURIComponent(mapQ)}` : ""

  return (
    <div className="min-h-dvh bg-[#f5ecd9] text-[#41372b]">
      <header className="border-b border-amber-800/15">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[#3a2f23]">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-700/10 text-amber-800">
              <TreePine className="size-4" />
            </span>
            FamilyRoots
          </Link>
          <Link href="/login" className="text-sm text-[#5b4d3c] hover:text-[#3a2f23]">
            {/* Sign-in link is intentionally plain to match the marketing header */}
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-[#34291d]">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-[#6a5b48]">{t("intro")}</p>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {/* Left: info + map */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>{info?.orgName || t("notSet")}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {info?.address && (
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-amber-700" />
                    <span className="whitespace-pre-line">{info.address}</span>
                  </p>
                )}
                {info?.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 shrink-0 text-amber-700" />
                    <a href={`tel:${info.phone}`} className="hover:underline">{info.phone}</a>
                  </p>
                )}
                {info?.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="size-4 shrink-0 text-amber-700" />
                    <a href={`mailto:${info.email}`} className="hover:underline">{info.email}</a>
                  </p>
                )}
                {info?.hours && info.hours.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 size-4 shrink-0 text-amber-700" />
                    <table className="text-sm">
                      <tbody>
                        {info.hours.map((h, i) => (
                          <tr key={i}>
                            <td className="pr-4 font-medium">{h.days}</td>
                            <td className="text-[#6a5b48]">{h.hours}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {info?.socials && info.socials.length > 0 && (
                  <div className="pt-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8a7c66]">{t("follow")}</p>
                    <div className="flex flex-wrap gap-2">
                      {info.socials.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-800/20 bg-white px-3 py-1 text-xs text-[#4a3d2d] hover:bg-amber-50"
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
              <div className="overflow-hidden rounded-xl border border-amber-800/15 bg-white">
                <iframe
                  title={t("map")}
                  src={mapSrc}
                  loading="lazy"
                  className="h-64 w-full border-0"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="border-t border-amber-800/10 px-4 py-2 text-sm">
                  <a href={mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-amber-800 hover:underline">
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
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in the two new files. (Pre-existing `react-hooks/set-state-in-effect` in DashboardClient.tsx is unrelated.)

- [ ] **Step 4: Commit**

```bash
git add app/contact/page.tsx components/contact/ContactForm.tsx
git commit -m "feat: public /contact page with info, map embed, and form"
```

---

### Task 7: Admin contact page + sidebar link

**Files:**
- Create: `app/(dashboard)/admin/contact/page.tsx`
- Modify: `components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `SOCIAL_PLATFORMS` (Task 2), `contact` + `admin` i18n (Task 5), admin APIs (Task 4).
- Produces: `/admin/contact` admin page; sidebar link.

- [ ] **Step 1: Add the sidebar link in `components/admin/AdminSidebar.tsx`**

Add `Mail` to the lucide import (the import currently lists icons like `Users, FolderOpen, ...`):

```ts
import {
  LayoutDashboard,
  Palette,
  FileText,
  Database,
  Users,
  FolderOpen,
  ShieldCheck,
  Mail,
} from "lucide-react"
```

Add a link entry to the `links` array, after the `files` entry:

```ts
    { href: "/admin/contact", label: t("contact"), icon: Mail },
```

- [ ] **Step 2: Create `app/(dashboard)/admin/contact/page.tsx`**

```tsx
"use client"
import { useState, useEffect } from "react"
import useSWR from "swr"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { SOCIAL_PLATFORMS } from "@/lib/contact"
import { Mail, Trash2, Plus } from "lucide-react"

interface Info {
  orgName: string; address: string; mapQuery: string; phone: string; email: string
  hours: { days: string; hours: string }[]
  socials: { platform: string; url: string }[]
}
interface Message {
  _id: string; fullName: string; email: string; subject: string; message: string
  status: "new" | "read"; createdAt: string
}

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })

const BLANK: Info = { orgName: "", address: "", mapQuery: "", phone: "", email: "", hours: [], socials: [] }

export default function AdminContactPage() {
  const t = useTranslations("contact")
  const tc = useTranslations("common")

  const { data: info, mutate: mutateInfo } = useSWR<Info>("/api/admin/contact-info", fetcher)
  const { data: messages = [], mutate: mutateMsgs } = useSWR<Message[]>("/api/admin/contact-messages", fetcher)

  const [form, setForm] = useState<Info>(BLANK)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [openMsg, setOpenMsg] = useState<Message | null>(null)

  useEffect(() => {
    if (info) setForm({ ...BLANK, ...info, hours: info.hours ?? [], socials: info.socials ?? [] })
  }, [info])

  function setField(k: keyof Info, v: string) { setForm((f) => ({ ...f, [k]: v })); setSaved(false) }

  async function saveInfo() {
    setSaving(true)
    const res = await fetch("/api/admin/contact-info", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) { await mutateInfo(); setSaved(true) }
    setSaving(false)
  }

  async function markRead(id: string) {
    const res = await fetch(`/api/admin/contact-messages/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "read" }),
    })
    if (res.ok) { await mutateMsgs(); setOpenMsg(null) }
  }
  async function deleteMsg(id: string) {
    const res = await fetch(`/api/admin/contact-messages/${id}`, { method: "DELETE" })
    if (res.ok) { await mutateMsgs(); setOpenMsg(null) }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-amber-500" />
        <h1 className="text-xl font-bold">{t("info")}</h1>
      </div>

      {/* Info editor */}
      <div className="space-y-4 rounded-md border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("orgName")}</Label>
            <Input value={form.orgName} onChange={(e) => setField("orgName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("phone")}</Label>
            <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("email")}</Label>
            <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("mapQuery")}</Label>
            <Input value={form.mapQuery} onChange={(e) => setField("mapQuery", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("address")}</Label>
          <Textarea value={form.address} onChange={(e) => setField("address", e.target.value)} />
        </div>

        {/* Hours */}
        <div className="space-y-2">
          <Label>{t("hours")}</Label>
          {form.hours.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={t("days")} value={h.days}
                onChange={(e) => { const hours = [...form.hours]; hours[i] = { ...hours[i], days: e.target.value }; setForm((f) => ({ ...f, hours })); setSaved(false) }}
              />
              <Input
                placeholder={t("openHours")} value={h.hours}
                onChange={(e) => { const hours = [...form.hours]; hours[i] = { ...hours[i], hours: e.target.value }; setForm((f) => ({ ...f, hours })); setSaved(false) }}
              />
              <Button variant="outline" size="sm" className="text-destructive"
                onClick={() => setForm((f) => ({ ...f, hours: f.hours.filter((_, j) => j !== i) }))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm"
            onClick={() => setForm((f) => ({ ...f, hours: [...f.hours, { days: "", hours: "" }] }))}>
            <Plus className="mr-1 h-3.5 w-3.5" />{t("addRow")}
          </Button>
        </div>

        {/* Socials */}
        <div className="space-y-2">
          <Label>{t("social")}</Label>
          {form.socials.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={s.platform}
                onValueChange={(v) => { const socials = [...form.socials]; socials[i] = { ...socials[i], platform: v ?? "" }; setForm((f) => ({ ...f, socials })); setSaved(false) }}>
                <SelectTrigger className="w-40"><SelectValue placeholder={t("platform")} /></SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder={t("url")} value={s.url}
                onChange={(e) => { const socials = [...form.socials]; socials[i] = { ...socials[i], url: e.target.value }; setForm((f) => ({ ...f, socials })); setSaved(false) }} />
              <Button variant="outline" size="sm" className="text-destructive"
                onClick={() => setForm((f) => ({ ...f, socials: f.socials.filter((_, j) => j !== i) }))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm"
            onClick={() => setForm((f) => ({ ...f, socials: [...f.socials, { platform: "website", url: "" }] }))}>
            <Plus className="mr-1 h-3.5 w-3.5" />{t("addRow")}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={saveInfo} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
            {saving ? tc("saving") : t("save")}
          </Button>
          {saved && <span className="text-sm text-green-600">{t("saved")}</span>}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("messages")} ({messages.length})</h2>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("fullName")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("subject")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("date")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m._id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => setOpenMsg(m)}>
                  <td className="px-4 py-3 font-medium">{m.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{m.subject}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.status === "new" ? "default" : "secondary"}>
                      {m.status === "new" ? t("statusNew") : t("statusRead")}
                    </Badge>
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">{t("noMessages")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!openMsg} onOpenChange={(open) => { if (!open) setOpenMsg(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{openMsg?.subject}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">{openMsg?.fullName}</span> · <a href={`mailto:${openMsg?.email}`} className="text-amber-700 hover:underline">{openMsg?.email}</a></p>
            <p className="whitespace-pre-line text-muted-foreground">{openMsg?.message}</p>
          </div>
          <DialogFooter className="gap-2">
            {openMsg?.status === "new" && (
              <Button variant="outline" onClick={() => openMsg && markRead(openMsg._id)} className="mr-auto">{t("markRead")}</Button>
            )}
            <Button variant="outline" onClick={() => setOpenMsg(null)}>{tc("cancel")}</Button>
            <Button variant="destructive" onClick={() => openMsg && deleteMsg(openMsg._id)}>{tc("delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in the new page or `AdminSidebar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/admin/contact/page.tsx" components/admin/AdminSidebar.tsx
git commit -m "feat: admin contact page (info editor + messages) + sidebar link"
```

---

### Task 8: Landing page Contact links

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: nothing (static links to `/contact`).
- Produces: Contact links in the landing header nav and footer.

- [ ] **Step 1: Add a Contact link in the top nav**

In `app/page.tsx`, the header nav has a `<div className="flex items-center gap-2">` wrapping the Sign in / Get started buttons. Add a Contact link as the first child of that div:

```tsx
            <Button
              variant="ghost"
              className="h-9 px-3 text-[#5b4d3c] hover:bg-amber-800/10 hover:text-[#3a2f23]"
              nativeButton={false}
              render={<Link href="/contact" />}
            >
              Contact
            </Button>
```

- [ ] **Step 2: Add a Contact link in the footer**

In the footer block, the copyright `<p>` sits beside the logo. Add a link before/after it inside the footer's flex row:

```tsx
            <Link href="/contact" className="text-sm text-[#8a7c66] hover:text-[#3a2f23]">
              Contact
            </Link>
```

(Place it inside the `<div className="mx-auto flex max-w-6xl ...">` container, e.g. right before the copyright `<p>`.)

- [ ] **Step 3: Verify type-check + lint + build**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors in `app/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add Contact links to landing nav and footer"
```

---

### Task 9: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: all tests pass, including `lib/contact.test.ts`.

- [ ] **Step 2: Type-check + lint the whole project**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors (the only pre-existing lint error is `react-hooks/set-state-in-effect` at `components/dashboard/DashboardClient.tsx:34`, unrelated to this work).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/contact` appears in the route list.

- [ ] **Step 4: Manual smoke test (documented, run by human)**

1. Visit `/contact` (logged out) → page renders; submit the form → success message; the message appears under Admin → Contact → Messages.
2. As admin → Contact → edit org/address/phone/email, add an hours row and a social row, set a map search (e.g. an address) → Save. Reload `/contact` → info, hours, social chip, and embedded map all reflect the changes; "View on Google Maps" link opens.
3. Admin → Contact → Messages → open a message → Mark read (badge changes) → Delete (row disappears).
4. Switch language EN/KA/HE → labels translate; in HE the layout is RTL.
5. Non-admin `PUT /api/admin/contact-info` and `GET /api/admin/contact-messages` → 403. Honeypot: POST `/api/contact` with a non-empty `company` field → 200 but no stored message.

No commit (verification task).
