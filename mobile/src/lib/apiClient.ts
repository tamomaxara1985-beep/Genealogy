export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
  fetchImpl?: typeof fetch;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await opts.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await doFetch(`${opts.baseUrl}${path}`, { ...init, headers });

    if (res.status === 401) opts.onUnauthorized();

    const text = await res.text();
    const body = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message =
        (body && typeof body.error === "string" && body.error) || `Request failed (${res.status})`;
      throw new ApiError(res.status, message);
    }
    return body as T;
  }

  return { request };
}
