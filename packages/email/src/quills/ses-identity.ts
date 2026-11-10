/**
 * Amazon SES v2 identity provisioning: the calls that make a domain SENDABLE,
 * as opposed to the one call that sends.
 *
 * SES verifies a domain from records its owner publishes rather than from a zone
 * the provider hosts, which is the entire reason a customer can send as their
 * own domain here. Three things have to happen for that: an identity exists,
 * Easy DKIM has issued the three CNAME tokens the owner publishes, and a custom
 * MAIL FROM subdomain is attached so the envelope sender — and therefore SPF —
 * sits on the customer's domain rather than the provider's.
 *
 * ## A second credential, deliberately
 *
 * The sending credential is scoped to `SendEmail` and nothing else. These calls
 * need more, and the extra permission is not the kind a send path should carry
 * around: a process that can create identities can exhaust an account-wide
 * quota, and one that can DELETE them can silently stop every other workspace's
 * mail. So this module reads its own pair of variables and refuses out loud when
 * they are absent, rather than reaching for the sending credential and producing
 * an opaque `AccessDenied` from AWS at a moment nobody is watching.
 *
 * There is no delete here at all, and that is not an omission. Nothing in this
 * module imports `DeleteEmailIdentityCommand`, so removing a domain in the
 * product removes OUR row and leaves the identity for an operator to reap
 * deliberately. The blast radius of a wrong delete is every workspace, and the
 * cost of leaving one behind is a line in a console.
 *
 * ## Region
 *
 * An identity belongs to one region, and it has to be the region the sending
 * client is pointed at, or every send is rejected for an identity that exists
 * somewhere else. Both halves read {@link sesRegion}, so there is one answer to
 * that question rather than two.
 */
import {
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityDkimSigningAttributesCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import type {
  CreateEmailIdentityCommandOutput,
  GetEmailIdentityCommandOutput,
  PutEmailIdentityDkimSigningAttributesCommandOutput,
  PutEmailIdentityMailFromAttributesCommandOutput,
} from "@aws-sdk/client-sesv2";
import { createLogger } from "@kaneo/logger";
import { safeDetail, sesRegion } from "./ses";

const log = createLogger({ base: { service_name: "quackback-email" } }).child({
  component: "email-ses-identity",
});

/** The IAM actions this module calls, named so a refusal can say what to grant. */
export const SES_IDENTITY_ACTIONS = [
  "ses:CreateEmailIdentity",
  "ses:GetEmailIdentity",
  "ses:PutEmailIdentityMailFromAttributes",
  "ses:PutEmailIdentityDkimSigningAttributes",
] as const;

/**
 * The further IAM actions the same credential calls when the operator isolates
 * reputation per workspace (`EMAIL_SES_TENANTS`); see `ses-tenant.ts`. Granted
 * on `tenant/*`, and the two association actions also on the identities and the
 * configuration set they associate. No tags are set, so no `ses:TagResource`.
 */
export const SES_TENANT_ACTIONS = [
  "ses:CreateTenant",
  "ses:GetTenant",
  "ses:CreateTenantResourceAssociation",
  "ses:DeleteTenantResourceAssociation",
  "ses:GetReputationEntity",
] as const;

/**
 * A provisioning call refused before it was attempted.
 *
 * Permanent, for the reason every configuration failure in this package is: a
 * second attempt supplies no variable the first one lacked. Loud, because the
 * alternative — falling back to the sending credential — would turn a missing
 * grant into an `AccessDeniedException` on an action nobody named, at a layer
 * that cannot say which of the three it was.
 */
export class SesIdentityConfigError extends Error {
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "SesIdentityConfigError";
  }
}

/** A provisioning call SES answered with a failure. */
export class SesIdentityError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    /** The provider's exception name, e.g. `AccessDeniedException`. */
    readonly code: string | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SesIdentityError";
  }
}

/** The DKIM verification states SES reports. */
export type SesDkimStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "TEMPORARY_FAILURE"
  | "NOT_STARTED";

/** The custom MAIL FROM states SES reports. */
export type SesMailFromStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "TEMPORARY_FAILURE";

/**
 * What SES knows about one domain identity.
 *
 * Deliberately flat and provider-shaped: this module reports what SES said, and
 * the caller decides what it means for a row. Every field is nullable because
 * every one of them is absent at some point in an identity's life — the tokens
 * before Easy DKIM has issued them, the MAIL FROM block before it is attached.
 */
export interface SesDomainIdentity {
  domain: string;
  /** Easy DKIM CNAME tokens; three of them once SES has issued any. */
  dkimTokens: string[];
  /**
   * The zone the DKIM CNAMEs point into, when SES names one.
   *
   * Newer regions answer with an explicit zone rather than the historical
   * `dkim.<region>.amazonses.com`, and pointing a customer's CNAME at the wrong
   * zone is a record that never verifies. Preferred over the derived form
   * wherever it is present. See {@link sesDkimCnameTarget}.
   */
  signingHostedZone: string | null;
  dkimStatus: SesDkimStatus | null;
  /**
   * Whose key the identity signs with, when SES says: `ses` for a key SES
   * issued (Easy DKIM, published as CNAMEs), `external` for a key someone
   * supplied. Absent when the response does not name it.
   */
  signingOrigin?: "ses" | "external";
  /** SES's own summary of whether it will sign for this identity. */
  verifiedForSending: boolean;
  mailFrom: { domain: string; status: SesMailFromStatus | null } | null;
}

/**
 * What a create attempt found.
 *
 * `preexisting` is the load-bearing field and the reason this is a wrapper
 * rather than a bare identity. An identity another workspace created answers
 * `AlreadyExistsException`, and the caller has to be able to tell that apart
 * from an identity it just made, because the writes that follow a create are
 * writes only an owner may perform. Folding the two cases into one return value
 * is what made a caller reset another workspace's MAIL FROM.
 */
export interface SesIdentityCreation {
  identity: SesDomainIdentity;
  /** True when SES already held this identity before the call. */
  preexisting: boolean;
}

/** The subset of the SES client this module uses, so tests inject a fake. */
export interface SesIdentityClient {
  send(
    command:
      | CreateEmailIdentityCommand
      | GetEmailIdentityCommand
      | PutEmailIdentityMailFromAttributesCommand
      | PutEmailIdentityDkimSigningAttributesCommand,
  ): Promise<
    | CreateEmailIdentityCommandOutput
    | GetEmailIdentityCommandOutput
    | PutEmailIdentityMailFromAttributesCommandOutput
    | PutEmailIdentityDkimSigningAttributesCommandOutput
  >;
}

/** Injectable so tests never touch the network. */
export interface SesIdentityDeps {
  client: SesIdentityClient;
  /** The region the identity is created in, and the region it must be sent from. */
  region: string;
}

type EnvLike = Record<string, string | undefined>;

function readEnv(key: string, env: EnvLike = process.env): string | undefined {
  return env[key];
}

/**
 * The provisioning credential, or null when it is absent or half-set.
 *
 * Named apart from the sending credential on purpose: they are different
 * principals with different grants, and a deployment that set one where the
 * other was expected would authenticate and then fail on an action it was never
 * given. Both halves are required, for the same reason as the sending pair —
 * neither authorizes anything alone.
 */
function identityCredentials(
  env: EnvLike = process.env,
): { accessKeyId: string; secretAccessKey: string } | null {
  const accessKeyId = readEnv("EMAIL_SES_IDENTITY_ACCESS_KEY_ID", env)?.trim();
  const secretAccessKey = readEnv(
    "EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY",
    env,
  )?.trim();
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey };
}

/**
 * Can this install provision sending identities at all?
 *
 * Credentials only, matching the sending rung's test, so an install that holds
 * the credential is never quietly dropped to a rung that provisions nothing. A
 * missing region is refused out loud at the call, naming the variable.
 */
export function isSesIdentityConfigured(env: EnvLike = process.env): boolean {
  return identityCredentials(env) !== null;
}

/** One client per process, rebuilt when the credential or region changes. */
let cachedClient: SESv2Client | null = null;
let cachedClientKey: string | null = null;

function configFailure(message: string): SesIdentityConfigError {
  log.error({ detail: message }, "ses identity call refused: not configured");
  return new SesIdentityConfigError(message);
}

function depsFromEnv(): SesIdentityDeps {
  return sesManagementClient();
}

/**
 * The identity credential's client and region, for every call that manages
 * account resources rather than sending: identities here, tenants in
 * `ses-tenant.ts`. Refuses out loud when the credential or region is missing.
 */
export function sesManagementClient(): { client: SESv2Client; region: string } {
  const credentials = identityCredentials();
  if (!credentials) {
    throw configFailure(
      "EMAIL_SES_IDENTITY_ACCESS_KEY_ID and EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY are both " +
        "required to verify a sending domain. This is a separate credential from the sending " +
        `one and needs exactly: ${SES_IDENTITY_ACTIONS.join(", ")}. Do not grant ` +
        "ses:DeleteEmailIdentity: one process able to delete identities can stop every " +
        "workspace on this account from sending. With EMAIL_SES_TENANTS it also needs: " +
        `${SES_TENANT_ACTIONS.join(", ")}.`,
    );
  }
  const region = sesRegion();
  if (!region) {
    throw configFailure(
      "EMAIL_SES_REGION is required to verify a sending domain: an identity belongs to one " +
        "region and has to be the region mail is sent from",
    );
  }
  // The key id identifies the principal and is not itself a secret.
  const key = `${region}:${credentials.accessKeyId}`;
  if (!cachedClient || cachedClientKey !== key) {
    log.info({ region }, "initializing ses identity client");
    cachedClient = new SESv2Client({ region, credentials });
    cachedClientKey = key;
  }
  return { client: cachedClient, region };
}

/** Retryable statuses, matching the send transport: the moment, not the request. */
function statusIsRetryable(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

interface ShapedError {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  $metadata?: { httpStatusCode?: unknown };
}

/** The provider exception name, or the socket code where one is present. */
function errorCode(error: unknown): string | null {
  const shaped = error as ShapedError;
  // The socket code wins where present, exactly as the send transport reads it:
  // a connection failure carries `code` under the generic name `Error`, and
  // taking `name` alone would discard the only useful word.
  const socketCode =
    typeof shaped?.code === "string" && shaped.code !== "" ? shaped.code : null;
  const exceptionName =
    typeof shaped?.name === "string" && shaped.name !== "" ? shaped.name : null;
  return socketCode ?? exceptionName;
}

/**
 * Turn whatever the SDK threw into an error that says whether to try again, and
 * that says what to grant when the answer is a missing permission.
 *
 * `AccessDeniedException` is singled out because it is the one failure whose
 * cause is a decision nobody has made yet. Reported as-is it says only that the
 * call was denied; reported with the action it was denied on, it is a work item.
 */
function identityFailure(
  error: unknown,
  action: string,
  domain: string,
): SesIdentityError {
  const shaped = error as ShapedError;
  const rawStatus = shaped?.$metadata?.httpStatusCode;
  const status = typeof rawStatus === "number" ? rawStatus : null;
  const code = errorCode(error);
  const detail =
    safeDetail(typeof shaped?.message === "string" ? shaped.message : null) ||
    `HTTP ${status ?? "unknown"}`;
  // No status means the call never reached SES, which is a property of the
  // moment rather than of the request.
  const retryable = status === null || statusIsRetryable(status);
  const message =
    code === "AccessDeniedException"
      ? `SES refused ${action} for this account. Grant ${action} to the identity credential ` +
        `(EMAIL_SES_IDENTITY_ACCESS_KEY_ID): ${detail}`
      : `SES ${action} failed: ${detail}`;
  // The domain is configuration, not PII, and it is the one fact that makes this
  // line actionable.
  log.error(
    { status, code, action, domain, detail },
    "ses identity call failed",
  );
  return new SesIdentityError(message, status, code, retryable);
}

/** Read an identity response into the flat shape above. */
function toIdentity(
  domain: string,
  response: GetEmailIdentityCommandOutput | CreateEmailIdentityCommandOutput,
): SesDomainIdentity {
  const dkim = response.DkimAttributes;
  const mailFrom =
    "MailFromAttributes" in response ? response.MailFromAttributes : undefined;
  // Region-specific Easy DKIM keys report AWS_SES_<REGION>; all are SES-issued.
  const origin = dkim?.SigningAttributesOrigin;
  const signingOrigin = origin?.startsWith("AWS_SES")
    ? "ses"
    : origin === "EXTERNAL"
      ? "external"
      : undefined;
  return {
    domain,
    dkimTokens: dkim?.Tokens ?? [],
    signingHostedZone: dkim?.SigningHostedZone ?? null,
    dkimStatus: (dkim?.Status as SesDkimStatus | undefined) ?? null,
    ...(signingOrigin ? { signingOrigin } : {}),
    verifiedForSending: response.VerifiedForSendingStatus === true,
    mailFrom: mailFrom?.MailFromDomain
      ? {
          domain: mailFrom.MailFromDomain,
          status:
            (mailFrom.MailFromDomainStatus as SesMailFromStatus | undefined) ??
            null,
        }
      : null,
  };
}

/**
 * Create the domain identity, or report the existing one.
 *
 * `AlreadyExistsException` is not a failure. The customer clicking Add twice,
 * a retried job, and a row re-created after being removed all reach this with
 * the identity already in place, and in every one of those cases the right
 * answer is the identity's current state rather than an error. What it must NOT
 * be read as is proof that this workspace owns the domain — an identity another
 * workspace created is `AlreadyExists` too, which is exactly why ownership is
 * proved by a record only this workspace could publish rather than by anything
 * on this response.
 *
 * That distinction is REPORTED rather than left for the caller to infer, on
 * {@link SesIdentityCreation.preexisting}. A caller that cannot see it will
 * follow a create with the writes a create implies, and on a shared account
 * those land on somebody else's identity.
 *
 * With `signing`, the identity signs with that key under that selector (the
 * caller's own key, published as one TXT record). The private key goes into
 * this one request and nowhere else: it is not logged and not returned. An
 * identity that already exists keeps the key it has; re-keying one is the
 * separate {@link putSesDkimSigningKey}.
 *
 * Without it, Easy DKIM at 2048 bits: SES's own default is 2048 for identities
 * created through the API, and stating it means a change to that default cannot
 * silently downgrade a customer's signing key.
 */
export async function createSesDomainIdentity(
  domain: string,
  deps: SesIdentityDeps = depsFromEnv(),
  signing?: { selector: string; privateKey: string },
): Promise<SesIdentityCreation> {
  const command = new CreateEmailIdentityCommand({
    EmailIdentity: domain,
    DkimSigningAttributes: signing
      ? {
          DomainSigningSelector: signing.selector,
          DomainSigningPrivateKey: signing.privateKey,
        }
      : { NextSigningKeyLength: "RSA_2048_BIT" },
  });
  try {
    const response = (await deps.client.send(
      command,
    )) as CreateEmailIdentityCommandOutput;
    log.info({ domain, region: deps.region }, "ses domain identity created");
    return { identity: toIdentity(domain, response), preexisting: false };
  } catch (error) {
    if (errorCode(error) === "AlreadyExistsException") {
      const existing = await getSesDomainIdentity(domain, deps);
      if (existing) return { identity: existing, preexisting: true };
      // The identity was reported as existing and then could not be read. That
      // is a race or a permission gap, not a state to guess at.
      throw new SesIdentityError(
        `SES reports an identity for this domain that it will not describe`,
        null,
        "AlreadyExistsException",
        true,
      );
    }
    throw identityFailure(error, "ses:CreateEmailIdentity", domain);
  }
}

/** Read one identity, or null when SES has never heard of it. */
export async function getSesDomainIdentity(
  domain: string,
  deps: SesIdentityDeps = depsFromEnv(),
): Promise<SesDomainIdentity | null> {
  try {
    const response = (await deps.client.send(
      new GetEmailIdentityCommand({ EmailIdentity: domain }),
    )) as GetEmailIdentityCommandOutput;
    return toIdentity(domain, response);
  } catch (error) {
    if (errorCode(error) === "NotFoundException") return null;
    throw identityFailure(error, "ses:GetEmailIdentity", domain);
  }
}

/**
 * Attach a custom MAIL FROM subdomain to an identity.
 *
 * ## Why this is not optional
 *
 * Without it the envelope sender is the provider's own domain, so SPF passes
 * for the PROVIDER and aligns with nothing the customer owns. DMARC then rests
 * on DKIM alone, and DKIM alone is exactly the arrangement that fails the moment
 * a hop rewrites a body. Aligned SPF is the second leg, and this call is the
 * only way to get one on a domain the provider does not host.
 *
 * ## Why the failure behaviour is a fallback and not a refusal
 *
 * SES offers two behaviours when the MAIL FROM MX record cannot be found, and
 * the choice is between two different outages. `REJECT_MESSAGE` stops the mail:
 * a customer who reorganises their DNS a year from now loses every outbound
 * support reply until someone notices. `USE_DEFAULT_VALUE` sends anyway with the
 * provider's domain as the envelope sender, which costs SPF ALIGNMENT and keeps
 * delivery — and DKIM, which is aligned and signed with the customer's own keys,
 * still carries DMARC on its own for directly delivered mail.
 *
 * So the strictness is spent where it is cheap and the leniency where it is
 * expensive: a domain is not marked verified here until the MX record is
 * actually found, and once verified a later regression degrades alignment
 * instead of destroying deliverability.
 *
 * That trade only holds if something notices the regression, which a button a
 * person clicks does not. The `sending-domain-recheck` queue is what makes the
 * claim true: it re-asks both authorities on a schedule and demotes a row whose
 * MAIL FROM, DKIM or ownership record has gone, which drops the workspace back
 * to the platform sender rather than leaving it signing on one leg. Removing
 * that queue turns this paragraph back into a hope.
 */
export async function putSesMailFromDomain(
  domain: string,
  mailFromDomain: string,
  deps: SesIdentityDeps = depsFromEnv(),
): Promise<void> {
  try {
    await deps.client.send(
      new PutEmailIdentityMailFromAttributesCommand({
        EmailIdentity: domain,
        MailFromDomain: mailFromDomain,
        BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
      }),
    );
    log.info(
      { domain, mail_from_domain: mailFromDomain },
      "ses custom mail from attached",
    );
  } catch (error) {
    throw identityFailure(
      error,
      "ses:PutEmailIdentityMailFromAttributes",
      domain,
    );
  }
}

/**
 * Make an existing identity sign with the caller's own key under its selector.
 *
 * The caller decides when this is safe: re-keying an identity replaces the key
 * every sender on the account signs with for that domain, so it is only ever
 * done for a domain whose owner has just proved control of the zone by
 * publishing this same key. The private key goes into this one request and
 * nowhere else: it is not logged, and a failure carries the provider's message,
 * never the request.
 */
export async function putSesDkimSigningKey(
  domain: string,
  signing: { selector: string; privateKey: string },
  deps: SesIdentityDeps = depsFromEnv(),
): Promise<void> {
  try {
    await deps.client.send(
      new PutEmailIdentityDkimSigningAttributesCommand({
        EmailIdentity: domain,
        SigningAttributesOrigin: "EXTERNAL",
        SigningAttributes: {
          DomainSigningSelector: signing.selector,
          DomainSigningPrivateKey: signing.privateKey,
        },
      }),
    );
    log.info(
      { domain, selector: signing.selector },
      "ses identity re-keyed to a supplied key",
    );
  } catch (error) {
    throw identityFailure(
      error,
      "ses:PutEmailIdentityDkimSigningAttributes",
      domain,
    );
  }
}

// ============================================================================
// The record values SES expects to find. Provider knowledge, so it lives beside
// the provider's client rather than in the domain layer that composes rows out
// of it.
// ============================================================================

/**
 * Where one Easy DKIM CNAME must point.
 *
 * The hosted zone SES named is preferred over the derived form, because newer
 * regions publish keys in a zone that is not `dkim.<region>.amazonses.com` and a
 * CNAME pointing at the wrong zone is a record that resolves to nothing and
 * never verifies. The derived form is the fallback for a response that names no
 * zone, which is every response from the regions that predate the field.
 */
export function sesDkimCnameTarget(
  token: string,
  opts: { region: string; signingHostedZone?: string | null },
): string {
  const zone = opts.signingHostedZone?.trim();
  return zone
    ? `${token}.${zone}`
    : `${token}.dkim.${opts.region}.amazonses.com`;
}

/** The MX host a custom MAIL FROM subdomain points at, per region. */
export function sesMailFromMxValue(region: string): string {
  return `feedback-smtp.${region}.amazonses.com`;
}

/** The SPF record a custom MAIL FROM subdomain publishes. */
export const SES_MAIL_FROM_SPF_VALUE = "v=spf1 include:amazonses.com ~all";

/** Preference on the MAIL FROM MX record. One host, so the number is by convention. */
export const SES_MAIL_FROM_MX_PRIORITY = 10;

/** The operator setting that moves new domains' return path onto one CNAME. */
export const RETURN_PATH_DOMAIN_ENV = "EMAIL_RETURN_PATH_DOMAIN";

/** Two or more DNS labels, each 1-63 of `[a-z0-9-]` not starting or ending with `-`. */
const RETURN_PATH_DOMAIN_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * The domain the operator serves bounce records under, or null when unset
 * (the default, and every install that has not set one up).
 *
 * When set, the operator publishes a wildcard MX to the provider's feedback
 * host and a wildcard SPF TXT under it, so a customer's MAIL FROM name that is
 * only a CNAME to `<workspace label>.<this domain>` verifies: the provider
 * follows the CNAME and finds both. The customer then publishes one record
 * instead of two, and none of them names the provider. A value that is not a
 * domain name reads as unset; boot validation refuses it before that matters.
 */
export function sesReturnPathDomain(env: EnvLike = process.env): string | null {
  const value = readEnv(RETURN_PATH_DOMAIN_ENV, env)
    ?.trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return value && RETURN_PATH_DOMAIN_RE.test(value) ? value : null;
}
