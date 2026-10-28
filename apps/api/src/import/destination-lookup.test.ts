import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { BLOCKED_DESTINATION_CODE } from "./blocked-destination-error";
import { createDestinationLookup, type ResolveAll } from "./destination-lookup";

const PUBLIC_V4 = { address: "93.184.216.34", family: 4 };
const PUBLIC_V6 = { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 };
const PRIVATE_V4 = { address: "10.0.0.5", family: 4 };

function resolver(addresses: LookupAddress[]) {
  return vi.fn<ResolveAll>((_hostname, _options, callback) => {
    callback(null, addresses);
  });
}

function lookupAll(lookup: LookupFunction, hostname: string) {
  return new Promise<unknown>((resolve, reject) => {
    lookup(hostname, { all: true }, (error, addresses) =>
      error ? reject(error) : resolve(addresses),
    );
  });
}

function lookupOne(lookup: LookupFunction, hostname: string) {
  return new Promise<unknown>((resolve, reject) => {
    lookup(hostname, { family: 0 }, (error, address, family) =>
      error ? reject(error) : resolve({ address, family }),
    );
  });
}

describe("createDestinationLookup", () => {
  beforeEach(() => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves every address in resolver order", async () => {
    const resolve = resolver([PUBLIC_V4]);
    const lookup = createDestinationLookup(resolve);

    await lookupOne(lookup, "planka.example.com");

    expect(resolve).toHaveBeenCalledWith(
      "planka.example.com",
      expect.objectContaining({ all: true, verbatim: true }),
      expect.any(Function),
    );
  });

  it("passes public addresses through in both callback forms", async () => {
    const lookup = createDestinationLookup(resolver([PUBLIC_V6, PUBLIC_V4]));

    await expect(lookupAll(lookup, "planka.example.com")).resolves.toEqual([
      PUBLIC_V6,
      PUBLIC_V4,
    ]);
    await expect(lookupOne(lookup, "planka.example.com")).resolves.toEqual(
      PUBLIC_V6,
    );
  });

  it("refuses a host that resolves to a private address", async () => {
    const lookup = createDestinationLookup(resolver([PRIVATE_V4]));

    await expect(lookupAll(lookup, "rebind.example.com")).rejects.toMatchObject(
      { code: BLOCKED_DESTINATION_CODE },
    );
    await expect(lookupOne(lookup, "rebind.example.com")).rejects.toMatchObject(
      { code: BLOCKED_DESTINATION_CODE },
    );
  });

  it("refuses a host when any of its addresses is private", async () => {
    const lookup = createDestinationLookup(
      resolver([PUBLIC_V4, { address: "::ffff:127.0.0.1", family: 6 }]),
    );

    await expect(lookupOne(lookup, "mixed.example.com")).rejects.toMatchObject({
      code: BLOCKED_DESTINATION_CODE,
    });
  });

  it("lets private addresses through when the instance opts in", async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    const lookup = createDestinationLookup(resolver([PRIVATE_V4]));

    await expect(lookupOne(lookup, "planka.internal")).resolves.toEqual(
      PRIVATE_V4,
    );
  });

  it("passes resolver failures through", async () => {
    const failure = Object.assign(new Error("getaddrinfo ENOTFOUND"), {
      code: "ENOTFOUND",
    });
    const lookup = createDestinationLookup((_hostname, _options, callback) =>
      callback(failure, []),
    );

    await expect(lookupAll(lookup, "missing.example.com")).rejects.toBe(
      failure,
    );
  });
});
