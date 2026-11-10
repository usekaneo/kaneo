/**
 * The Message-ID vocabulary shared by the transport that produces a provider
 * host and the store that recognises one.
 *
 * Two properties carry the weight here. The recogniser is a security boundary,
 * because accepting a host means agreeing to compare a quoted id by its local
 * part alone; and the producer and the recogniser have to keep agreeing, since
 * nothing else holds them together and the only symptom of a disagreement is a
 * reply that quietly stops routing home.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  isSesMessageIdHost,
  sesBareMessageId,
  sesMessageIdHost,
  sesWireMessageId,
} from "../message-id";

describe("recognising a host the provider stamps on its own ids", () => {
  it("accepts the provider domain and its subdomains", () => {
    expect(isSesMessageIdHost("email.amazonses.com")).toBe(true);
    expect(isSesMessageIdHost("eu-west-2.amazonses.com")).toBe(true);
    expect(isSesMessageIdHost("amazonses.com")).toBe(true);
    // Depth is not what is being guarded, so a form we have not seen is still
    // the provider's domain and is still recognised.
    expect(isSesMessageIdHost("a.b.amazonses.com")).toBe(true);
    expect(isSesMessageIdHost("EMAIL.AmazonSES.com")).toBe(true);
  });

  /**
   * Each of these is a domain someone other than the provider can register, and
   * each is admitted by deleting exactly one anchor from the pattern. They are
   * here because a host with no leading label — the obvious lookalike — fails
   * the pattern with or without either anchor, so testing only that shape would
   * leave both anchors deletable with the suite green.
   */
  it("refuses a registrable lookalike, at both ends of the host", () => {
    // Admitted by deleting the trailing `$`: the provider's domain is a prefix
    // of a domain the attacker owns.
    expect(isSesMessageIdHost("evil.amazonses.com.attacker.test")).toBe(false);
    expect(isSesMessageIdHost("amazonses.com.attacker.test")).toBe(false);
    // Admitted by deleting the leading `^`: the provider's domain is a suffix
    // of a label the attacker owns, with no dot in front of it.
    expect(isSesMessageIdHost("evilamazonses.com")).toBe(false);
    expect(isSesMessageIdHost("notamazonses.com")).toBe(false);
    // And the ordinary negatives.
    expect(isSesMessageIdHost("workspace-a.test")).toBe(false);
    expect(isSesMessageIdHost("amazonses.com.evil.co.uk")).toBe(false);
  });
});

describe("the bare id behind a quoted one", () => {
  it("offers the local part of an id the provider assigned", () => {
    expect(sesBareMessageId("0100018f-abc@email.amazonses.com")).toBe(
      "0100018f-abc",
    );
    expect(sesBareMessageId("0100018f-abc@eu-west-2.amazonses.com")).toBe(
      "0100018f-abc",
    );
  });

  it("offers nothing for an id hosted anywhere else", () => {
    expect(sesBareMessageId("c.abc.n1@workspace-a.test")).toBeNull();
    expect(sesBareMessageId("c.abc.n1@amazonses.com.attacker.test")).toBeNull();
    expect(sesBareMessageId("0100018f-abc")).toBeNull();
  });

  /**
   * The invariant the caller is told it can rely on: what comes back is a WHOLE
   * provider-assigned id, not a fragment of a longer one. Splitting at the last
   * `@` instead would hand back `a@b` here, which is a local part of nothing.
   */
  it("offers nothing when the id carries more than one at-sign", () => {
    expect(sesBareMessageId("a@b@email.amazonses.com")).toBeNull();
    expect(sesBareMessageId("@email.amazonses.com")).toBeNull();
  });
});

describe("the host that completes a threading token", () => {
  it("uses the verified host for the verified region and the documented form elsewhere", () => {
    expect(sesMessageIdHost("us-east-1")).toBe("email.amazonses.com");
    expect(sesMessageIdHost(" US-EAST-1 ")).toBe("email.amazonses.com");
    expect(sesMessageIdHost("eu-west-2")).toBe("eu-west-2.amazonses.com");
  });

  it("completes a bare id and leaves a hosted one alone", () => {
    expect(sesWireMessageId("0100018f-abc", "us-east-1")).toBe(
      "0100018f-abc@email.amazonses.com",
    );
    // A workspace-minted id passing through the same chain keeps its own host.
    expect(sesWireMessageId("c.abc.n1@workspace-a.test", "us-east-1")).toBe(
      "c.abc.n1@workspace-a.test",
    );
  });
});

/**
 * The tie between the two halves. The transport composes a host; the store
 * recognises one. Nothing but this connects them, so a change to either side
 * that the other does not follow has to fail here rather than in production.
 */
describe("the producer and the recogniser agree", () => {
  const REGIONS = [
    "us-east-1",
    "us-west-2",
    "eu-west-1",
    "eu-west-2",
    "ap-southeast-2",
  ];

  it("round-trips an assigned id through the header form and back", () => {
    for (const region of REGIONS) {
      const assigned = "0100018f-abc";
      const quoted = sesWireMessageId(assigned, region);
      expect(isSesMessageIdHost(quoted.split("@")[1])).toBe(true);
      expect(sesBareMessageId(quoted)).toBe(assigned);
    }
  });
});
