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
  const options: SMTPTransport.Options = {
    host: env.SMTP_HOST,
    secure: env.SMTP_SECURE !== "false",
    requireTLS: env.SMTP_REQUIRE_TLS === "true",
    ignoreTLS: env.SMTP_IGNORE_TLS === "true",
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
