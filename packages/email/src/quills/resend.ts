/**
 * The Resend rung: one outbound send through the Resend API.
 *
 * Kept apart from the ladder in index.ts for the same reason the SES rung is:
 * the request it builds is the thing worth testing, and a client handed in as a
 * parameter lets that be read without a network.
 */
import type {
  CreateEmailOptions,
  CreateEmailRequestOptions,
  CreateEmailResponse,
} from "resend";
import type { EmailAttachment } from "./attachment";

export interface ResendSendRequest {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  /** Threading and any extra headers, already in header form. */
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
  /** Sent as the Idempotency-Key header, so a retried send is delivered once. */
  idempotencyKey?: string;
}

/** The slice of the SDK client this rung uses. */
export interface ResendSendClient {
  emails: {
    send(
      payload: CreateEmailOptions,
      options?: CreateEmailRequestOptions,
    ): Promise<CreateEmailResponse>;
  };
}

export class ResendEmailError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    /** The provider's error name, e.g. `validation_error`. */
    readonly code: string | null,
    /** Whether sending this exact message again could plausibly succeed. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ResendEmailError";
  }
}

/**
 * A statusless failure is retried: it is the network or the SDK failing before
 * Resend answered, which says nothing about the message. A rate limit, a
 * timeout and a server error are about the moment; every other status is about
 * the message and a second attempt gets the same answer.
 */
function isRetryable(status: number | null, name: string | null): boolean {
  // Another attempt with the same idempotency key is still in flight. Trying
  // again later returns that attempt's outcome, so this is about the moment.
  if (name === "concurrent_idempotent_requests") return true;
  if (status === null) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

/**
 * Resend assigns the wire Message-ID itself and reports only its own email id,
 * so a Message-ID of ours is not sent: it would claim an id the recipient may
 * never see. In-Reply-To and References are ours to set and keep the thread.
 */
function withoutMessageId(
  headers: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => name.toLowerCase() !== "message-id",
    ),
  );
}

/** The SDK payload for one message. Optional parts are omitted, not nulled. */
export function buildResendPayload(
  request: ResendSendRequest,
): CreateEmailOptions {
  const headers = withoutMessageId(request.headers ?? {});
  return {
    from: request.from,
    to: request.to,
    subject: request.subject,
    // Every send through the ladder carries html; the SDK's type requires a body.
    html: request.html ?? "",
    ...(request.text !== undefined ? { text: request.text } : {}),
    ...(request.replyTo !== undefined ? { replyTo: request.replyTo } : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(request.attachments && request.attachments.length > 0
      ? {
          attachments: request.attachments.map((attachment) => ({
            filename: attachment.filename,
            contentType: attachment.contentType,
            content: Buffer.from(attachment.content),
          })),
        }
      : {}),
  };
}

/**
 * Send one message. Returns Resend's own id for the email, which names it in
 * Resend's dashboard and events. Throws `ResendEmailError` on a refusal.
 */
export async function sendViaResend(
  request: ResendSendRequest,
  client: ResendSendClient,
): Promise<{ id: string | null }> {
  let response: CreateEmailResponse;
  try {
    response = await client.emails.send(
      buildResendPayload(request),
      request.idempotencyKey
        ? { idempotencyKey: request.idempotencyKey }
        : undefined,
    );
  } catch (error) {
    throw new ResendEmailError(
      `Resend email send failed: ${error instanceof Error ? error.message : "request failed"}`,
      null,
      null,
      true,
    );
  }
  if (response.error) {
    const { name, message, statusCode } = response.error;
    throw new ResendEmailError(
      `Resend email send failed: ${message} (${name})`,
      statusCode,
      name,
      isRetryable(statusCode, name),
    );
  }
  return { id: response.data?.id ?? null };
}
