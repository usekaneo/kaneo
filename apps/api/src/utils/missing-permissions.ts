export function missingPermissions(
  statements: Record<string, readonly string[]> | null,
  required: Record<string, readonly string[]>,
): string[] {
  const missing: string[] = [];
  for (const [resource, actions] of Object.entries(required)) {
    const granted = statements?.[resource];
    for (const action of actions) {
      if (!granted?.includes(action)) missing.push(`${resource}:${action}`);
    }
  }
  return missing;
}
