import { lookup } from "node:dns/promises";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  assertPublicDestination,
  isDisallowedAddress,
} from "../../../apps/api/src/utils/assert-public-destination";

describe("isDisallowedAddress", () => {
  it("blocks the ranges a webhook must never reach", () => {
    expect(isDisallowedAddress("localhost")).toBe(true);
    expect(isDisallowedAddress("127.0.0.1")).toBe(true);
    expect(isDisallowedAddress("10.0.0.1")).toBe(true);
    expect(isDisallowedAddress("172.16.0.1")).toBe(true);
    expect(isDisallowedAddress("192.168.1.1")).toBe(true);
    expect(isDisallowedAddress("169.254.169.254")).toBe(true);
    expect(isDisallowedAddress("[::1]")).toBe(true);
    expect(isDisallowedAddress("[::ffff:7f00:1]")).toBe(true);
  });

  // RFC 6598. Several hosted Kubernetes offerings put pod and service
  // networks in here, so on those clusters it reaches the same neighbours
  // 10/8 does on a plain VPC.
  it("blocks the shared address space", () => {
    expect(isDisallowedAddress("100.64.0.0")).toBe(true);
    expect(isDisallowedAddress("100.64.0.1")).toBe(true);
    expect(isDisallowedAddress("100.100.100.100")).toBe(true);
    expect(isDisallowedAddress("100.127.255.255")).toBe(true);
  });

  it("leaves the rest of 100.0.0.0/8 alone", () => {
    expect(isDisallowedAddress("100.63.255.255")).toBe(false);
    expect(isDisallowedAddress("100.128.0.0")).toBe(false);
    expect(isDisallowedAddress("100.0.0.1")).toBe(false);
  });

  it("allows a routable address", () => {
    expect(isDisallowedAddress("8.8.8.8")).toBe(false);
    expect(isDisallowedAddress("93.184.216.34")).toBe(false);
    expect(isDisallowedAddress("example.com")).toBe(false);
  });

  it.each([
    "0:0:0:0:0:0:0:1",
    "0:0:0:0:0:ffff:7f00:1",
    "2002:c0a8:0101::1",
    "64:ff9b::c0a8:101",
    "64:ff9b::192.168.1.1",
    "::c0a8:101",
    "::ffff:0:c0a8:101",
    "2001:0000:4136:e378:8000:63bf:f5ff:fffe",
    "64:ff9b:1::808:808",
  ])("blocks non-public IPv6 transition destinations: %s", (address) => {
    expect(isDisallowedAddress(address)).toBe(true);
  });

  it.each([
    "2606:4700:4700::1111",
    "2002:0808:0808::1",
    "64:ff9b::808:808",
    "::ffff:808:808",
    "::808:808",
    "2001:0:808:808:0:0:f7f7:f7f7",
  ])("preserves public IPv6 and transition destinations: %s", (address) => {
    expect(isDisallowedAddress(address)).toBe(false);
  });
});

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

describe("destination lookup errors", () => {
  it.each(["Gitea", "GitLab", "Generic webhook"])(
    "keeps the %s source label and an unreachable code without DNS details",
    async (label) => {
      vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
      vi.mocked(lookup).mockRejectedValueOnce(new Error("private DNS details"));
      await expect(
        assertPublicDestination("https://missing.example.test", label),
      ).rejects.toMatchObject({
        message: `${label} destination could not be resolved`,
        code: "ENOTFOUND",
      });
      vi.mocked(lookup).mockResolvedValueOnce([]);
      await expect(
        assertPublicDestination("https://missing.example.test", label),
      ).rejects.toMatchObject({
        message: `${label} destination could not be resolved`,
        code: "ENOTFOUND",
      });
    },
  );
});
