import { describe, it, expect } from "vitest";
import { issueMobileToken, verifyMobileToken } from "./mobileToken";

const SECRET = "test-secret-value-123";
const CLAIMS = { sub: "u1", email: "a@b.com", role: "user", name: "Ann" };

describe("mobileToken", () => {
  it("round-trips claims through issue -> verify", async () => {
    const token = await issueMobileToken(CLAIMS, SECRET);
    expect(typeof token).toBe("string");
    const out = await verifyMobileToken(token, SECRET);
    expect(out).toEqual(CLAIMS);
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await issueMobileToken(CLAIMS, SECRET);
    expect(await verifyMobileToken(token, "other-secret")).toBeNull();
  });

  it("returns null for a garbage token", async () => {
    expect(await verifyMobileToken("not.a.jwt", SECRET)).toBeNull();
  });

  it("defaults missing email/name to null and role to 'user'", async () => {
    const token = await issueMobileToken(
      { sub: "u2", email: null, role: "admin", name: null },
      SECRET
    );
    const out = await verifyMobileToken(token, SECRET);
    expect(out).toEqual({ sub: "u2", email: null, role: "admin", name: null });
  });
});
