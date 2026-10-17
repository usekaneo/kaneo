import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export type ImportCandidate = {
  readonly title: string;
  readonly description?: string | undefined;
  readonly status?: string | undefined;
  readonly priority?: string | undefined;
  readonly startDate?: string | null | undefined;
  readonly dueDate?: string | null | undefined;
  readonly userId?: string | null | undefined;
  readonly labels: number;
};

const SHAPE_HINT =
  "Use the output of kaneo task export, or a JSON array of tasks with at least a title.";

type Fields = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message: string): InvalidArgument {
  return new InvalidArgument({ message, hint: SHAPE_HINT });
}

function readTasks(document: unknown): unknown[] | null {
  if (Array.isArray(document)) return document;
  if (isRecord(document) && Array.isArray(document.tasks)) {
    return document.tasks;
  }
  return null;
}

function text(
  fields: Fields,
  key: string,
  where: string,
): Result.Result<string | undefined, InvalidArgument> {
  const value = fields[key];
  if (value === undefined || value === null) return Result.succeed(undefined);
  return typeof value === "string"
    ? Result.succeed(value)
    : Result.fail(invalid(`${where} has a ${key} that is not text.`));
}

function nullableText(
  fields: Fields,
  key: string,
  where: string,
): Result.Result<string | null | undefined, InvalidArgument> {
  if (fields[key] === null) return Result.succeed(null);
  return text(fields, key, where);
}

function date(
  fields: Fields,
  key: string,
  where: string,
): Result.Result<string | null | undefined, InvalidArgument> {
  return Result.flatMap(nullableText(fields, key, where), (value) => {
    if (typeof value !== "string") return Result.succeed(value);
    if (value.trim() === "") return Result.succeed(null);
    return Number.isNaN(Date.parse(value))
      ? Result.fail(invalid(`${where} has an invalid ${key} "${value}".`))
      : Result.succeed(value);
  });
}

function parseTask(
  item: unknown,
  index: number,
): Result.Result<ImportCandidate, InvalidArgument> {
  const where = `Task ${index + 1}`;
  if (!isRecord(item)) {
    return Result.fail(invalid(`${where} is not an object.`));
  }
  const title = typeof item.title === "string" ? item.title.trim() : "";
  if (title === "") {
    return Result.fail(invalid(`${where} has no title.`));
  }
  const named = `${where} (${title})`;
  return Result.all({
    description: text(item, "description", named),
    status: text(item, "status", named),
    priority: text(item, "priority", named),
    startDate: date(item, "startDate", named),
    dueDate: date(item, "dueDate", named),
    userId: nullableText(item, "userId", named),
  }).pipe(
    Result.map((fields) => ({
      title,
      ...fields,
      status: fields.status?.trim() || undefined,
      priority: fields.priority?.trim() || undefined,
      labels: Array.isArray(item.labels) ? item.labels.length : 0,
    })),
  );
}

export function parseImportDocument(
  content: string,
  source: string,
): Result.Result<ImportCandidate[], InvalidArgument> {
  let document: unknown;
  try {
    document = JSON.parse(content);
  } catch {
    return Result.fail(invalid(`${source} is not valid JSON.`));
  }
  const items = readTasks(document);
  if (items === null) {
    return Result.fail(invalid(`${source} has no list of tasks.`));
  }
  if (items.length === 0) {
    return Result.fail(
      new InvalidArgument({ message: `${source} has no tasks to import.` }),
    );
  }
  const tasks: ImportCandidate[] = [];
  for (const [index, item] of items.entries()) {
    const parsed = parseTask(item, index);
    if (Result.isFailure(parsed)) return Result.fail(parsed.failure);
    tasks.push(parsed.success);
  }
  return Result.succeed(tasks);
}
