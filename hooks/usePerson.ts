import useSWR from "swr";
import type { IPerson } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePersons(treeId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<IPerson[]>(
    treeId ? `/api/trees/${treeId}/persons` : null,
    fetcher
  );
  return { persons: data ?? [], error, isLoading, mutate };
}

export function usePerson(personId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<IPerson>(
    personId ? `/api/persons/${personId}` : null,
    fetcher
  );
  return { person: data, error, isLoading, mutate };
}
