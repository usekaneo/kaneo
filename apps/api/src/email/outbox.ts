import { deliverEmail, isEmailConfigured } from "@kaneo/email";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import db from "../database";
import { emailOutboxTable } from "../database/schema";

export type QueuedEmail = {
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  category: string;
  workspaceId?: string | null;
  userId?: string | null;
};

// Minutes to wait after each failed attempt; the last one gives up.
const BACKOFF_MINUTES = [1, 5, 15, 60];
const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;
const BATCH = 20;
// A row stuck in "sending" (the process died mid-send) is retried after this.
const STUCK_MINUTES = 10;
// The delivery log keeps 90 days of mail, sent and failed.
const KEEP_DAYS = 90;

/**
 * Queue an email and try it straight away. Returns once it is safely stored;
 * the send itself happens in the background and is retried on failure.
 */
export async function enqueueEmail(email: QueuedEmail) {
  if (!isEmailConfigured()) return null;
  const [row] = await db
    .insert(emailOutboxTable)
    .values({
      toEmail: email.to,
      subject: email.subject.slice(0, 300),
      html: email.html,
      text: email.text ?? null,
      category: email.category,
      workspaceId: email.workspaceId ?? null,
      userId: email.userId ?? null,
    })
    .returning({ id: emailOutboxTable.id });
  if (row) {
    void claimAndSend([row.id]).catch((error) =>
      console.error("Email send failed; it will be retried", error),
    );
  }
  return row?.id ?? null;
}

/**
 * Marks rows as sending, skipping any another instance already holds, so
 * two API processes never send the same email.
 */
async function claim(ids?: string[]) {
  const only = ids?.length
    ? sql`and id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`
    : sql`and next_attempt_at <= now()`;
  // next_attempt_at doubles as "claimed at" while sending, so a live send is
  // never mistaken for a stuck one.
  const result = await db.execute<{ id: string }>(sql`
    update email_outbox
    set status = 'sending', attempts = attempts + 1, next_attempt_at = now()
    where id in (
      select id from email_outbox
      where status = 'queued' ${only}
      order by next_attempt_at
      limit ${BATCH}
      for update skip locked
    )
    returning id
  `);
  return result.rows.map((row) => row.id);
}

async function sendOne(id: string) {
  const [email] = await db
    .select()
    .from(emailOutboxTable)
    .where(eq(emailOutboxTable.id, id));
  if (!email) return "missing" as const;
  try {
    const result = await deliverEmail({
      to: email.toEmail,
      subject: email.subject,
      html: email.html,
      text: email.text ?? undefined,
      tags: [{ name: "category", value: email.category }],
    });
    await db
      .update(emailOutboxTable)
      .set({
        status: "sent",
        sentAt: new Date(),
        provider: result.provider,
        providerId: result.id,
        lastError: null,
      })
      .where(eq(emailOutboxTable.id, id));
    return "sent" as const;
  } catch (error) {
    const giveUp = email.attempts >= MAX_ATTEMPTS;
    const wait = BACKOFF_MINUTES[email.attempts - 1] ?? 60;
    await db
      .update(emailOutboxTable)
      .set({
        status: giveUp ? "failed" : "queued",
        lastError: (error instanceof Error
          ? error.message
          : String(error)
        ).slice(0, 500),
        nextAttemptAt: new Date(Date.now() + wait * 60_000),
      })
      .where(eq(emailOutboxTable.id, id));
    return giveUp ? ("failed" as const) : ("retry" as const);
  }
}

async function claimAndSend(ids?: string[]) {
  const claimed = await claim(ids);
  const outcomes = [];
  for (const id of claimed) outcomes.push(await sendOne(id));
  return outcomes;
}

/** Scheduler tick: retry what's due, rescue stuck rows, trim old history. */
export async function processEmailOutbox() {
  if (!isEmailConfigured()) return { degraded: false };
  await db
    .update(emailOutboxTable)
    .set({ status: "queued" })
    .where(
      and(
        eq(emailOutboxTable.status, "sending"),
        lt(
          emailOutboxTable.nextAttemptAt,
          new Date(Date.now() - STUCK_MINUTES * 60_000),
        ),
      ),
    );
  const outcomes = await claimAndSend();
  await db
    .delete(emailOutboxTable)
    .where(
      and(
        inArray(emailOutboxTable.status, ["sent", "failed"]),
        lt(
          emailOutboxTable.createdAt,
          new Date(Date.now() - KEEP_DAYS * 86_400_000),
        ),
      ),
    );
  return { degraded: outcomes.includes("failed") };
}

/** Send a failed email again from the start (admin action). */
export async function retryEmail(workspaceId: string, id: string) {
  const [row] = await db
    .update(emailOutboxTable)
    .set({ status: "queued", attempts: 0, nextAttemptAt: new Date() })
    .where(
      and(
        eq(emailOutboxTable.id, id),
        eq(emailOutboxTable.workspaceId, workspaceId),
        eq(emailOutboxTable.status, "failed"),
      ),
    )
    .returning({ id: emailOutboxTable.id });
  if (row) await claimAndSend([row.id]);
  return Boolean(row);
}
