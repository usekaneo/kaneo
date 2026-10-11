import {
  SOURCE_PROJECT_KEY_MAX,
  sanitizeProjectKey,
  toProjectKey,
  uniqueKey,
} from "@kaneo/importers";
import { HTTPException } from "hono/http-exception";

export const MAX_PROJECT_KEY_ATTEMPTS = 5;

export type CreateWithUniqueKeyOptions = {
  preferredKey?: string;
  attempts?: number;
};

function normalizeKey(key: string) {
  return key.normalize("NFKC").toUpperCase();
}

export async function createWithUniqueKey<T>(
  name: string,
  existingKeys: Iterable<string>,
  create: (key: string) => Promise<T>,
  {
    preferredKey,
    attempts = MAX_PROJECT_KEY_ATTEMPTS,
  }: CreateWithUniqueKeyOptions = {},
): Promise<T> {
  const taken = new Set([...existingKeys].map(normalizeKey));
  const sourceKey = sanitizeProjectKey(preferredKey);
  const candidate = sourceKey ?? toProjectKey(name);
  const maxLength = sourceKey ? SOURCE_PROJECT_KEY_MAX : undefined;

  for (let attempt = 1; ; attempt++) {
    const key = uniqueKey(candidate, taken, maxLength);
    try {
      return await create(key);
    } catch (error) {
      const conflict = error instanceof HTTPException && error.status === 409;
      if (!conflict || attempt >= attempts) throw error;
      taken.add(normalizeKey(key));
    }
  }
}
