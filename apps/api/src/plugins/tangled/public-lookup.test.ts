import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createTangledLookup } from "./public-lookup";

function lookup(lookupFunction: LookupFunction, all = true): Promise<unknown> {
  return new Promise((resolve, reject) => {
    lookupFunction("api.tangled.example", { all }, (error, address, family) => {
      if (error) reject(error);
      else resolve(all ? address : { address, family });
    });
  });
}

function resolver(
  addresses: LookupAddress[],
): ReturnType<typeof createTangledLookup> {
  return createTangledLookup((_hostname, _options, callback) =>
    callback(null, addresses),
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("Tangled connection-time DNS checks", () => {
  it("returns only the validated resolution to the socket", async () => {
    const addresses = [
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ];
    await expect(lookup(resolver(addresses))).resolves.toEqual(addresses);
    await expect(lookup(resolver(addresses), false)).resolves.toEqual(
      addresses[0],
    );
  });

  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "192.0.0.1",
    "192.0.2.1",
    "192.88.99.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "3fff::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
  ])(
    "rejects private, special-use or non-routable DNS result %s",
    async (address) => {
      const family = address.includes(":") ? 6 : 4;
      await expect(
        lookup(resolver([{ address, family }])),
      ).rejects.toMatchObject({ code: "EACCES" });
    },
  );

  it("rejects mixed public/private answers even when private webhooks are enabled", async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    await expect(
      lookup(
        resolver([
          { address: "1.1.1.1", family: 4 },
          { address: "::1", family: 6 },
        ]),
      ),
    ).rejects.toMatchObject({ code: "EACCES" });
  });

  it("checks a new connection resolution instead of reusing a prior DNS approval", async () => {
    let calls = 0;
    const guardedLookup = createTangledLookup((_host, options, callback) => {
      expect(options.all).toBe(true);
      expect(options.family).toBe(0);
      calls++;
      callback(null, [
        { address: calls === 1 ? "1.1.1.1" : "127.0.0.1", family: 4 },
      ]);
    });
    await expect(lookup(guardedLookup)).resolves.toEqual([
      { address: "1.1.1.1", family: 4 },
    ]);
    await expect(lookup(guardedLookup)).rejects.toMatchObject({
      code: "EACCES",
    });
  });

  it("rejects empty resolution results", async () => {
    await expect(lookup(resolver([]))).rejects.toMatchObject({
      code: "ENOTFOUND",
    });
  });

  it("does not turn DNS failures into an approved address", async () => {
    const guardedLookup = createTangledLookup((_host, _options, callback) => {
      callback(
        Object.assign(new Error("DNS unavailable"), { code: "EAI_AGAIN" }),
        [],
      );
    });
    await expect(lookup(guardedLookup)).rejects.toMatchObject({
      code: "EAI_AGAIN",
    });
  });
});
