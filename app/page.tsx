"use client";

/* =========================================================================
   FamilyRoots — Landing page
   "PowerPoint in scroll": full-screen scroll-snap slides, warm heritage look.
   - <main> is the scroll container (snap-y snap-mandatory on sm+ only)
   - Each <section> is min-h-dvh: exact viewport on desktop (snap), but
     grows + free-scrolls on mobile so dense slides never clip
   - Reveal animations fire when a slide enters view (IntersectionObserver)
   - Right-side dot nav + Arrow/Page keys advance slides like a deck
   ========================================================================= */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import {
  TreePine,
  Sparkles,
  ScanText,
  Dna,
  ArrowRight,
  ArrowDown,
  Users,
  Search,
  Share2,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* Distinctive warm serif for display headings (not a generic system font). */
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

/* === DATA === */
const features = [
  {
    icon: TreePine,
    title: "Visual Tree Builder",
    desc: "Drag and drop to grow your family tree. Connect generations in a few clicks.",
  },
  {
    icon: Sparkles,
    title: "AI Story Generation",
    desc: "Turn names, dates, and places into warm, readable life stories.",
  },
  {
    icon: ScanText,
    title: "Document Scanning",
    desc: "Upload birth certificates and records — we read the details for you.",
  },
  {
    icon: Dna,
    title: "DNA Insights",
    desc: "Link DNA matches to your tree and meet relatives you never knew.",
  },
];

const steps = [
  {
    icon: Users,
    title: "Add your family",
    desc: "Start with yourself, then add parents, children, and beyond.",
  },
  {
    icon: Search,
    title: "Uncover the past",
    desc: "Scan old documents and let AI fill in the gaps.",
  },
  {
    icon: Share2,
    title: "Share the story",
    desc: "Invite relatives to explore and grow the tree together.",
  },
];

const SLIDE_LABELS = ["Home", "Story", "Features", "How it works", "Begin"];

/* === REVEAL: fades + lifts its children in when scrolled into view === */
function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown(true);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        shown
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-8 opacity-0 blur-[2px]"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/* === PRODUCT PREVIEW ============================================
   A faithful static mockup of the tree canvas, reusing the real
   node vocabulary (gender border, living bar, initials avatar, amber
   ♥ marriage line). Not a live capture — no auth/DB needed — but it
   reads as a genuine screenshot of the app on the hero.
   ================================================================ */
const border: Record<string, string> = {
  male: "border-blue-300",
  female: "border-pink-300",
};
const avatarTone: Record<string, string> = {
  male: "bg-blue-50 text-blue-700",
  female: "bg-pink-50 text-pink-700",
};

function PvCard({
  name,
  surname,
  years,
  gender,
  living = false,
}: {
  name: string;
  surname: string;
  years: string;
  gender: "male" | "female";
  living?: boolean;
}) {
  return (
    <div
      className={`w-32 select-none rounded-lg border-2 bg-white shadow-sm sm:w-36 ${border[gender]}`}
    >
      <div className={`h-1 rounded-t-md ${living ? "bg-green-400" : "bg-gray-300"}`} />
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="relative flex-shrink-0">
          <div
            className={`flex size-8 items-center justify-center rounded-full text-[11px] font-semibold ${avatarTone[gender]}`}
          >
            {name[0]}
            {surname[0]}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${
              living ? "bg-green-400" : "bg-gray-400"
            }`}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold leading-tight text-gray-800">
            {name}
          </p>
          <p className="truncate text-[11px] leading-tight text-gray-500">{surname}</p>
          <p className="truncate text-[9px] leading-tight text-gray-400">{years}</p>
        </div>
      </div>
    </div>
  );
}

function Marriage() {
  return (
    <div className="flex w-7 flex-shrink-0 items-center">
      <div className="h-px flex-1 bg-amber-400" />
      <span className="mx-0.5 text-xs leading-none text-amber-500">♥</span>
      <div className="h-px flex-1 bg-amber-400" />
    </div>
  );
}

function TreePreview() {
  return (
    <div className="w-full max-w-md rounded-xl border border-amber-900/10 bg-white shadow-2xl shadow-amber-950/15 ring-1 ring-black/5">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 rounded-t-xl border-b border-gray-100 bg-gray-50 px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-400/80" />
        <span className="size-2.5 rounded-full bg-amber-400/80" />
        <span className="size-2.5 rounded-full bg-green-400/80" />
        <span className="ml-2 truncate rounded-md bg-white px-2 py-0.5 text-[10px] text-gray-400 ring-1 ring-gray-200">
          familyroots.app/trees/hale-family
        </span>
      </div>
      {/* Canvas — react-flow style dotted grid */}
      <div className="rounded-b-xl bg-[#fbfbf9] bg-[radial-gradient(#0000000d_1px,transparent_1px)] [background-size:14px_14px]">
        <div className="flex flex-col items-center gap-0 px-4 py-6">
          {/* Grandparents */}
          <div className="flex items-center">
            <PvCard name="Thomas" surname="Hale" years="1898–1974" gender="male" />
            <Marriage />
            <PvCard name="Margaret" surname="Hale" years="1901–1989" gender="female" />
          </div>
          <span className="h-5 w-px bg-gray-300" />
          {/* Parents */}
          <div className="flex items-center">
            <PvCard name="James" surname="Hale" years="b. 1956" gender="male" living />
            <Marriage />
            <PvCard name="Eleanor" surname="Hale" years="b. 1959" gender="female" living />
          </div>
          {/* Split connector to children */}
          <span className="h-4 w-px bg-gray-300" />
          <div className="flex w-40 items-start justify-between">
            <span className="h-4 w-1/2 rounded-tl-md border-l border-t border-gray-300" />
            <span className="h-4 w-1/2 rounded-tr-md border-r border-t border-gray-300" />
          </div>
          <div className="flex gap-3">
            <PvCard name="Sophie" surname="Hale" years="b. 1988" gender="female" living />
            <PvCard name="Noah" surname="Hale" years="b. 1991" gender="male" living />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(0);

  /* Track which slide fills the viewport for the dot nav. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const sections = Array.from(scroller.querySelectorAll("section"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = sections.indexOf(e.target as HTMLElement);
            if (idx !== -1) setActive(idx);
          }
        }
      },
      { threshold: 0.55 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const goTo = useCallback((idx: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const sections = Array.from(scroller.querySelectorAll("section"));
    const clamped = Math.max(0, Math.min(idx, sections.length - 1));
    sections[clamped]?.scrollIntoView({ behavior: "smooth" });
  }, []);

  /* Arrow / Page / Space keys advance the deck. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey)) {
        e.preventDefault();
        goTo(active + 1);
      } else if (["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey)) {
        e.preventDefault();
        goTo(active - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(SLIDE_LABELS.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo]);

  return (
    <main
      ref={scrollerRef}
      className={`${display.variable} relative h-dvh overflow-y-scroll scroll-smooth bg-[#f5ecd9] text-[#41372b] sm:snap-y sm:snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
    >
      {/* === Parchment grain overlay (fixed, very subtle) === */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.05] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* === Fixed top nav === */}
      <header className="fixed inset-x-0 top-0 z-50">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <button
            onClick={() => goTo(0)}
            className="flex items-center gap-2.5"
            aria-label="FamilyRoots — go to top"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-700/10 text-amber-800 ring-1 ring-amber-800/15">
              <TreePine className="size-5" aria-hidden />
            </span>
            <span
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-2xl font-semibold tracking-tight text-[#3a2f23]"
            >
              FamilyRoots
            </span>
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-9 px-3 text-[#5b4d3c] hover:bg-amber-800/10 hover:text-[#3a2f23]"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              Sign in
            </Button>
            <Button
              className="h-9 bg-amber-700 px-4 text-amber-50 shadow-sm hover:bg-amber-800"
              nativeButton={false}
              render={<Link href="/register" />}
            >
              Get started
            </Button>
          </div>
        </nav>
      </header>

      {/* === Right-side slide dots === */}
      <nav
        aria-label="Slides"
        className="fixed right-5 top-1/2 z-50 hidden -translate-y-1/2 flex-col items-center gap-3.5 sm:flex"
      >
        {SLIDE_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => goTo(i)}
            aria-label={`Go to ${label}`}
            aria-current={active === i}
            className="group relative flex items-center"
          >
            <span className="pointer-events-none absolute right-6 whitespace-nowrap rounded-md bg-[#3a2f23] px-2 py-1 text-xs font-medium text-amber-50 opacity-0 transition-opacity group-hover:opacity-100">
              {label}
            </span>
            <span
              className={`block rounded-full ring-1 ring-amber-800/40 transition-all duration-300 ${
                active === i
                  ? "size-3 bg-amber-700"
                  : "size-2 bg-transparent group-hover:bg-amber-700/40"
              }`}
            />
          </button>
        ))}
      </nav>

      {/* ===================================================================
          SLIDE 1 — HERO
          =================================================================== */}
      <section

        className="relative flex min-h-dvh snap-start snap-always items-center justify-center overflow-hidden px-5"
      >
        {/* Layered warm backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-[#faf4e6] via-[#f5ecd9] to-[#efe2c6]" />
          <div className="absolute left-1/2 top-[-10rem] size-[46rem] -translate-x-1/2 rounded-full bg-amber-300/30 blur-3xl" />
          <div className="absolute bottom-[-12rem] right-[-6rem] size-[34rem] rounded-full bg-orange-300/20 blur-3xl" />
          {/* Faint heritage tree lines */}
          <svg
            className="absolute inset-x-0 bottom-0 mx-auto h-[60%] w-full max-w-4xl text-amber-800/10"
            viewBox="0 0 400 260"
            fill="none"
            preserveAspectRatio="xMidYMax meet"
          >
            <path
              d="M200 250 V180 M200 180 H90 M200 180 H310 M90 180 V110 M310 180 V110 M90 110 H40 M90 110 H140 M310 110 H260 M310 110 H360 M40 110 V55 M140 110 V55 M260 110 V55 M360 110 V55"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            {[
              [200, 180],
              [90, 110],
              [310, 110],
              [40, 55],
              [140, 55],
              [260, 55],
              [360, 55],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" fill="currentColor" />
            ))}
          </svg>
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 pt-16 lg:grid-cols-2 lg:gap-12 lg:pt-0">
          {/* Text column */}
          <div className="text-center lg:text-left">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-800/20 bg-[#fcf8ee] px-3.5 py-1.5 text-sm font-medium text-amber-800 shadow-sm">
                <Sparkles className="size-3.5" aria-hidden />
                AI-powered family history
              </span>
            </Reveal>
            <Reveal delay={120}>
              <h1
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="mt-6 text-balance text-5xl font-semibold leading-[1.03] tracking-tight text-[#34291d] sm:text-6xl lg:text-7xl"
              >
                Discover your{" "}
                <span className="italic text-amber-700">family story</span>
              </h1>
            </Reveal>
            <Reveal delay={240}>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[#6a5b48] lg:mx-0">
                Build your family tree, bring old documents to life, and let AI
                uncover the stories of the people who came before you.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button
                  className="h-12 w-full gap-2 bg-amber-700 px-7 text-base text-amber-50 shadow-md hover:bg-amber-800 sm:w-auto"
                  nativeButton={false}
                  render={<Link href="/register" />}
                >
                  Start your free tree
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full border-amber-800/25 bg-[#fcf8ee] px-7 text-base text-[#4a3d2d] hover:bg-[#f3e8cf] sm:w-auto"
                  nativeButton={false}
                  render={<Link href="/login" />}
                >
                  Sign in
                </Button>
              </div>
            </Reveal>
            <Reveal delay={480}>
              <p className="mt-5 text-sm text-[#8a7c66]">
                Free to start · No credit card required
              </p>
            </Reveal>
          </div>

          {/* Product preview column */}
          <Reveal delay={300} className="flex justify-center lg:justify-end">
            <div className="motion-safe:lg:rotate-[1.5deg]">
              <TreePreview />
            </div>
          </Reveal>
        </div>

        {/* Scroll hint */}
        <button
          onClick={() => goTo(1)}
          aria-label="Next slide"
          className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 text-amber-800/60 transition-colors hover:text-amber-800 sm:block motion-safe:animate-bounce"
        >
          <ArrowDown className="size-6" aria-hidden />
        </button>
      </section>

      {/* ===================================================================
          SLIDE 2 — STATEMENT
          =================================================================== */}
      <section

        className="relative flex min-h-dvh snap-start snap-always items-center justify-center overflow-hidden bg-[#34291d] px-5 text-amber-50"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
          <div className="absolute left-1/4 top-1/3 size-[40rem] -translate-x-1/2 rounded-full bg-amber-600/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 size-[30rem] rounded-full bg-orange-700/15 blur-3xl" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">
              Why it matters
            </span>
          </Reveal>
          <Reveal delay={120}>
            <p
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="mt-8 text-balance text-4xl font-medium leading-[1.18] tracking-tight sm:text-5xl md:text-6xl"
            >
              Every name on your tree was once a{" "}
              <span className="italic text-amber-400">whole life</span> — its
              own loves, journeys, and quiet ordinary days.
            </p>
          </Reveal>
          <Reveal delay={280}>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-amber-100/70">
              FamilyRoots helps you find them, remember them, and pass their
              stories forward.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===================================================================
          SLIDE 3 — FEATURES
          =================================================================== */}
      <section

        className="relative flex min-h-dvh snap-start snap-always items-center overflow-hidden bg-gradient-to-b from-[#f5ecd9] to-[#efe2c6] px-5"
      >
        <div className="mx-auto w-full max-w-6xl py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <h2
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="text-4xl font-semibold tracking-tight text-[#34291d] sm:text-5xl"
              >
                Everything you need to trace your roots
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-4 text-lg text-[#6a5b48]">
                Friendly tools that make genealogy feel effortless.
              </p>
            </Reveal>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={200 + i * 110}>
                <div className="group h-full rounded-2xl border border-amber-800/10 bg-[#fcf8ee] p-6 shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-1.5 hover:shadow-lg hover:shadow-amber-900/5">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-700/10 text-amber-800 ring-1 ring-amber-800/10 transition-colors group-hover:bg-amber-700 group-hover:text-amber-50">
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <h3
                    style={{ fontFamily: "var(--font-fraunces)" }}
                    className="mt-5 text-xl font-semibold text-[#34291d]"
                  >
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6a5b48]">
                    {f.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          SLIDE 4 — HOW IT WORKS
          =================================================================== */}
      <section

        className="relative flex min-h-dvh snap-start snap-always items-center overflow-hidden bg-[#efe2c6] px-5"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
          <div className="absolute right-1/4 top-0 size-[34rem] rounded-full bg-amber-300/25 blur-3xl" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-6xl py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <h2
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="text-4xl font-semibold tracking-tight text-[#34291d] sm:text-5xl"
              >
                From a single name to a living history
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-4 text-lg text-[#6a5b48]">
                Three easy steps to get started.
              </p>
            </Reveal>
          </div>
          <ol className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.title} as="li" delay={200 + i * 140} className="relative text-center">
                {/* Connector line between steps (desktop) */}
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[calc(50%+2.5rem)] top-9 hidden h-px w-[calc(100%-5rem)] bg-amber-800/20 md:block"
                  />
                )}
                <span className="relative mx-auto flex size-18 items-center justify-center rounded-full bg-[#fcf8ee] text-amber-800 shadow-md ring-1 ring-amber-800/15">
                  <s.icon className="size-7" aria-hidden />
                  <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-amber-700 text-sm font-bold text-amber-50">
                    {i + 1}
                  </span>
                </span>
                <h3
                  style={{ fontFamily: "var(--font-fraunces)" }}
                  className="mt-6 text-2xl font-semibold text-[#34291d]"
                >
                  {s.title}
                </h3>
                <p className="mx-auto mt-3 max-w-xs leading-relaxed text-[#6a5b48]">
                  {s.desc}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ===================================================================
          SLIDE 5 — CLOSING CTA + FOOTER
          =================================================================== */}
      <section

        className="relative flex min-h-dvh snap-start snap-always flex-col overflow-hidden bg-gradient-to-b from-[#efe2c6] to-[#e6d3ad] px-5"
      >
        <div className="flex flex-1 items-center justify-center">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-700/15 text-amber-800 ring-1 ring-amber-800/15">
                <Heart className="size-7" aria-hidden />
              </span>
            </Reveal>
            <Reveal delay={120}>
              <h2
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="mt-7 text-balance text-5xl font-semibold tracking-tight text-[#34291d] sm:text-6xl"
              >
                Your family&apos;s story is{" "}
                <span className="italic text-amber-700">waiting</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="mx-auto mt-6 max-w-lg text-lg text-[#6a5b48]">
                Begin building your tree today — it&apos;s free to start.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <Button
                className="mt-9 h-13 gap-2 bg-amber-700 px-8 text-base text-amber-50 shadow-md hover:bg-amber-800"
                nativeButton={false}
                render={<Link href="/register" />}
              >
                Create your free account
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </Reveal>
          </div>
        </div>

        {/* Footer pinned to bottom of last slide */}
        <footer className="border-t border-amber-800/15 py-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-700/15 text-amber-800">
                <TreePine className="size-4" aria-hidden />
              </span>
              <span
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="font-semibold text-[#3a2f23]"
              >
                FamilyRoots
              </span>
            </div>
            <p className="text-sm text-[#8a7c66]">
              © {2026} FamilyRoots. Discover where you come from.
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}
