"use client";
import { useAccessRequests } from "@/hooks/useAccessRequests";
import type { IAccessRequestView, AccessStatusDTO } from "@/types";

async function act(id: string, action: "approve" | "deny" | "revoke") {
  await fetch(`/api/access-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

const badge: Record<AccessStatusDTO, string> = {
  pending: "text-amber-600",
  approved: "text-emerald-700",
  denied: "text-gray-500",
  revoked: "text-red-600",
};

export default function RequestsPage() {
  const incoming = useAccessRequests("incoming");
  const outgoing = useAccessRequests("outgoing");

  async function run(id: string, action: "approve" | "deny" | "revoke") {
    await act(id, action);
    incoming.mutate();
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Incoming requests</h1>
        {incoming.requests.length === 0 && <p className="text-sm text-gray-500">No requests.</p>}
        <ul className="space-y-3">
          {incoming.requests.map((r: IAccessRequestView) => (
            <li key={r.id} className="border rounded-lg p-4">
              <p className="font-medium">{r.counterpartyName}</p>
              <p className="text-xs text-gray-400">{r.counterpartyEmail} · Tree: {r.treeName}</p>
              {r.message && <p className="text-sm text-gray-600 mt-1">{r.message}</p>}
              <div className="flex gap-2 mt-3 items-center">
                <span className={`text-xs font-medium ${badge[r.status]}`}>{r.status}</span>
                {r.status === "pending" && (
                  <>
                    <button onClick={() => run(r.id, "approve")} className="bg-emerald-600 text-white rounded-md px-3 py-1 text-xs font-medium">Approve</button>
                    <button onClick={() => run(r.id, "deny")} className="border rounded-md px-3 py-1 text-xs font-medium">Deny</button>
                  </>
                )}
                {r.status === "approved" && (
                  <button onClick={() => run(r.id, "revoke")} className="border border-red-300 text-red-600 rounded-md px-3 py-1 text-xs font-medium">Revoke</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">My requests</h2>
        {outgoing.requests.length === 0 && <p className="text-sm text-gray-500">No requests sent.</p>}
        <ul className="space-y-3">
          {outgoing.requests.map((r: IAccessRequestView) => (
            <li key={r.id} className="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{r.treeName}</p>
                <p className="text-xs text-gray-400">Owner: {r.counterpartyName}</p>
              </div>
              <span className={`text-xs font-medium ${badge[r.status]}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
