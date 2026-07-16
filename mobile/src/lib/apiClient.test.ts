import { describe, it, expect, vi } from "vitest";
import { createApiClient, ApiError } from "./apiClient";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const base = { baseUrl: "http://api.test", onUnauthorized: () => {} };

describe("createApiClient", () => {
  it("prefixes baseUrl and injects the Bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: 1 }));
    const client = createApiClient({
      ...base,
      getToken: async () => "tok123",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const out = await client.request("/api/trees");
    expect(out).toEqual({ ok: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://api.test/api/trees");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("omits Authorization when there is no token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = createApiClient({
      ...base,
      getToken: async () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.request("/x");
    const [, init] = fetchImpl.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("throws ApiError with status + server message on non-2xx", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse({ error: "Not found" }, 404));
    const client = createApiClient({
      ...base,
      getToken: async () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.request("/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Not found",
    });
    expect((await client.request("/x").catch((e) => e)) instanceof ApiError).toBe(true);
  });

  it("calls onUnauthorized on a 401", async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));
    const client = createApiClient({
      baseUrl: "http://api.test",
      onUnauthorized,
      getToken: async () => "expired",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.request("/x").catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
