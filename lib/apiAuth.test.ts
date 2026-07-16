import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const verifyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/mobileToken", () => ({
  verifyMobileToken: (t: string, s: string) => verifyMock(t, s),
}));

import { getSession } from "./apiAuth";

function reqWith(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", { headers });
}

describe("getSession", () => {
  beforeEach(() => {
    authMock.mockReset();
    verifyMock.mockReset();
    process.env.AUTH_SECRET = "s";
  });

  it("returns the cookie session when present, ignoring Bearer", async () => {
    authMock.mockResolvedValue({ user: { id: "cookie-user" } });
    const s = await getSession(reqWith({ authorization: "Bearer xyz" }));
    expect(s?.user?.id).toBe("cookie-user");
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("falls back to a valid Bearer token when no cookie session", async () => {
    authMock.mockResolvedValue(null);
    verifyMock.mockResolvedValue({ sub: "tok-user", email: "e@x.com", role: "user", name: "N" });
    const s = await getSession(reqWith({ authorization: "Bearer good" }));
    expect(verifyMock).toHaveBeenCalledWith("good", "s");
    expect(s?.user).toMatchObject({ id: "tok-user", email: "e@x.com", name: "N", role: "user" });
  });

  it("returns null with no cookie and no auth header", async () => {
    authMock.mockResolvedValue(null);
    expect(await getSession(reqWith())).toBeNull();
  });

  it("returns null when the Bearer token is invalid", async () => {
    authMock.mockResolvedValue(null);
    verifyMock.mockResolvedValue(null);
    expect(await getSession(reqWith({ authorization: "Bearer bad" }))).toBeNull();
  });
});
