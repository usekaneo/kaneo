/**
 * The Message-ID vocabulary of the one sending provider that assigns its own.
 *
 * SES generates the `Message-ID` header itself and replaces any we supply. Its
 * API then answers with that id BARE — no host — while the header it signs
 * carries the id at a regional host. Two sides of the system have to agree
 * about that host: the transport, which completes a threading token with it,
 * and the store, which recognises it on a quoted id coming back.
 *
 * Both live here rather than one in each package, because they are two views of
 * one fact and nothing else would hold them together. Apart, they drift apart
 * silently: the side that writes a host and the side that recognises one simply
 * stop agreeing, and the only symptom is a reply that does not route home.
 *
 * Deliberately dependency-free, so the app's store can import it without
 * dragging a cloud SDK into its module graph.
 */

/**
 * A host this provider stamps on an id it assigned: its own domain, or any
 * subdomain of it.
 *
 * Anchored at BOTH ends, and each anchor alone keeps out a domain that anyone
 * can register. Without the trailing `$`, `amazonses.com.attacker.test` and
 * `evil.amazonses.com.attacker.test` are accepted. Without the leading `^`,
 * `evilamazonses.com` is. Neither is the provider, and both are for sale.
 *
 * Subdomain depth is left open rather than pinned at the one label observed so
 * far, because a host form we have not seen must not silently stop being
 * recognised. Depth is not what the anchors are protecting.
 */
const SES_MESSAGE_ID_HOST = /^(?:[a-z0-9-]+\.)*amazonses\.com$/;

/**
 * Is this host one the provider stamps on an id it assigned?
 *
 * NOT A TEST OF AUTHORSHIP, and the distinction is the whole reason to say so
 * here. Every account on the region shares this host, so a true answer says the
 * message left through this provider and nothing at all about who sent it. It
 * exists to reconcile the two forms of an id THIS install already recorded (see
 * {@link sesBareMessageId}), where the id itself is the evidence and the host is
 * only the part being spanned.
 *
 * So it must never become the mail-loop guard's answer to "is this ours". Wired
 * there it would read every other customer of this provider as us and take a
 * branch that drops their mail with no retention — a wider failure than the loop
 * it was reached for. That guard asks about something only we can produce: the
 * reply address we minted, checked in
 * `conversation.email-channel.ts#isOwnInboundAddress`.
 */
export function isSesMessageIdHost(host: string): boolean {
  return SES_MESSAGE_ID_HOST.test(host.trim().toLowerCase());
}

/**
 * The host this provider stamps on an id it assigned, for a given region.
 *
 * `us-east-1` is VERIFIED: a live send from that region produced a header at
 * `email.amazonses.com`. Every other region follows the provider's documented
 * `<region>.amazonses.com` form and has NOT been observed here, because a
 * sending identity is verified per region and only that one is. Note that the
 * one region we have observed is the one that does not follow the general form,
 * so treat the rest as an inference rather than a fact.
 *
 * Nothing that must be exact depends on it. This host is composed into an
 * outbound `References` / `In-Reply-To` token and nowhere else: right, the
 * recipient's client threads the conversation; wrong, the token names an id no
 * client saw and threads nothing, which is what a bare token does anyway. The
 * route home for a reply is not on this path — the store records the id the
 * provider reported, unaltered, and matches a quoted id back to it by its local
 * part (see {@link sesBareMessageId}).
 */
export function sesMessageIdHost(region: string): string {
  const normalized = region.trim().toLowerCase();
  return normalized === "us-east-1"
    ? "email.amazonses.com"
    : `${normalized}.amazonses.com`;
}

/**
 * The bare id behind a quoted Message-ID, when that id is one this provider
 * assigned. Null for every other id, including one that merely mentions the
 * provider's name in its host.
 *
 * This is the read side of the split above: the row holds what the API reported
 * (bare), the reply quotes what the header carried (hosted), and this is what
 * makes the two comparable without dropping the host off ids that need it.
 *
 * Exactly one `@` is required in the whole id, so the guarantee the caller
 * relies on is the one this makes: the local part offered back is the local part
 * of a PROVIDER-assigned id, never a fragment of a multi-`@` id that happens to
 * end at the provider's domain.
 */
export function sesBareMessageId(id: string): string | null {
  const parts = id.trim().split("@");
  if (parts.length !== 2) return null;
  const [local = "", host = ""] = parts;
  if (local === "" || !isSesMessageIdHost(host)) return null;
  return local;
}

/**
 * A legal `msg-id` token for an id this provider reported.
 *
 * The provider reports its ids bare and a bare token is not a `msg-id` at all,
 * so a threading header built from stored ids has to be completed with the host
 * the header carried. An id that already has a host is taken as it stands, so a
 * workspace-minted id passing through — or a provider that starts reporting the
 * full form — is never given a second one.
 */
export function sesWireMessageId(id: string, region: string): string {
  const trimmed = id.trim();
  return trimmed.includes("@")
    ? trimmed
    : `${trimmed}@${sesMessageIdHost(region)}`;
}
