import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-amber-500 text-lg">
          Genealogy
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-amber-500"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
