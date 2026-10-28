import type { ImportedPerson } from "@kaneo/importers";

export type AssignableMember = { id: string; name: string; email: string };

export type AssigneeMatcher = {
  match(person: ImportedPerson | undefined): string | null;
  warning(): string | null;
};

const LISTED_NAMES = 5;

function normalize(value: string | null | undefined) {
  return value?.normalize("NFKC").trim().toLowerCase() ?? "";
}

function displayName(person: ImportedPerson) {
  return person.name?.trim() || person.email?.trim() || "someone";
}

function listNames(names: string[]) {
  const listed = names.slice(0, LISTED_NAMES).join(", ");
  const rest = names.length - LISTED_NAMES;
  return rest > 0 ? `${listed}, and ${rest} more` : listed;
}

export function unmatchedAssigneeWarning(
  taskCount: number,
  names: string[],
): string | null {
  if (taskCount === 0) return null;
  const tasks = taskCount === 1 ? "1 task was" : `${taskCount} tasks were`;
  const people =
    names.length === 1
      ? "someone who is not a member"
      : "people who are not members";
  const assign = taskCount === 1 ? "the task" : "the tasks";
  return `${tasks} assigned to ${people} of this workspace (${listNames(names)}). Invite them, then assign ${assign}.`;
}

export function createAssigneeMatcher(
  members: readonly AssignableMember[],
): AssigneeMatcher {
  const byEmail = new Map<string, string>();
  const byName = new Map<string, string | null>();
  for (const member of members) {
    const email = normalize(member.email);
    if (email) byEmail.set(email, member.id);
    const name = normalize(member.name);
    if (name) byName.set(name, byName.has(name) ? null : member.id);
  }

  let unmatchedTasks = 0;
  const unmatchedNames = new Map<string, string>();

  function find(person: ImportedPerson) {
    const email = normalize(person.email);
    if (email) return byEmail.get(email) ?? null;
    const name = normalize(person.name);
    return name ? (byName.get(name) ?? null) : null;
  }

  return {
    match(person) {
      if (!person || (!normalize(person.email) && !normalize(person.name))) {
        return null;
      }
      const userId = find(person);
      if (!userId) {
        unmatchedTasks++;
        const name = displayName(person);
        unmatchedNames.set(name.toLowerCase(), name);
      }
      return userId;
    },
    warning: () =>
      unmatchedAssigneeWarning(unmatchedTasks, [...unmatchedNames.values()]),
  };
}
