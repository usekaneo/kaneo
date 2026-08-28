/**
 * `external_link.external_id` is free text, so `Number.parseInt` would turn
 * "17invalid" into 17 and aim a write at the wrong issue. Only a clean,
 * positive, safe integer is a usable GitLab issue iid.
 */
export function parseIssueIid(externalId: string): number | null {
  if (!/^\d+$/.test(externalId.trim())) {
    return null;
  }
  const iid = Number(externalId);
  return Number.isSafeInteger(iid) && iid >= 1 ? iid : null;
}
