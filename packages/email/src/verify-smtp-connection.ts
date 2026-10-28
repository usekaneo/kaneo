import * as nodemailer from "nodemailer";
import { getSmtpTransportOptions, isSmtpConfigured } from "./smtp-config";
import { getSmtpErrorDetails } from "./smtp-error-details";

export type SmtpVerification =
  | { status: "not_configured" }
  | { status: "ok" }
  | { status: "failed"; code: string; responseCode?: number };

/**
 * Open a connection to the SMTP server, authenticate if credentials are set,
 * and close it again without sending anything. Every phase is bounded by
 * `timeoutMs` so a dead relay can't hold the caller. Failures only report the
 * nodemailer error category and SMTP status, never the server's message.
 */
export async function verifySmtpConnection(
  timeoutMs: number,
  env: Record<string, string | undefined> = process.env,
): Promise<SmtpVerification> {
  if (!isSmtpConfigured(env)) {
    return { status: "not_configured" };
  }

  let transport: nodemailer.Transporter | undefined;
  try {
    transport = nodemailer.createTransport({
      ...getSmtpTransportOptions(env),
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    });
    await transport.verify();
    return { status: "ok" };
  } catch (error) {
    return { status: "failed", ...getSmtpErrorDetails(error) };
  } finally {
    transport?.close();
  }
}
