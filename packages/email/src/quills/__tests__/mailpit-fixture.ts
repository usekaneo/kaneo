/**
 * Test fixture for the mailpit SMTP server from docker-compose.
 *
 * Mirrors db-test-fixture: probe once, expose `available`, and let suites guard
 * themselves with `describe.skipIf(!fixture.available)` so a machine without
 * Docker running skips instead of failing.
 *
 * Mailpit accepts real SMTP on :1025 and exposes every received message over a
 * REST API on :8025, so a test can send through the actual nodemailer transport
 * and then assert on what a mail client would receive — rendered HTML, MIME
 * structure, and the RFC 5322 threading headers. That is the part a mocked
 * transport cannot check: it can only confirm nodemailer was called.
 */

const API = process.env.MAILPIT_API_URL ?? "http://localhost:8025";
const SMTP_HOST = process.env.MAILPIT_SMTP_HOST ?? "localhost";
const SMTP_PORT = process.env.MAILPIT_SMTP_PORT ?? "1025";

/** One message as the mailpit list endpoint returns it. */
export interface MailpitSummary {
  ID: string;
  MessageID: string;
  From: { Name: string; Address: string };
  To: Array<{ Name: string; Address: string }>;
  Subject: string;
}

/** A single message with its body and headers. */
export interface MailpitMessage extends MailpitSummary {
  HTML: string;
  Text: string;
  Attachments: Array<{ FileName: string; ContentType: string; Size: number }>;
}

async function probe(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/v1/info`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Only opt in against a disposable mailbox: these tests delete its messages.
export const mailpitAvailable =
  process.env.QUACKBACK_EMAIL_MAILPIT_TESTS === "1" && (await probe());

/**
 * Point the email package's provider selection at mailpit for the duration of
 * a suite. Returns a restore function.
 *
 * Deliberately sets the env rather than injecting a transport: provider
 * selection reads `process.env` at call time (see getProvider), so this
 * exercises the same branch production takes.
 */
export function useMailpitEnv(): () => void {
  const keys = [
    "EMAIL_SMTP_HOST",
    "EMAIL_SMTP_PORT",
    "EMAIL_SMTP_USER",
    "EMAIL_SMTP_PASS",
    "EMAIL_SES_ACCESS_KEY_ID",
    "EMAIL_SES_SECRET_ACCESS_KEY",
    "EMAIL_FROM",
  ];
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];

  process.env.EMAIL_SMTP_HOST = SMTP_HOST;
  process.env.EMAIL_SMTP_PORT = SMTP_PORT;
  delete process.env.EMAIL_SMTP_USER;
  delete process.env.EMAIL_SMTP_PASS;
  // SES must be unset or it would win provider selection over SMTP.
  delete process.env.EMAIL_SES_ACCESS_KEY_ID;
  delete process.env.EMAIL_SES_SECRET_ACCESS_KEY;
  process.env.EMAIL_FROM = "Quackback Test <test@quackback.test>";

  return () => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
}

/** Delete every message, so a test can assert on an empty mailbox. */
export async function clearMailbox(): Promise<void> {
  await fetch(`${API}/api/v1/messages`, { method: "DELETE" });
}

/**
 * Wait for exactly `count` messages to arrive. SMTP delivery is asynchronous
 * from the sender's point of view, so polling beats a fixed sleep.
 */
export async function waitForMessages(
  count = 1,
  timeoutMs = 5000,
): Promise<MailpitSummary[]> {
  const deadline = Date.now() + timeoutMs;
  let last: MailpitSummary[] = [];
  while (Date.now() < deadline) {
    const res = await fetch(`${API}/api/v1/messages?limit=50`);
    const body = (await res.json()) as { messages: MailpitSummary[] };
    last = body.messages ?? [];
    if (last.length >= count) return last;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `mailpit: expected ${count} message(s), saw ${last.length} within ${timeoutMs}ms`,
  );
}

/** Full message including rendered bodies. */
export async function getMessage(id: string): Promise<MailpitMessage> {
  const res = await fetch(`${API}/api/v1/message/${id}`);
  return (await res.json()) as MailpitMessage;
}

/**
 * Raw headers for a message. Threading lives here (Message-ID, In-Reply-To,
 * References) and is invisible to the parsed-body endpoints.
 */
export async function getHeaders(
  id: string,
): Promise<Record<string, string[]>> {
  const res = await fetch(`${API}/api/v1/message/${id}/headers`);
  return (await res.json()) as Record<string, string[]>;
}
