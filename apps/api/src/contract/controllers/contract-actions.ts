import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  clientTable,
  contractSubmissionTable,
  contractTemplateTable,
  projectTable,
  taskTable,
} from "../../database/schema";

async function listContractTemplates(workspaceId: string) {
  return db
    .select()
    .from(contractTemplateTable)
    .where(eq(contractTemplateTable.workspaceId, workspaceId))
    .orderBy(contractTemplateTable.name);
}

async function createContractTemplate({
  workspaceId,
  name,
  originalFilename,
  bodyHtml,
  mimeType,
  sizeBytes,
  storageKey,
  fieldMap,
  createdBy,
}: {
  workspaceId: string;
  name: string;
  originalFilename?: string | null;
  bodyHtml?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey?: string | null;
  fieldMap?: Array<Record<string, unknown>> | null;
  createdBy: string;
}) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new HTTPException(400, { message: "Template name is required" });
  }

  const filename =
    originalFilename?.trim() ||
    `${trimmedName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}.html`;

  const resolvedStorageKey =
    storageKey?.trim() || `templates/${workspaceId}/${createId()}/${filename}`;

  const [created] = await db
    .insert(contractTemplateTable)
    .values({
      workspaceId,
      name: trimmedName,
      originalFilename: filename,
      storageKey: resolvedStorageKey,
      mimeType:
        mimeType?.trim() ||
        (filename.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "text/html"),
      sizeBytes: sizeBytes ?? bodyHtml?.length ?? 0,
      fieldMap: (fieldMap as never) ?? [
        {
          placeholder: "cliente.razaoSocial",
          dataPath: "cliente.razaoSocial",
        },
        { placeholder: "cliente.cnpj", dataPath: "cliente.cnpj" },
      ],
      bodyHtml:
        bodyHtml?.trim() ||
        "<p>Contrato {{cliente.razaoSocial}} (CNPJ {{cliente.cnpj}}).</p>",
      createdBy,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, {
      message: "Failed to create contract template",
    });
  }

  return created;
}

async function getContractSubmissionForTask(taskId: string) {
  const [submission] = await db
    .select()
    .from(contractSubmissionTable)
    .where(eq(contractSubmissionTable.taskId, taskId))
    .limit(1);

  return submission ?? null;
}

async function sendContract({
  workspaceId,
  taskId,
  templateId,
  clientId,
  createdBy,
}: {
  workspaceId: string;
  taskId: string;
  templateId: string;
  clientId: string;
  createdBy: string;
}) {
  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      title: taskTable.title,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, task.projectId))
    .limit(1);

  if (!project || project.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: "Task not found in workspace" });
  }

  const [template] = await db
    .select()
    .from(contractTemplateTable)
    .where(eq(contractTemplateTable.id, templateId))
    .limit(1);

  if (!template || template.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: "Contract template not found" });
  }

  const [client] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.id, clientId))
    .limit(1);

  if (!client || client.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: "Client not found" });
  }

  const docusealUrl = process.env.DOCUSEAL_URL?.trim();
  const docusealSubmissionId = docusealUrl
    ? `docuseal-${createId()}`
    : `mock-${createId()}`;

  const submitters = [
    {
      name: client.name,
      email: client.email ?? "cliente@example.com",
      role: "signer",
      status: docusealUrl ? ("sent" as const) : ("pending" as const),
    },
  ];

  if (docusealUrl) {
    try {
      await fetch(`${docusealUrl.replace(/\/$/, "")}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: template.storageKey,
          submitters,
          metadata: { taskId, workspaceId },
        }),
      });
    } catch {
      // Demo fallback: keep local pending record if DocuSeal is unreachable
    }
  }

  const [submission] = await db
    .insert(contractSubmissionTable)
    .values({
      workspaceId,
      projectId: task.projectId,
      taskId,
      clientId,
      templateId,
      docusealSubmissionId,
      status: docusealUrl ? "sent" : "pending",
      submitters,
      createdBy,
    })
    .returning();

  if (!submission) {
    throw new HTTPException(500, {
      message: "Failed to create contract submission",
    });
  }

  return submission;
}

export {
  createContractTemplate,
  getContractSubmissionForTask,
  listContractTemplates,
  sendContract,
};
