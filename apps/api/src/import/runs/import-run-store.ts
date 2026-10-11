import { logImportError } from "../log-import-error";
import { type RunChanges, updateRunningRun } from "./update-running-run";

export const FINAL_WRITE_DELAYS_MS = [0, 500, 2_000] as const;

export type ImportRunStore = {
  save(changes: RunChanges): Promise<void>;
  finish(changes: RunChanges): Promise<void>;
  isDetached(): boolean;
  flush(): Promise<void>;
};

type ImportRunStoreOptions = {
  writeRun?: typeof updateRunningRun;
  finalWriteDelaysMs?: readonly number[];
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createImportRunStore(
  runId: string,
  {
    writeRun = updateRunningRun,
    finalWriteDelaysMs = FINAL_WRITE_DELAYS_MS,
  }: ImportRunStoreOptions = {},
): ImportRunStore {
  let chain = Promise.resolve();
  let detached = false;

  async function write(changes: RunChanges) {
    if (!(await writeRun(runId, changes))) detached = true;
  }

  async function saveProgress(changes: RunChanges) {
    if (detached) return;
    try {
      await write(changes);
    } catch (error) {
      logImportError("Failed to save import progress", runId, error);
    }
  }

  async function saveResult(changes: RunChanges) {
    let lastError: unknown;
    for (const delay of finalWriteDelaysMs) {
      if (detached) return;
      if (delay > 0) await wait(delay);
      try {
        await write(changes);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    logImportError("Failed to save the import result", runId, lastError);
  }

  function enqueue(task: () => Promise<void>) {
    chain = chain.then(task);
    return chain;
  }

  return {
    save: (changes) => enqueue(() => saveProgress(changes)),
    finish: (changes) => enqueue(() => saveResult(changes)),
    isDetached: () => detached,
    flush: () => chain,
  };
}
