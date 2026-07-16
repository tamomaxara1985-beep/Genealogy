import { createApiClient } from "./apiClient";
import { tokenStore } from "./tokenStore";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

// Listeners notified on any 401 so the auth layer can sign the user out.
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(cb: () => void): () => void {
  unauthorizedListeners.add(cb);
  return () => unauthorizedListeners.delete(cb);
}

export const api = createApiClient({
  baseUrl,
  getToken: () => tokenStore.get(),
  onUnauthorized: () => unauthorizedListeners.forEach((cb) => cb()),
});

// SWR global fetcher: keys are API paths.
export const swrFetcher = (path: string) => api.request(path);
