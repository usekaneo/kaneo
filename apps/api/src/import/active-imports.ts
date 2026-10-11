import type { ImportRunProject } from "./import-run-project";

export const MAX_ACTIVE_IMPORTS = 2;

export type ImportSlot = {
  controller: AbortController;
  runId: string | null;
  job: Promise<void> | null;
  projects: () => ImportRunProject[];
};

const slots = new Set<ImportSlot>();

export function reserveImportSlot(): ImportSlot | null {
  if (slots.size >= MAX_ACTIVE_IMPORTS) return null;
  const slot: ImportSlot = {
    controller: new AbortController(),
    runId: null,
    job: null,
    projects: () => [],
  };
  slots.add(slot);
  return slot;
}

export function releaseImportSlot(slot: ImportSlot) {
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
}

export function activeImportSlots(): ImportSlot[] {
  return [...slots];
}

export async function waitForActiveImports() {
  await Promise.allSettled(activeImportSlots().map((slot) => slot.job));
}
