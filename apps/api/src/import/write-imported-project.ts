import type { ImportedProject, ImportSourceId } from "@kaneo/importers";
import { eq } from "drizzle-orm";
import db from "../database";
import { projectTable } from "../database/schema";
import { publishEvent } from "../events";
import type { ImportCounts } from "./import-run-project";
import { createImportProject } from "./writer/create-import-project";
import { writeProjectContent } from "./writer/write-project-content";

export type WriteImportedProjectInput = {
  workspaceId: string;
  userId: string;
  source: ImportSourceId;
  project: ImportedProject;
  includeComments: boolean;
};

export type WrittenImportProject = {
  projectId: string;
  projectSlug: string;
  counts: ImportCounts;
  warnings: string[];
};

export async function writeImportedProject({
  workspaceId,
  userId,
  source,
  project,
  includeComments,
}: WriteImportedProjectInput): Promise<WrittenImportProject> {
  const name = project.name.trim() || "Untitled project";
  const created = await createImportProject(
    workspaceId,
    name,
    userId,
    project.key,
  );

  let content: Awaited<ReturnType<typeof writeProjectContent>>;
  try {
    content = await db.transaction((tx) =>
      writeProjectContent(tx, {
        projectId: created.id,
        workspaceId,
        userId,
        source,
        project,
        includeComments,
      }),
    );
  } catch (error) {
    await db
      .delete(projectTable)
      .where(eq(projectTable.id, created.id))
      .catch(() => {
        console.error("Failed to remove a partially imported project", {
          projectId: created.id,
        });
      });
    throw error;
  }

  await publishEvent("project.updated", { projectId: created.id });

  return {
    projectId: created.id,
    projectSlug: created.slug,
    ...content,
  };
}
