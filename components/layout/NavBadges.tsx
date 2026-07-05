"use client";
import useSWR from "swr";
import { useAccessRequests } from "@/hooks/useAccessRequests";

function Pill({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-semibold">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Pending access requests to trees the current user owns.
export function RequestsBadge() {
  const { requests } = useAccessRequests("incoming");
  const count = requests.filter((r) => r.status === "pending").length;
  return <Pill count={count} />;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Unread (status "new") contact-form messages. Admin only.
export function MessagesBadge() {
  const { data } = useSWR<{ status: string }[]>("/api/admin/contact-messages", fetcher);
  const count = Array.isArray(data) ? data.filter((m) => m.status === "new").length : 0;
  return <Pill count={count} />;
}
