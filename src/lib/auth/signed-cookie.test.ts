import { beforeAll, describe, expect, it } from "vitest";

import { sign, unsign } from "@/lib/auth/signed-cookie";

/**
 * These cookies are what stop the age gate and demo mode from being
 * suggestions. If an attacker can forge `dt_dob`, the gate does nothing.
 */

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-at-least-sixteen-chars";
});

describe("sign / unsign", () => {
  it("round-trips a value", () => {
    expect(unsign(sign("2004-03-09"))).toBe("2004-03-09");
  });

  it("rejects a value whose payload was swapped", () => {
    const signed = sign("2004-03-09");
    const forged = `${Buffer.from("2015-01-01", "utf8").toString("base64url")}.${
      signed.split(".")[1]
    }`;

    expect(unsign(forged)).toBeNull();
  });

  it("rejects an unsigned value", () => {
    expect(unsign("2004-03-09")).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const [payload] = sign("1").split(".");
    expect(unsign(`${payload}.not-a-real-signature`)).toBeNull();
  });

  it("rejects a signature of the right length but wrong content", () => {
    const signed = sign("1");
    const [payload, signature] = signed.split(".");
    const flipped = signature[0] === "A" ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;

    expect(unsign(`${payload}.${flipped}`)).toBeNull();
  });

  it("handles missing and empty input", () => {
    expect(unsign(undefined)).toBeNull();
    expect(unsign("")).toBeNull();
    expect(unsign(".")).toBeNull();
  });

  it("does not verify under a different secret", () => {
    const signed = sign("1");
    process.env.BETTER_AUTH_SECRET = "a-completely-different-secret-value";

    expect(unsign(signed)).toBeNull();

    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-sixteen-chars";
  });
});

describe("secret requirements", () => {
  it("refuses to sign with a missing or short secret", () => {
    const original = process.env.BETTER_AUTH_SECRET;

    process.env.BETTER_AUTH_SECRET = "";
    expect(() => sign("1")).toThrow(/BETTER_AUTH_SECRET/);

    process.env.BETTER_AUTH_SECRET = "too-short";
    expect(() => sign("1")).toThrow(/BETTER_AUTH_SECRET/);

    process.env.BETTER_AUTH_SECRET = original;
  });
});
