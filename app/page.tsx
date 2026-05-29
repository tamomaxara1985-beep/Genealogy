import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b bg-white/80 backdrop-blur">
        <span className="text-2xl font-bold text-amber-800">FamilyRoots</span>
        <div className="flex gap-3">
          <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button nativeButton={false} render={<Link href="/register" />}>Get started</Button>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto text-center py-24 px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-6">
          Discover Your
          <br />
          <span className="text-amber-700">Family Story</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Build your family tree, upload old documents, and let AI help uncover
          your ancestors&apos; stories.
        </p>
        <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
          Start your free tree
        </Button>
      </section>

      <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 px-8 pb-24">
        {[
          {
            title: "Visual Tree Builder",
            desc: "Drag-and-drop interface to build your family tree",
          },
          {
            title: "AI Story Generation",
            desc: "Generate life stories from names, dates, and places",
          },
          {
            title: "Document OCR",
            desc: "Upload birth certificates and extract data automatically",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-white rounded-xl shadow-sm p-6 border"
          >
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
