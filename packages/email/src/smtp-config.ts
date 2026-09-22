import type SMTPTransport from "nodemailer/lib/smtp-transport";

type SmtpEnv = Record<string, string | undefined>;

/**
 * Build the nodemailer transport options from the environment.
 *
 * `auth` is only included when both a user and a password are set. Passing an
 * `auth` object with undefined values makes nodemailer authenticate anyway,
 * which fails against relays that accept unauthenticated mail. The same goes
 * for `port`: leaving it out lets nodemailer pick the default for the chosen
 * security mode instead of receiving NaN.
 */
export function getSmtpTransportOptions(
  env: SmtpEnv = process.env,
): SMTPTransport.Options {
  if (env.SMTP_IGNORE_TLS === "true") {
    throw new Error(
      "SMTP_IGNORE_TLS=true is no longer supported: it disables STARTTLS, not certificate validation. Remove it and trust your SMTP CA using NODE_EXTRA_CA_CERTS. For an intentionally unencrypted local relay, set SMTP_SECURE=false and SMTP_REQUIRE_TLS=false explicitly.",
    );
  }

  const options: SMTPTransport.Options = {
    host: env.SMTP_HOST,
    secure: env.SMTP_SECURE !== "false",
    requireTLS: env.SMTP_REQUIRE_TLS !== "false",
    ignoreTLS: false,
  };

  if (env.SMTP_PORT) {
    options.port = Number(env.SMTP_PORT);
  }

  if (env.SMTP_USER && env.SMTP_PASSWORD) {
    options.auth = { user: env.SMTP_USER, pass: env.SMTP_PASSWORD };
  }

  return options;
}

/**
 * Whether outgoing mail can be sent at all. This is what the send helpers
 * actually require: a host to connect to and an envelope sender.
 */
export function isSmtpConfigured(env: SmtpEnv = process.env): boolean {
  return Boolean(env.SMTP_HOST) && Boolean(env.SMTP_FROM);
}
