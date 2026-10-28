import { and, eq } from "drizzle-orm";
import db from "../../database";
import { importRunTable } from "../../database/schema";
import { activeImportSlots, stopAcceptingImports } from "../active-imports";
import {
  failUnfinishedProjects,
  type ImportRunProject,
} from "../import-run-project";
import { logImportError } from "../log-import-error";

export const RESTART_ERROR = "Kaneo restarted during the import.";

const SHUTDOWN_GRACE_MS = 5_000;

async function markStopped(runId: string, projects: ImportRunProject[]) {
  try {
    await db
      .update(importRunTable)
      .set({
        status: "failed",
        error: RESTART_ERROR,
        message: null,
        projects: failUnfinishedProjects(projects, RESTART_ERROR),
        finishedAt: new Date(),
      })
      .where(
        and(eq(importRunTable.id, runId), eq(importRunTable.status, "running")),
      );
  } catch (error) {
    logImportError("Failed to mark an import as stopped", runId, error);
  }
}

function settledBefore(deadline: Promise<void>, promises: unknown[]) {
  return Promise.race([Promise.allSettled(promises), deadline]);
}

export async function stopActiveImports(graceMs = SHUTDOWN_GRACE_MS) {
  stopAcceptingImports();
  if (activeImportSlots().length === 0) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, graceMs);
  });

  await settledBefore(
    deadline,
    activeImportSlots().map((slot) => slot.settled),
  );

  const slots = activeImportSlots();
  for (const slot of slots) slot.controller.abort(new Error(RESTART_ERROR));
  await settledBefore(
    deadline,
    slots.map((slot) => slot.job),
  );
  clearTimeout(timer);

  await Promise.all(
    activeImportSlots().flatMap((slot) =>
      slot.runId ? [markStopped(slot.runId, slot.projects())] : [],
    ),
  );
}
