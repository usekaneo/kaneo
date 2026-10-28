import { HTTPException } from "hono/http-exception";
import type { ImportRunProject } from "./import-run-project";

export const MAX_ACTIVE_IMPORTS = 2;

export const RESTARTING_MESSAGE =
  "Kaneo is restarting. Start the import again in a minute.";

export type ImportSlot = {
  controller: AbortController;
  runId: string | null;
  job: Promise<void> | null;
  projects: () => ImportRunProject[];
  settled: Promise<void>;
};

const slots = new Map<ImportSlot, () => void>();
let shuttingDown = false;

export function reserveImportSlot(): ImportSlot | null {
  if (shuttingDown) {
    throw new HTTPException(503, { message: RESTARTING_MESSAGE });
  }
  if (slots.size >= MAX_ACTIVE_IMPORTS) return null;

  let settle: () => void = () => {};
  const slot: ImportSlot = {
    controller: new AbortController(),
    runId: null,
    job: null,
    projects: () => [],
    settled: new Promise<void>((resolve) => {
      settle = resolve;
    }),
  };
  slots.set(slot, settle);
  return slot;
}

export function releaseImportSlot(slot: ImportSlot) {
  slots.get(slot)?.();
  slots.delete(slot);
}

export function trackImportJob(
  slot: ImportSlot,
  runId: string,
  job: Promise<void>,
  projects: () => ImportRunProject[],
) {
  slot.runId = runId;
  slot.projects = projects;
  slot.job = job.finally(() => releaseImportSlot(slot));
  slots.get(slot)?.();
}

export function stopAcceptingImports() {
  shuttingDown = true;
}

export function activeImportSlots(): ImportSlot[] {
  return [...slots.keys()];
}

export async function waitForActiveImports() {
  await Promise.allSettled(activeImportSlots().map((slot) => slot.job));
}
