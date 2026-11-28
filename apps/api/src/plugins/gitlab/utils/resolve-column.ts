import db from "../../../database";
import {
  resolveWorkflowColumnSlug,
  type WorkflowResolutionDb,
} from "../../sync/resolve-workflow-column";

export async function resolveTargetStatus(
  projectId: string,
  eventType: string,
  fallbackStatus: string,
  database?: WorkflowResolutionDb,
): Promise<string>;
export async function resolveTargetStatus(
  projectId: string,
  eventType: string,
  fallbackStatus: string | null,
  database?: WorkflowResolutionDb,
): Promise<string | null>;
export async function resolveTargetStatus(
  projectId: string,
  eventType: string,
  fallbackStatus: string | null,
  database: WorkflowResolutionDb = db,
): Promise<string | null> {
  return resolveWorkflowColumnSlug(
    projectId,
    "gitlab",
    eventType,
    fallbackStatus,
    database,
  );
}
