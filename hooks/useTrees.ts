import useSWR from "swr";
import type { ITree } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTrees() {
  const { data, error, isLoading, mutate } = useSWR<{
    owned: ITree[];
    shared: ITree[];
  }>("/api/trees", fetcher);
  return {
    owned: data?.owned ?? [],
    shared: data?.shared ?? [],
    error,
    isLoading,
    mutate,
  };
}
