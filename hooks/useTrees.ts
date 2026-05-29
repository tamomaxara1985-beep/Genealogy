import useSWR from "swr";
import type { ITree } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTrees() {
  const { data, error, isLoading, mutate } = useSWR<ITree[]>(
    "/api/trees",
    fetcher
  );
  return { trees: data ?? [], error, isLoading, mutate };
}
