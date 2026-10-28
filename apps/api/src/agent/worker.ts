import { completeAutomationRuns } from "./automation/complete-runs";
import { processCodeJobs } from "./code/process-code-jobs";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import { getAgentConfig } from "./config";
import { deliverAgentEffects } from "./effects";
import { executeAgentRun, failExpiredRuns } from "./runner";

let timer: ReturnType<typeof setInterval> | undefined;
let shutdown = new AbortController();
let polling = false;
let codePoll: Promise<void> | undefined;
const active = new Set<Promise<void>>();

export async function processAgentQueue(signal: AbortSignal = shutdown.signal) {
  if (!codePoll)
    codePoll = processCodeJobs(signal)
      .catch(() => console.error("Coding worker poll failed"))
      .finally(() => {
        codePoll = undefined;
      });
  await failExpiredRuns();
  await completeAutomationRuns();
  await deliverAgentEffects();
  const config = getAgentConfig();
  if (!config || signal.aborted) return;
  while (active.size < config.concurrency && !signal.aborted) {
    const owner = randomUUID();
    const job = await db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(schema.agentRunTable)
        .where(eq(schema.agentRunTable.status, "queued"))
        .orderBy(schema.agentRunTable.createdAt, schema.agentRunTable.id)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!run) return null;
      const [conversation] = await tx
        .select()
        .from(schema.agentConversationTable)
        .where(eq(schema.agentConversationTable.id, run.conversationId));
      if (!conversation) return null;
      await tx
        .update(schema.agentRunTable)
        .set({
          status: "running",
          leaseOwner: owner,
          leaseExpiresAt: new Date(Date.now() + config.timeoutMs + 10000),
        })
        .where(
          and(
            eq(schema.agentRunTable.id, run.id),
            eq(schema.agentRunTable.status, "queued"),
          ),
        );
      return { run, conversation };
    });
    if (!job) break;
    const task = executeAgentRun(
      job.run,
      job.conversation,
      config,
      owner,
      signal,
    ).catch(() => {
      console.error("Agent worker could not persist run state");
    });
    active.add(task);
    void task.finally(() => active.delete(task));
  }
}

export function initializeAgentWorker() {
  if (timer) return;
  shutdown = new AbortController();
  timer = setInterval(() => {
    if (polling) return;
    polling = true;
    void processAgentQueue()
      .catch(() => console.error("Agent worker poll failed"))
      .finally(() => {
        polling = false;
      });
  }, 1000);
  timer.unref();
}

export async function shutdownAgentWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
  shutdown.abort();
  await Promise.race([
    Promise.allSettled([...active, ...(codePoll ? [codePoll] : [])]),
    new Promise((resolve) => {
      const deadline = setTimeout(resolve, 5000);
      deadline.unref();
    }),
  ]);
}
