import { Option, Result } from "effect";
import type {
  ProjectRecord,
  ProjectUpdateBody,
} from "../api/project-writes.js";
import { InvalidArgument } from "../errors/errors.js";
import { DEFAULT_PROJECT_ICON, matchProjectIcon } from "./project-icons.js";
import { validateProjectKey } from "./project-key.js";

export type ProjectEdits = {
  readonly name?: string;
  readonly key?: string;
  readonly description?: string;
  readonly icon?: string;
  readonly isPublic?: boolean;
};

export type ProjectEditFlags = {
  readonly name: Option.Option<string>;
  readonly key: Option.Option<string>;
  readonly description: Option.Option<string>;
  readonly icon: Option.Option<string>;
  readonly public: boolean;
  readonly private: boolean;
};

export function parseProjectEdits(
  flags: ProjectEditFlags,
): Result.Result<ProjectEdits, InvalidArgument> {
  if (flags.public && flags.private) {
    return Result.fail(
      new InvalidArgument({
        message: "Pass either --public or --private, not both.",
      }),
    );
  }
  const edits: {
    name?: string;
    key?: string;
    description?: string;
    icon?: string;
    isPublic?: boolean;
  } = {};
  if (Option.isSome(flags.name)) {
    const name = flags.name.value.trim();
    if (name === "") {
      return Result.fail(
        new InvalidArgument({
          message: "The project name cannot be empty.",
          hint: 'Pass a name, for example --name "Kaneo Web".',
        }),
      );
    }
    edits.name = name;
  }
  if (Option.isSome(flags.key)) {
    const key = validateProjectKey(flags.key.value);
    if (Result.isFailure(key)) return Result.fail(key.failure);
    edits.key = key.success;
  }
  if (Option.isSome(flags.description)) {
    edits.description = flags.description.value;
  }
  if (Option.isSome(flags.icon)) {
    const icon = matchProjectIcon(flags.icon.value);
    if (Result.isFailure(icon)) return Result.fail(icon.failure);
    edits.icon = icon.success;
  }
  if (flags.public) edits.isPublic = true;
  if (flags.private) edits.isPublic = false;
  if (Object.keys(edits).length === 0) {
    return Result.fail(
      new InvalidArgument({
        message: "Nothing to change.",
        hint: "Pass at least one of --name, --key, --description, --icon, --public or --private.",
      }),
    );
  }
  return Result.succeed(edits);
}

export function buildProjectUpdate(
  current: ProjectRecord,
  edits: ProjectEdits,
): ProjectUpdateBody {
  return {
    name: edits.name ?? current.name,
    icon: edits.icon ?? current.icon ?? DEFAULT_PROJECT_ICON,
    slug: edits.key ?? current.slug,
    description: edits.description ?? current.description ?? "",
    isPublic: edits.isPublic ?? current.isPublic ?? false,
  };
}

export function describeEdits(edits: ProjectEdits): string {
  const fields: string[] = [];
  if (edits.name !== undefined) fields.push("name");
  if (edits.key !== undefined) fields.push("key");
  if (edits.description !== undefined) fields.push("description");
  if (edits.icon !== undefined) fields.push("icon");
  if (edits.isPublic !== undefined) {
    fields.push(edits.isPublic ? "now public" : "now private");
  }
  return fields.join(", ");
}
