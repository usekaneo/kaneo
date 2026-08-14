import { describe, expect, it } from "vitest";
import { isDisallowedAddress } from "../../../apps/api/src/utils/assert-public-destination";

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
});
