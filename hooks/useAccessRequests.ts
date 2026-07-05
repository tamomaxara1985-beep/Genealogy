import useSWR from "swr";
import type { IAccessRequestView } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAccessRequests(role: "incoming" | "outgoing") {
  const { data, error, isLoading, mutate } = useSWR<{ requests: IAccessRequestView[] }>(
    `/api/access-requests?role=${role}`,
    fetcher
  );
  return { requests: data?.requests ?? [], error, isLoading, mutate };
}
