"use client";
import { useState } from "react";
import Link from "next/link";
import { runSearch } from "@/hooks/useSearch";
import type { ISearchResult } from "@/types";
import { cn } from "@/lib/utils";

export default function SearchPage() {
  const [term, setTerm] = useState("");
  const [field, setField] = useState<"name" | "place">("name");
  const [results, setResults] = useState<ISearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [msgFor, setMsgFor] = useState<ISearchResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (term.trim().length < 2) return;
    setLoading(true);
    const r = await runSearch(term.trim(), field);
    setResults(r.results);
    setSearched(true);
    setLoading(false);
  }

  async function requestAccess(treeId: string) {
    await fetch(`/api/trees/${treeId}/access-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    setResults((rs) => rs.map((r) => (r.treeId === treeId ? { ...r, access: "pending" } : r)));
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Search family trees</h1>
      <form onSubmit={submit} className="flex gap-2 mb-6">
        <select
          value={field}
          onChange={(e) => setField(e.target.value as "name" | "place")}
          className="border rounded-md px-2 text-sm"
        >
          <option value="name">Name</option>
          <option value="place">Place</option>
        </select>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="First/last name or city/country…"
          className="flex-1 border rounded-md px-3 py-2 text-sm"
        />
        <button className="bg-emerald-600 text-white rounded-md px-4 text-sm font-medium">Search</button>
      </form>

      {loading && <p className="text-sm text-gray-500">Searching…</p>}
      {searched && !loading && results.length === 0 && (
        <p className="text-sm text-gray-500">No matches.</p>
      )}

      <ul className="space-y-3">
        {results.map((r) => (
          <li key={r.personId} className="border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.personName}</p>
                {r.place && <p className="text-sm text-gray-500">{r.place}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Tree: {r.treeName} · Owner: {r.ownerName}
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {(r.access === "owner" || r.access === "viewer") && (
                  <Link href={`/trees/${r.treeId}`} className="text-emerald-700 text-sm font-medium">
                    Open tree
                  </Link>
                )}
                {r.access === "none" && (
                  <>
                    <button
                      onClick={() => requestAccess(r.treeId)}
                      className="bg-emerald-600 text-white rounded-md px-3 py-1 text-xs font-medium"
                    >
                      Request access
                    </button>
                    <button
                      onClick={() => setMsgFor(r)}
                      className="border rounded-md px-3 py-1 text-xs font-medium"
                    >
                      Message owner
                    </button>
                  </>
                )}
                {r.access === "pending" && (
                  <span className={cn("text-xs text-amber-600 font-medium")}>Requested</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {msgFor && <MessageDialog result={msgFor} onClose={() => setMsgFor(null)} />}
    </div>
  );
}

function MessageDialog({ result, onClose }: { result: ISearchResult; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    await fetch(`/api/trees/${result.treeId}/contact-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    });
    setSent(true);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-3">Message {result.ownerName}</h2>
        {sent ? (
          <p className="text-sm text-emerald-700">Message sent.</p>
        ) : (
          <>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full border rounded-md px-3 py-2 text-sm mb-2"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message…"
              rows={4}
              className="w-full border rounded-md px-3 py-2 text-sm mb-3"
            />
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="text-sm px-3 py-1">Cancel</button>
              <button
                onClick={send}
                disabled={!subject.trim() || !message.trim()}
                className="bg-emerald-600 text-white rounded-md px-4 py-1 text-sm font-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
