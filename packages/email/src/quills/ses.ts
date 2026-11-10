/**
 * Amazon SES v2 sending transport.
 *
 * One `SendEmail` call over the AWS SDK, reachable from any backend, which is
 * what makes it usable from a container tier. DKIM signing, the account
 * suppression list, and the delivery event stream are all on the AWS side of
 * the call.
 *
 * The sending identity has to be verified in SES, but verification is a DNS
 * record the domain's owner publishes — SES does not have to host the zone. A
 * customer-owned domain on someone else's DNS can therefore be signed for here,
 * which is why this transport has no notion of a domain it must refuse to send
 * as, and why the caller has no rung below it for one.
 *
 * ## What this transport cannot do
 *
 * `Message-ID` is platform-controlled. SES generates it and returns the
 * assigned id on the response; a caller-supplied one is REPLACED on the way out
 * (not duplicated, and before the message is signed) along with Date,
 * MIME-Version, Content-Type, Return-Path, DKIM-Signature and the ARC set.
 * Anything that needs to pin its own outbound Message-ID (the conversation
 * email channel's threading does) has to read the assigned id back off the
 * response instead of choosing it. `In-Reply-To`, `References`, `List-*`,
 * `Auto-Submitted`, `Precedence` and any `X-*` header are accepted and pass
 * through untouched.
 *
 * The assigned id is reported BARE, exactly as the API gives it, because that
 * is the only form of it we are told; the header the provider signs carries the
 * same id at a regional host. Reconciling the two forms is the store's job, not
 * this transport's. The one thing this transport does with the host is complete
 * the threading tokens it is asked to send, since a bare id is not a legal
 * `msg-id`, and that is the only place the host appears at all. See
 * `message-id.ts` for why that split is deliberate.
 */
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type {
  SendEmailCommandOutput,
  SESv2ClientConfig,
} from "@aws-sdk/client-sesv2";
import { createLogger } from "@kaneo/logger";
import { sesWireMessageId } from "./message-id";
import { createSendRateLimiter, SendRateQueueFullError } from "./send-rate";
import type { SendRateLimiter } from "./send-rate";
import type { EmailAttachment } from "./attachment";
import { isTenantPausedFailure } from "./ses-tenant-paused";

const log = createLogger({ base: { service_name: "quackback-email" } }).child({
  component: "email-ses",
});

/** Named or bare address. */
export type EmailAddress = string | { address: string; name?: string };

/**
 * Split an RFC 5322 `Display Name <addr@host>` into its parts.
 *
 * The parse half of {@link formatAddress}, and what {@link addressDomain} reads
 * a domain out of. Quoted display names (`"Doe, Jane" <j@x>`) lose their quotes
 * here, which is right for a name treated as data; a value going back onto the
 * wire is re-rendered by `formatAddress` rather than reassembled by hand from
 * these parts, because the quoting rules are the whole point of that function.
 */
export function parseAddress(value: string): EmailAddress {
  // Split imperatively rather than with one regex: the obvious
  // `/^\s*(.*?)\s*<...>\s*$/` backtracks polynomially on long space runs,
  // and header values are library input.
  const trimmed = value.trim();
  const open = trimmed.lastIndexOf("<");
  if (open === -1 || !trimmed.endsWith(">")) return trimmed;
  const address = trimmed.slice(open + 1, -1).trim();
  if (!address) return trimmed;
  const name = trimmed
    .slice(0, open)
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim();
  return name ? { address, name } : address;
}

/** Characters that make a bare RFC 5322 phrase re-parse as address syntax. */
const PHRASE_SPECIALS = /[()<>[\]:;@\\,."]/;
/** Anything outside printable US-ASCII, which an address header cannot carry. */
const NON_ASCII = /[^\x20-\x7e]/;

/**
 * Render a display name so it survives the address header intact.
 *
 * Two operator-written forms are legal-looking and wrong on the wire. A name
 * containing a comma re-parses as a second address, so `Acme, Inc <a@b>` is two
 * addresses rather than one sender and the whole send is rejected; quoting it
 * makes it one phrase again. A non-ASCII name cannot appear in an address
 * header at all, which is not the same rule the subject follows: the subject is
 * a text field the provider encodes, while `From` is structured and has to
 * carry an RFC 2047 encoded word instead.
 */
function encodeDisplayName(name: string): string {
  if (NON_ASCII.test(name)) {
    // One encoded word, not folded. The 75-character guidance is about line
    // length in a transmitted header, and the header here is assembled by the
    // provider from a JSON field rather than written by us.
    return `=?UTF-8?B?${Buffer.from(name, "utf8").toString("base64")}?=`;
  }
  if (PHRASE_SPECIALS.test(name))
    return `"${name.replace(/([\\"])/g, "\\$1")}"`;
  return name;
}

/**
 * Render an address for a header that has to parse as exactly one address.
 *
 * The transport applies this at its own boundary rather than trusting the
 * caller's string, because the string is usually `EMAIL_FROM` — operator-typed
 * configuration that nothing validates on the way in, and whose display name is
 * the part with the sharp edges. A bare address passes through untouched.
 */
export function formatAddress(value: string): string {
  const parsed = parseAddress(value);
  if (typeof parsed === "string") return parsed;
  if (!parsed.name) return parsed.address;
  return `${encodeDisplayName(parsed.name)} <${parsed.address}>`;
}

/** Replace (or add) the display name on an addr-spec or `Name <addr>` value. */
export function applyDisplayName(from: string, displayName: string): string {
  const parsed = parseAddress(from);
  const address = typeof parsed === "string" ? parsed : parsed.address;
  return formatAddress(`${displayName} <${address}>`);
}

/** The domain of an `addr` or `Name <addr>` value, lower-cased, or null. */
export function addressDomain(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = parseAddress(value);
  const bare = typeof parsed === "string" ? parsed : parsed.address;
  const at = bare.lastIndexOf("@");
  if (at === -1) return null;
  const domain = bare
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return domain === "" ? null : domain;
}

/**
 * Headers the platform generates itself and rejects when a caller supplies them.
 *
 * Lower-cased for comparison; header names are case-insensitive on the wire.
 */
const PLATFORM_CONTROLLED_HEADERS = new Set([
  "message-id",
  "date",
  "mime-version",
  "content-type",
  "return-path",
  "dkim-signature",
  "arc-seal",
  "arc-message-signature",
  "arc-authentication-results",
]);

/**
 * Drop the headers the platform owns, keeping everything else.
 *
 * Supplying one is not a warning, it is a rejected send, so this is a filter
 * rather than a check. The dropped names come back so the caller can say what
 * it lost: for `Message-ID` in particular, losing it costs a routing mechanism
 * (see the conversation email channel's Message-ID fallback), and silently
 * dropping something with that consequence is worse than not sending it.
 */
export function stripPlatformControlledHeaders(
  headers: Record<string, string>,
): {
  headers: Record<string, string>;
  dropped: string[];
} {
  const kept: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [name, value] of Object.entries(headers)) {
    if (PLATFORM_CONTROLLED_HEADERS.has(name.toLowerCase())) dropped.push(name);
    else kept[name] = value;
  }
  return { headers: kept, dropped };
}

export interface SesSendRequest {
  /** RFC 5322 form; a display name may be included and is re-rendered by
   *  {@link formatAddress} before it reaches the wire. */
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  /** Threading and `X-*` headers. The platform-controlled set above is dropped
   *  on the way out rather than rejected by the API — see
   *  {@link stripPlatformControlledHeaders}. */
  headers?: Record<string, string>;
  /** Real files, carried on the Simple content's own `Attachments` list — no
   *  raw MIME message to assemble ourselves, and every other field on this
   *  request (threading headers, Message-ID handling) stays exactly as it is
   *  without them. */
  attachments?: EmailAttachment[];
  /**
   * The provider tenant this message is sent for, when the operator isolates
   * reputation per workspace. The provider then checks that the From identity
   * and the configuration set are associated with the tenant and refuses the
   * send if not, so a caller passes one only when it knows both are.
   */
  tenantName?: string;
}

export interface SesSendResult {
  /**
   * The id SES assigned this message, exactly as the API reported it.
   *
   * BARE on this provider: no host, and so not the literal token a reply quotes
   * back. Composing the missing host is deliberately not done here, because the
   * host is a per-region inference and this value is the one that gets stored;
   * see `sesMessageIdHost` in `message-id.ts`. It is also the form the
   * provider's own delivery events name the message by, so the two sides
   * already share it.
   *
   * Never empty and never shaped like something a header could not carry: a
   * response that cannot produce a usable id is not treated as a send at all
   * (see {@link sendViaSes}), so a caller that stores this is always storing an
   * id that exists on the provider's side.
   */
  messageId: string;
}

/**
 * One character of a Message-ID.
 *
 * Printable US-ASCII only, with the structural characters excluded: whitespace
 * (which would end the token), angle brackets (which delimit it), and `@`
 * (which separates its halves and is counted separately below). Control
 * characters and non-ASCII are out because this value reaches a header, a log
 * line and a stored column, and none of those is a place for a byte that
 * renders as something other than itself.
 */
const ID_ATOM = String.raw`[^\s<>@\x00-\x1f\x7f-\uffff]`;

/**
 * An id this transport will hand back to a caller that stores it.
 *
 * At most one `@`, because a second one makes the id ambiguous about where its
 * host starts — and the store's read side splits on exactly that boundary to
 * decide whether an id is one this provider assigned. An id that arrived with
 * two would either be rejected there or, worse, have a fragment of itself
 * treated as a whole id.
 */
const ASSIGNED_MESSAGE_ID = new RegExp(
  String.raw`^${ID_ATOM}+(?:@${ID_ATOM}+)?$`,
);

/**
 * The headers whose tokens may name an id this transport assigned.
 *
 * Lower-cased for comparison; header names are case-insensitive on the wire.
 */
const THREADING_ID_HEADERS = new Set(["in-reply-to", "references"]);

/**
 * Complete the threading tokens that name ids this transport assigned.
 *
 * A caller threading on our own prior sends hands those ids back in the form we
 * reported them, which on this provider is bare — and a bare token is not a
 * `msg-id`, so it threads nothing and can lead a strict parser to discard the
 * whole header, taking the valid tokens with it. This transport is the one
 * place that knows the host its own ids wear on the wire, so it is the one
 * place that can finish them.
 *
 * Only bracketed tokens are rewritten, which is the form every header value
 * reaching here is built in, and only ones with no host of their own: a
 * workspace-minted id passing through is left exactly as it was written.
 */
function completeThreadingIds(
  headers: Record<string, string>,
  region: string,
): Record<string, string> {
  const completed: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    completed[name] = THREADING_ID_HEADERS.has(name.toLowerCase())
      ? value.replace(/<([^<>]+)>/g, (whole, token: string) =>
          ASSIGNED_MESSAGE_ID.test(token)
            ? `<${sesWireMessageId(token, region)}>`
            : whole,
        )
      : value;
  }
  return completed;
}

/** The subset of the SES client this transport uses, so tests inject a fake. */
export interface SesSendClient {
  send(command: SendEmailCommand): Promise<SendEmailCommandOutput>;
}

/** Injectable so tests never touch the network. */
export interface SesEmailDeps {
  client: SesSendClient;
  /**
   * The region this client is pointed at, and so the region whose host completes
   * a threading token naming one of this transport's own ids.
   *
   * Carried beside the client rather than re-read from the environment at the
   * send: the client was built for one region, and reading the region again
   * elsewhere is how an injected client and the header composed alongside it
   * come to describe two different deployments. Required rather than defaulted,
   * because a default would be a second guess stacked on the first.
   */
  region: string;
  /**
   * Names the SES configuration set applied to the send. Optional because a
   * self-hoster has no reason to create one; a fleet uses it to attach event
   * publishing (bounces, complaints, deliveries) to its mail.
   */
  configurationSet?: string;
  /**
   * What paces this send. Defaults to the process-wide limiter
   * ({@link sesSendRateLimiter}); a test supplies its own so it owns the clock.
   */
  limiter?: SendRateLimiter;
}

/**
 * The provider's exception names for "too many sends this second".
 *
 * `TooManyRequestsException` is the v2 API's 429. `Throttling` and
 * `ThrottlingException` are the older names for the same limit, and the first
 * has been answered with a 400, which on status alone reads as a rejected
 * message and would never be retried.
 */
const THROTTLING_CODES = new Set([
  "TooManyRequestsException",
  "Throttling",
  "ThrottlingException",
]);

function isThrottling(status: number | null, code: string | null): boolean {
  return status === 429 || (code !== null && THROTTLING_CODES.has(code));
}

/**
 * Is an HTTP status worth sending the same message again for?
 *
 * Only the statuses that describe a moment rather than the request: a rate
 * limit, a timeout, and anything the far side calls its own fault. Everything
 * else in the 4xx range is the API saying this message is wrong — most often
 * that its sending identity is not verified in this region — and no number of
 * retries verifies an identity.
 *
 * A statusless failure is not this function's question. It never reached SES,
 * so there is no verdict on the message to read; see {@link sendFailure}.
 */
function statusIsRetryable(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

export class SesEmailError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    /** The provider's exception name, e.g. `MessageRejected`. */
    readonly code: string | null,
    /**
     * Whether sending this exact message again could plausibly succeed.
     *
     * Declared by the error rather than inferred by the caller, because only
     * the transport knows which of its failures are about the moment and which
     * are about the message. A caller that retries everything (the conversation
     * send path deliberately does, so a new provider error name cannot quietly
     * stop being retried) can still honour a `false` here and skip a wait that
     * has no chance of paying off.
     *
     * Required rather than defaulted: a default would have to guess for a
     * statusless failure, and guessing wrong there is the case that loses mail.
     */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SesEmailError";
  }
}

/**
 * A send refused because the tenant it was sent for is paused by the provider.
 *
 * Permanent: the tenant stays paused until it is resumed, and no retry within
 * a backoff changes that. `detail` is the provider's reason, made safe to keep.
 */
export class SesTenantPausedError extends SesEmailError {
  constructor(
    readonly tenantName: string,
    readonly detail: string,
    status: number | null,
    code: string | null,
  ) {
    super(
      `SES email send refused: the sending tenant is paused: ${detail}`,
      status,
      code,
      false,
    );
    this.name = "SesTenantPausedError";
  }
}

/** Longest run of provider prose allowed onto a log line or a stored row. */
const MAX_DETAIL_CHARS = 200;

/**
 * The address forms a provider actually echoes back, not the ones a validator
 * would accept. All three are legal RFC 5321 and SES quotes them as it was
 * given them: a bare address, a quoted local part (`"jane doe"@host`), and a
 * bracketed address literal (`user@[192.0.2.1]`). Each side stays greedy,
 * because the point is to catch an address rather than to validate one.
 */
const LOCAL_PART = String.raw`(?:"[^"]*"|[^\s<>()\[\],;:"]+)`;
const DOMAIN_PART = String.raw`(?:\[[^\]\s]*\]|[^\s<>()\[\],;:"]+)`;
/**
 * The `@`, with the single space a folded header leaves behind on either side
 * once the line break has been squashed. Without it an address wrapped across
 * two lines is not address-shaped any more and survives redaction whole.
 */
const AT_SIGN = String.raw` ?@ ?`;

const ADDRESS_LIKE = `${LOCAL_PART}${AT_SIGN}${DOMAIN_PART}`;

/**
 * A display name in front of an angle-addr, taken with the address it labels.
 *
 * The name is the person as surely as the address is, so redacting only what
 * sits inside the brackets leaves `Jane Doe <[address]>` and calls it done. The
 * phrase is bounded at three words because that is what a display name is;
 * unbounded, it would swallow the provider's sentence back to the previous
 * delimiter and leave nothing to diagnose from.
 */
const NAMED_ADDRESS = String.raw`(?:"[^"]*"|[^\s<>@,;:"]+(?: [^\s<>@,;:"]+){0,2})? ?<[^<>]*@[^<>]*>`;

/**
 * Make provider text safe to keep.
 *
 * SES failure messages routinely quote the addresses that caused them ("the
 * following identities failed the check"), and this text does not stop at the
 * log: it becomes the thrown error's message, which a caller can persist on a
 * row (the job queue writes it to `last_error`). Redacting the addresses has to
 * happen where the text enters, not at each place it might come to rest. The
 * length cap and the control-character squash are for the same reason — a
 * stored column and a log line are both places an unbounded, newline-bearing
 * provider string does damage.
 */
export function safeDetail(text: string | null | undefined): string {
  if (!text) return "";
  const flattened = text
    // Flattened BEFORE anything looks for an address, so a value split across a
    // line break is one run of spaces rather than a break the patterns above
    // cannot see across. Stated as what survives rather than as a
    // control-character range, because the hazard is any character that renders
    // as something other than itself in a log line or a stored column.
    .replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Zs}]/gu, " ")
    .replace(/\s+/g, " ");
  return (
    flattened
      // Named form first: it consumes the display name, which the bare pattern
      // would leave standing beside a redacted address. Both are built here
      // rather than held at module scope: a `g` flag carries a `lastIndex`, and
      // a shared one is a cross-call dependency waiting for the first caller
      // that reaches for `.test()` instead of `.replace()`.
      .replace(new RegExp(NAMED_ADDRESS, "g"), "[address]")
      .replace(new RegExp(ADDRESS_LIKE, "g"), "[address]")
      .trim()
      .slice(0, MAX_DETAIL_CHARS)
  );
}

function readEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * The credential, or null when it is absent or half-set.
 *
 * Both halves are required: neither a key id nor a secret authorizes anything
 * on its own, so one without the other is a misconfiguration rather than a
 * partial capability. One definition of "set", read by both the rung test and
 * the client build, so the two cannot disagree about what a credential is.
 *
 * Named apart from the object-storage credentials on purpose. `S3_ACCESS_KEY_ID`
 * is a different principal against a different service, and a deployment that
 * confused the two would authenticate — against the wrong account.
 */
function sesCredentials(): {
  accessKeyId: string;
  secretAccessKey: string;
} | null {
  const accessKeyId = readEnv("EMAIL_SES_ACCESS_KEY_ID")?.trim();
  const secretAccessKey = readEnv("EMAIL_SES_SECRET_ACCESS_KEY")?.trim();
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey };
}

/**
 * Did this install ask for SES?
 *
 * The region is deliberately NOT part of this test even though a send without
 * one cannot succeed. An install holding SES credentials asked for SES; folding
 * the region in would answer a different question and drop such an install
 * quietly onto the rung below, which is a mail server it never named or a
 * console that delivers nothing. A missing region is refused out loud at the
 * send instead, naming the variable. See {@link sesRegion}.
 */
export function isSesEmailConfigured(): boolean {
  return sesCredentials() !== null;
}

/**
 * The region the sending identity is verified in, or null when none is set.
 *
 * Required rather than defaulted. A verified identity belongs to one region, so
 * a default is a guess about where the operator did their DNS: guess wrong and
 * the credentials work, the client connects, and every single send comes back
 * rejected for an identity that exists — in the other region. A deploy that is
 * configured and unusable is worse than one that refuses to send, so this
 * returns null and the send says which variable is missing.
 */
export function sesRegion(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return env.EMAIL_SES_REGION?.trim() || null;
}

/** The configuration set to apply, or undefined when none is configured. */
export function sesConfigurationSet(): string | undefined {
  return readEnv("EMAIL_SES_CONFIGURATION_SET")?.trim() || undefined;
}

/**
 * Sends per second when `EMAIL_SES_MAX_SEND_RATE` is unset.
 *
 * The smallest production sending quota SES grants is 14 per second, and the
 * provider measures it over short windows, so pacing right at the quota still
 * trips it whenever a send from elsewhere on the account (another process, a
 * retry) lands in the same second. 10 leaves that headroom while still
 * clearing a thousand-recipient announcement in under two minutes.
 */
export const DEFAULT_SES_MAX_SEND_RATE = 10;

/**
 * The most sends per second this PROCESS may make, from
 * `EMAIL_SES_MAX_SEND_RATE`.
 *
 * The quota is per account, and every process sharing the credential draws on
 * it, so with N sending processes this should be roughly the account quota
 * divided by N. A value that is not a positive number falls back to the
 * default rather than to no limit: an unparseable setting is a typo, and a typo
 * should not be what removes the pacing.
 */
export function sesMaxSendRate(): number {
  const raw = readEnv("EMAIL_SES_MAX_SEND_RATE")?.trim();
  if (!raw) return DEFAULT_SES_MAX_SEND_RATE;
  const rate = Number(raw);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_SES_MAX_SEND_RATE;
}

/**
 * One limiter per process, shared by every send whatever workspace it is for,
 * because the quota it protects belongs to the credential and not to any one
 * workspace. Rebuilt only if the configured rate changes.
 */
let sharedLimiter: SendRateLimiter | null = null;

export function sesSendRateLimiter(): SendRateLimiter {
  const rate = sesMaxSendRate();
  if (!sharedLimiter || sharedLimiter.ratePerSecond !== rate) {
    sharedLimiter = createSendRateLimiter(rate);
  }
  return sharedLimiter;
}

/**
 * One client per process, rebuilt when the credentials or region it was built
 * from change. The client owns an HTTP connection pool, so constructing one per
 * send would trade a pooled connection for a fresh handshake on every email.
 */
let cachedClient: SESv2Client | null = null;
let cachedClientKey: string | null = null;

/**
 * A send refused before it was attempted, because the install is missing
 * something no attempt supplies.
 *
 * Logged here rather than left to the caller: the throw travels up through
 * fire-and-forget paths whose own catch says only that a notification failed,
 * and the one fact worth having is which variable is absent. Permanent, so the
 * retry above it does not spend a backoff on it.
 */
function configFailure(message: string): SesEmailError {
  log.error({ detail: message }, "ses email send refused: not configured");
  return new SesEmailError(message, null, null, false);
}

type SesRetryStrategy = Extract<
  NonNullable<SESv2ClientConfig["retryStrategy"]>,
  { acquireInitialRetryToken: unknown }
>;
type SesRetryToken = Awaited<
  ReturnType<SesRetryStrategy["acquireInitialRetryToken"]>
>;

/** Tries per send for a transient failure, the SDK's own default. */
const SDK_MAX_ATTEMPTS = 3;
const SDK_RETRY_BASE_DELAY_MS = 100;

/**
 * The SDK's retry policy with throttling taken out.
 *
 * Left to its defaults the SDK resends a throttled request itself, up to three
 * tries about half a second apart. That turns one send-rate slot into as many
 * as three SES calls, made while SES is already saying the account is over its
 * rate, which is the burst the limiter exists to prevent. A throttle is instead
 * thrown straight back, classed retryable (see {@link sendFailure}), and the
 * caller retries it on its own schedule, through the limiter again.
 *
 * Not `maxAttempts: 1`. Some sends happen on a request path with no job queue
 * behind them (a sign-in link), and for those the SDK's quick resend of a
 * dropped connection or a 5xx is the only retry there is; removing it would
 * fail a sign-in on a network blip. A transient failure has mostly not counted
 * against the rate (a reset connection, a 503), so resending it inside the slot
 * does not feed the throttle.
 */
function sesRetryStrategy(): SesRetryStrategy {
  const token = (count: number, delay: number): SesRetryToken => ({
    getRetryCount: () => count,
    getRetryDelay: () => delay,
  });
  return {
    acquireInitialRetryToken: async () => token(0, 0),
    refreshRetryTokenForRetry: async (previous, errorInfo) => {
      const retries = previous.getRetryCount() + 1;
      // Throwing is how a strategy declines: the SDK then rethrows the error.
      if (errorInfo.errorType !== "TRANSIENT" || retries >= SDK_MAX_ATTEMPTS) {
        throw new Error("no retry");
      }
      // Full jitter on an exponential base, as the SDK's own backoff does.
      return token(
        retries,
        Math.random() * SDK_RETRY_BASE_DELAY_MS * 2 ** retries,
      );
    },
    recordSuccess: () => {},
  };
}

/** The SDK client options this transport sends with. Exported for its test. */
export function sesClientConfig(
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: string },
): SESv2ClientConfig {
  return { region, credentials, retryStrategy: sesRetryStrategy() };
}

/**
 * The client and the region it was built for, so the two cannot drift apart on
 * the way to the send.
 */
function depsFromEnv(): SesEmailDeps {
  // Re-asked at the send rather than assumed from the rung: this is exported,
  // and a caller reaching it without the ladder must fail closed rather than
  // build a client that signs with nothing.
  const credentials = sesCredentials();
  if (!credentials) {
    throw configFailure(
      "EMAIL_SES_ACCESS_KEY_ID and EMAIL_SES_SECRET_ACCESS_KEY are both required to send",
    );
  }
  const region = sesRegion();
  if (!region) {
    throw configFailure(
      "EMAIL_SES_REGION is required to send: a verified sending identity belongs to one region",
    );
  }
  // The key id identifies the principal and is not itself a secret; the secret
  // is never part of this string.
  const key = `${region}:${credentials.accessKeyId}`;
  if (!cachedClient || cachedClientKey !== key) {
    log.info({ region }, "initializing ses client");
    cachedClient = new SESv2Client(sesClientConfig(region, credentials));
    cachedClientKey = key;
  }
  return {
    client: cachedClient,
    region,
    configurationSet: sesConfigurationSet(),
  };
}

/** Turn whatever the SDK threw into an error that says whether to try again. */
function sendFailure(
  error: unknown,
  from: string,
  tenantName?: string,
): SesEmailError {
  const shaped = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  const rawStatus = shaped?.$metadata?.httpStatusCode;
  const status = typeof rawStatus === "number" ? rawStatus : null;
  // Two vocabularies, never both at once. A modeled service exception carries a
  // `name` (`MessageRejected`) and no `code`; a socket failure carries a `code`
  // (`ECONNREFUSED`, `ECONNRESET`, `ENOTFOUND`) under the generic name `Error`.
  // The socket code wins where present, because it is the one the retry
  // classifiers downstream are written against, and taking `name` alone
  // discards it and hands them the word "Error".
  const socketCode =
    typeof shaped?.code === "string" && shaped.code !== "" ? shaped.code : null;
  const exceptionName =
    typeof shaped?.name === "string" && shaped.name !== "" ? shaped.name : null;
  const code = socketCode ?? exceptionName;
  const detail =
    safeDetail(typeof shaped?.message === "string" ? shaped.message : null) ||
    `HTTP ${status ?? "unknown"}`;
  // No status means no answer: the connection was refused, the socket died, DNS
  // missed, or the attempt timed out before SES said anything. Those describe
  // the moment rather than the message, and a message dropped for one of them
  // is dropped for good — the row is already committed and nothing re-sends it.
  // Retrying an ambiguous failure costs at most a duplicate; not retrying this
  // one costs the mail.
  //
  // The SDK's own `$retryable` marker is deliberately not consulted. It appears
  // only on modeled service exceptions, never on a socket failure, and by the
  // time an error reaches here the SDK has already spent its own retry budget
  // acting on it.
  const rawMessage =
    typeof shaped?.message === "string" ? shaped.message : null;
  if (
    tenantName &&
    isTenantPausedFailure({ tenantName, code, message: rawMessage })
  ) {
    // A warning, not an error: the provider is doing what it was asked to, and
    // the workspace's managers are told through the app, not through this line.
    log.warn(
      {
        status,
        code,
        from_domain: addressDomain(from),
        tenant: tenantName,
        detail,
      },
      "ses email send refused: tenant paused",
    );
    return new SesTenantPausedError(tenantName, detail, status, code);
  }
  const throttled = isThrottling(status, code);
  const retryable = status === null || statusIsRetryable(status) || throttled;
  // The sending DOMAIN, never the address: the single most common cause of a
  // rejection here is a From whose identity is not verified in this region, and
  // a status code alone leaves that undiagnosable. The domain is configuration;
  // the local part beside it is PII.
  const fields = { status, code, from_domain: addressDomain(from), detail };
  // Throttling is "not this second", and every caller retries it, so it is a
  // warning here; the caller that finally gives up is the one that says error.
  if (throttled) log.warn(fields, "ses email send throttled");
  else log.error(fields, "ses email send failed");
  return new SesEmailError(
    `SES email send failed: ${detail}`,
    status,
    code,
    retryable,
  );
}

/**
 * Send one message. Throws `SesEmailError` on any outcome that is not a clean
 * hand-off.
 *
 * Acceptance is the assigned message id, not the absence of an exception. SES
 * answers a successful `SendEmail` with exactly one field, `MessageId`, and it
 * is the provider's receipt: the id exists because the message was queued for
 * delivery. A 2xx carrying no id is therefore not a send we can report, and it
 * is counted as a failure rather than reported as a success with nothing to
 * show for it.
 *
 * The rule is deliberately about that one field and no more. A field a provider
 * fills only sometimes — a per-recipient delivery group, say — looks like
 * stronger evidence and is not: demanding it turns every real send into a
 * rejection. Evidence is only worth requiring when it is what acceptance
 * actually produces.
 */
export async function sendViaSes(
  request: SesSendRequest,
  deps: SesEmailDeps = depsFromEnv(),
): Promise<SesSendResult> {
  // The filter lives here, with the constraint it enforces, rather than in one
  // caller: supplying a platform-controlled header is a hard rejection, so every
  // route into this transport has to be covered, not just the first one written.
  const { headers, dropped } = stripPlatformControlledHeaders(
    request.headers ?? {},
  );
  if (dropped.length > 0) {
    log.debug(
      { dropped_headers: dropped },
      "platform-controlled headers dropped before send",
    );
  }
  // Applied to what survived the strip, which is what actually goes out.
  const headerList = Object.entries(
    completeThreadingIds(headers, deps.region),
  ).map(([Name, Value]) => ({ Name, Value }));

  const command = new SendEmailCommand({
    // Re-rendered rather than passed through: the API takes the whole RFC 5322
    // form, and a display name with a comma or a non-ASCII character in it makes
    // this field parse as something other than one sender. See formatAddress.
    FromEmailAddress: formatAddress(request.from),
    Destination: {
      ToAddresses: Array.isArray(request.to) ? request.to : [request.to],
    },
    // A team's reply address can carry a display name too, and this list is
    // parsed the same way.
    ...(request.replyTo !== undefined
      ? { ReplyToAddresses: [formatAddress(request.replyTo)] }
      : {}),
    ...(deps.configurationSet
      ? { ConfigurationSetName: deps.configurationSet }
      : {}),
    ...(request.tenantName ? { TenantName: request.tenantName } : {}),
    Content: {
      Simple: {
        Subject: { Data: request.subject, Charset: "UTF-8" },
        Body: {
          ...(request.html !== undefined
            ? { Html: { Data: request.html, Charset: "UTF-8" } }
            : {}),
          ...(request.text !== undefined
            ? { Text: { Data: request.text, Charset: "UTF-8" } }
            : {}),
        },
        ...(headerList.length > 0 ? { Headers: headerList } : {}),
        ...(request.attachments && request.attachments.length > 0
          ? {
              Attachments: request.attachments.map((attachment) => ({
                RawContent: attachment.content,
                FileName: attachment.filename,
                ContentType: attachment.contentType,
                ContentDisposition: "ATTACHMENT" as const,
              })),
            }
          : {}),
      },
    },
  });

  // Paced at the last moment, after everything that could refuse the send
  // without spending a slot on it.
  const limiter = deps.limiter ?? sesSendRateLimiter();
  try {
    await limiter.acquire();
  } catch (error) {
    if (!(error instanceof SendRateQueueFullError)) throw error;
    log.warn(
      {
        wait_ms: Math.round(error.waitMs),
        rate_per_second: limiter.ratePerSecond,
      },
      "ses send rate queue full; send deferred",
    );
    // A 429 because it is one, answered locally rather than by the provider:
    // the same retry every caller already applies to the provider's own.
    throw new SesEmailError(
      "SES email send deferred: the send rate queue is full",
      429,
      "SendRateQueueFull",
      true,
    );
  }

  let response: SendEmailCommandOutput;
  try {
    response = await deps.client.send(command);
  } catch (error) {
    throw sendFailure(error, request.from, request.tenantName);
  }

  // Reported as given, minus the brackets a header form would carry, and
  // checked against what an id may contain rather than merely against being
  // empty. This value is stored and later compared for equality, so a shape
  // nothing could ever match is as useless as no id at all.
  const messageId =
    typeof response.MessageId === "string"
      ? response.MessageId.trim().replace(/^<|>$/g, "")
      : "";
  if (!ASSIGNED_MESSAGE_ID.test(messageId)) {
    const status =
      typeof response.$metadata?.httpStatusCode === "number"
        ? response.$metadata.httpStatusCode
        : null;
    log.error(
      { status, from_domain: addressDomain(request.from) },
      "ses send returned no usable message id",
    );
    // Thrown rather than returned, and retryable rather than permanent.
    //
    // Thrown, because the id is not a nicety here: it is the reply-routing
    // mechanism on this rung, and returning an unusable one would let it be
    // recorded as the outbound Message-ID and poison every later attempt to
    // resolve a reply against it.
    //
    // Retryable, because a retry does yield new information — an id to store.
    // A real acceptance always carries one, so a response without one came from
    // something between us and SES rather than from SES, and that is a property
    // of the attempt. The duplicate a retry risks is self-limiting: the
    // plus-addressed Reply-To is per conversation and identical on every
    // attempt, so both copies thread into the same place. A duplicate beats a
    // silent drop.
    throw new SesEmailError(
      "SES email send returned no usable message id",
      status,
      null,
      true,
    );
  }

  return { messageId };
}
