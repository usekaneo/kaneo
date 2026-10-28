import type { SourceProject } from "@kaneo/importers";
import { HTTPException } from "hono/http-exception";
import { eventContext } from "../../events";
import {
  type ImportSlot,
  MAX_ACTIVE_IMPORTS,
  releaseImportSlot,
  reserveImportSlot,
  trackImportJob,
} from "../active-imports";
import { logImportError } from "../log-import-error";
import { type ImportJobState, runImportJob } from "../run-import-job";
import { assertNoRunningImport } from "../runs/assert-no-running-import";
import { createImportRun } from "../runs/create-import-run";
import { toImportRunResponse } from "../runs/to-import-run-response";
import type { ImportConnectionInput } from "../schema";
import {
  importHttpError,
  type OpenedImportSource,
  openImportSource,
} from "../source/open-import-source";
import { selectSourceProjects } from "../source/select-source-projects";

const CONNECT_TIMEOUT_MS = 90_000;

type StartImportRunInput = {
  workspaceId: string;
  userId: string;
  connection: ImportConnectionInput;
  projectIds: string[];
  includeComments: boolean;
};

async function connectAndList(
  slot: ImportSlot,
  connection: ImportConnectionInput,
): Promise<{ opened: OpenedImportSource; available: SourceProject[] }> {
  const timer = setTimeout(() => {
    slot.controller.abort(
      new DOMException("The source took too long to answer.", "TimeoutError"),
    );
  }, CONNECT_TIMEOUT_MS);

  try {
    const opened = await openImportSource(connection, slot.controller.signal);
    try {
      return { opened, available: await opened.source.listProjects() };
    } catch (error) {
      throw importHttpError(opened.describe(error));
    }
  } finally {
    clearTimeout(timer);
  }
}

async function startImportRun({
  workspaceId,
  userId,
  connection,
  projectIds,
  includeComments,
}: StartImportRunInput) {
  const slot = reserveImportSlot();
  if (!slot) {
    throw new HTTPException(429, {
      message: `This Kaneo server is already running ${MAX_ACTIVE_IMPORTS} imports. Try again when one of them finishes.`,
    });
  }

  try {
    await assertNoRunningImport(workspaceId);
    const { opened, available } = await connectAndList(slot, connection);
    const projects = selectSourceProjects(
      projectIds,
      available,
      opened.sourceName,
    );

    const run = await createImportRun({
      workspaceId,
      userId,
      source: opened.sourceId,
      includeComments,
      projects,
    });

    const state: ImportJobState = { projects: run.projects };
    const job = eventContext.exit(() =>
      runImportJob({
        runId: run.id,
        workspaceId,
        userId,
        includeComments,
        opened,
        state,
        signal: slot.controller.signal,
      }),
    );
    trackImportJob(
      slot,
      run.id,
      job.catch((error) => logImportError("Import job crashed", run.id, error)),
      () => state.projects,
    );

    return toImportRunResponse(run);
  } catch (error) {
    releaseImportSlot(slot);
    throw error;
  }
}

export default startImportRun;
