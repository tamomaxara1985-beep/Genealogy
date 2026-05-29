import useSWR from "swr";
import type { ITree } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTree(treeId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ITree>(
    treeId ? `/api/trees/${treeId}` : null,
    fetcher
  );
  return { tree: data, error, isLoading, mutate };
}
