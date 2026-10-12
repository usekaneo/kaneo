import type { ImportedProject } from "@kaneo/importers";
import { HTTPException } from "hono/http-exception";
import {
  failUnfinishedProjects,
  type ImportRunProject,
} from "./import-run-project";
import { logImportError } from "./log-import-error";
import {
  createImportRunStore,
  type ImportRunStore,
} from "./runs/import-run-store";
import { createProgressThrottle } from "./runs/progress-throttle";
import type { OpenedImportSource } from "./source/open-import-source";
import { writeImportedProject } from "./write-imported-project";

export type ImportJobState = { projects: ImportRunProject[] };

export type ImportJob = {
  runId: string;
  workspaceId: string;
  userId: string;
  includeComments: boolean;
  opened: OpenedImportSource;
  state: ImportJobState;
  signal: AbortSignal;
};

const HEARTBEAT_MS = 20_000;
const STOPPED = "The import was stopped.";
const UNEXPECTED = "The import stopped because of an unexpected error.";
const SAVE_FAILED = "Kaneo could not save this project.";

function stopReason(signal: AbortSignal) {
  return signal.reason instanceof Error ? signal.reason.message : STOPPED;
}

function updateProject(
  job: ImportJob,
  index: number,
  changes: Partial<ImportRunProject>,
) {
  job.state.projects = job.state.projects.map((project, position) =>
    position === index ? { ...project, ...changes } : project,
  );
  return job.state.projects;
}

async function readSourceProject(
  job: ImportJob,
  store: ImportRunStore,
  sourceId: string,
): Promise<ImportedProject> {
  const progress = createProgressThrottle((message) => {
    void store.save({ message });
  });
  job.opened.resetFailure();
  try {
    return await job.opened.source.readProject(sourceId, {
      includeComments: job.includeComments,
      onProgress: progress.report,
      signal: job.signal,
    });
  } finally {
    progress.cancel();
  }
}

async function importProject(
  job: ImportJob,
  store: ImportRunStore,
  index: number,
) {
  const entry = job.state.projects[index];
  if (!entry) return;

  await store.save({
    message: `Reading ${entry.name}`,
    projects: updateProject(job, index, { status: "running" }),
  });

  let project: ImportedProject;
  try {
    project = await readSourceProject(job, store, entry.sourceId);
  } catch (error) {
    if (job.signal.aborted) return;
    await store.save({
      projects: updateProject(job, index, {
        status: "failed",
        error: job.opened.describe(error).message,
      }),
    });
    return;
  }

  await store.save({ message: `Saving ${entry.name}` });

  try {
    const written = await writeImportedProject({
      workspaceId: job.workspaceId,
      userId: job.userId,
      source: job.opened.sourceId,
      project,
      includeComments: job.includeComments,
    });
    await store.save({
      projects: updateProject(job, index, {
        status: "completed",
        error: null,
        ...written,
      }),
    });
  } catch (error) {
    if (!(error instanceof HTTPException)) {
      logImportError("Failed to save an imported project", job.runId, error);
    }
    await store.save({
      projects: updateProject(job, index, {
        status: "failed",
        error: error instanceof HTTPException ? error.message : SAVE_FAILED,
      }),
    });
  }
}

export async function runImportJob(job: ImportJob): Promise<void> {
  const store = createImportRunStore(job.runId);
  const heartbeat = setInterval(() => {
    void store.save({});
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  let error: string | null = null;
  try {
    for (let index = 0; index < job.state.projects.length; index++) {
      if (job.signal.aborted || store.isDetached()) break;
      await importProject(job, store, index);
    }
    if (job.signal.aborted) error = stopReason(job.signal);
  } catch (unexpected) {
    logImportError("Import run failed", job.runId, unexpected);
    error = UNEXPECTED;
  } finally {
    clearInterval(heartbeat);
  }

  if (error) {
    job.state.projects = failUnfinishedProjects(job.state.projects, error);
  }
  await store.finish({
    status: error ? "failed" : "completed",
    error,
    message: null,
    projects: job.state.projects,
    finishedAt: new Date(),
  });
}
