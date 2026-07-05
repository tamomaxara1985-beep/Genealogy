"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { runSearch } from "@/hooks/useSearch";
import type { ISearchResult } from "@/types";
import { cn } from "@/lib/utils";

export default function SearchPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<ISearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [msgFor, setMsgFor] = useState<ISearchResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const seqRef = useRef(0);

  // Search as you type (debounced). Each field is optional; searches when at
  // least one field is filled and the combined input is at least 2 characters.
  useEffect(() => {
    const params = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      location: location.trim(),
    };
    const combined = params.firstName + params.lastName + params.location;
    const seq = ++seqRef.current;
    const t = setTimeout(async () => {
      if (combined.length < 2) {
        setResults([]);
        setSearched(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const r = await runSearch(params);
        if (seq !== seqRef.current) return; // stale response, ignore
        setResults(r.results);
        setSearched(true);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [firstName, lastName, location]);

  async function requestAccess(treeId: string) {
    setActionError(null);
    const res = await fetch(`/api/trees/${treeId}/access-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    if (!res.ok) {
      setActionError("Could not send request. Please try again.");
      return;
    }
    setResults((rs) => rs.map((r) => (r.treeId === treeId ? { ...r, access: "pending" } : r)));
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Search family trees</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="border rounded-md px-3 py-2 text-sm"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="border rounded-md px-3 py-2 text-sm"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (city/country)"
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}

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
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const res = await fetch(`/api/trees/${result.treeId}/contact-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    });
    if (!res.ok) {
      setError("Could not send message. Please try again.");
      return;
    }
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
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
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
