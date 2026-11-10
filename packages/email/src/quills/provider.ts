/**
 * Which provider carries outbound mail, decided from the environment alone.
 *
 * Exactly one sending provider may be configured. An install holding two sets
 * of credentials has not said which one it means, and any order this module
 * picked would be a guess that silently sends through the account the operator
 * least expects (or stops sending through the one they set up first when a
 * second appears). So more than one is refused, naming the variables, and the
 * process refuses to start on it (see `assertEmailProviderConfigured`).
 *
 * The one exception is the Resend key's second job. It also fetches the bodies
 * of inbound mail delivered by Resend's webhook, so an install receiving
 * through Resend while sending through SES or SMTP holds it legitimately. That
 * is said out loud with `EMAIL_INBOUND_PROVIDER=resend`, and only then is the
 * key left out of the count. A lone Resend key sends whatever that variable says.
 */

export type EmailProvider = "ses" | "smtp" | "resend" | "console";

type EnvLike = Record<string, string | undefined>;

/**
 * A send refused because the install is not configured for it.
 *
 * Declares itself permanent for the same reason the transport's own errors do.
 * The conversation send path retries anything that does not say otherwise —
 * deliberately, so a new provider error name cannot quietly stop being retried
 * — and a missing environment variable is not something a second attempt
 * supplies. Without the marker a misconfiguration spends the whole backoff
 * before failing exactly as it did on the first try.
 */
export class EmailConfigError extends Error {
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

/** More than one outbound provider is configured. */
export class EmailProviderConflictError extends EmailConfigError {
  constructor(
    readonly providers: Exclude<EmailProvider, "console">[],
    /** Every variable that made a provider count, in provider order. */
    readonly variables: string[],
    message: string,
  ) {
    super(message);
    this.name = "EmailProviderConflictError";
  }
}

const PROVIDER_LABEL: Record<Exclude<EmailProvider, "console">, string> = {
  ses: "Amazon SES",
  smtp: "SMTP",
  resend: "Resend",
};

/** Set and not blank: compose files and env templates leave empty strings. */
function present(env: EnvLike, key: string): boolean {
  return Boolean(env[key]?.trim());
}

/** The Resend key variables that are set, in the order they are read. */
export function resendKeyVariables(env: EnvLike): string[] {
  return ["EMAIL_RESEND_API_KEY", "RESEND_API_KEY"].filter((key) =>
    present(env, key),
  );
}

/** The Resend key, from either name. */
export function resendApiKey(env: EnvLike = process.env): string | undefined {
  const name = resendKeyVariables(env)[0];
  return name ? env[name]?.trim() : undefined;
}

/** Is Resend explicitly the inbound provider? */
export function isResendInbound(env: EnvLike): boolean {
  return (env.EMAIL_INBOUND_PROVIDER ?? "").trim().toLowerCase() === "resend";
}

/**
 * Every sending provider the environment configures, with the variables that
 * configured it. Half an SES credential counts as nothing: neither half
 * authorizes a send alone, and the SES rung itself treats it the same way.
 */
function configuredProviders(
  env: EnvLike,
): Array<{ provider: Exclude<EmailProvider, "console">; variables: string[] }> {
  const found: Array<{
    provider: Exclude<EmailProvider, "console">;
    variables: string[];
  }> = [];
  if (
    present(env, "EMAIL_SES_ACCESS_KEY_ID") &&
    present(env, "EMAIL_SES_SECRET_ACCESS_KEY")
  ) {
    found.push({
      provider: "ses",
      variables: ["EMAIL_SES_ACCESS_KEY_ID", "EMAIL_SES_SECRET_ACCESS_KEY"],
    });
  }
  if (present(env, "EMAIL_SMTP_HOST")) {
    found.push({ provider: "smtp", variables: ["EMAIL_SMTP_HOST"] });
  }
  const resendVars = resendKeyVariables(env);
  // A key kept for inbound beside another sender is that sender's install
  // receiving through Resend, not a second sender.
  if (resendVars.length > 0 && !(isResendInbound(env) && found.length > 0)) {
    found.push({ provider: "resend", variables: resendVars });
  }
  return found;
}

/**
 * The outbound provider, or `console` when none is configured.
 *
 * Throws {@link EmailProviderConflictError} when more than one is configured.
 */
export function resolveEmailProvider(
  env: EnvLike = process.env,
): EmailProvider {
  const found = configuredProviders(env);
  if (found.length === 0) return "console";
  if (found.length === 1) return found[0]!.provider;

  const variables = found.flatMap((f) => f.variables);
  const listed = found
    .map((f) => `${PROVIDER_LABEL[f.provider]} (${f.variables.join(", ")})`)
    .join("; ");
  const inboundHint = found.some((f) => f.provider === "resend")
    ? " If the Resend key is only for receiving mail through Resend, set " +
      "EMAIL_INBOUND_PROVIDER=resend and it is used for inbound only."
    : "";
  throw new EmailProviderConflictError(
    found.map((f) => f.provider),
    variables,
    `More than one outbound email provider is configured: ${listed}. ` +
      `Exactly one may be set, so remove all but one.${inboundHint}`,
  );
}

/** Throws when the environment configures more than one outbound provider. */
export function assertEmailProviderConfigured(
  env: EnvLike = process.env,
): void {
  resolveEmailProvider(env);
}
