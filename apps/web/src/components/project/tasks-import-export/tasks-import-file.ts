import type { TaskToImport } from "@/fetchers/task/import-tasks";

export function parseTasksImport(content: string): TaskToImport[] | null {
  const data: unknown = JSON.parse(content);
  if (typeof data !== "object" || data === null || !("tasks" in data)) {
    return null;
  }

  return Array.isArray(data.tasks) ? (data.tasks as TaskToImport[]) : null;
}

export function isJsonFile(file: Pick<File, "name" | "type">) {
  return file.type === "application/json" || file.name.endsWith(".json");
}
