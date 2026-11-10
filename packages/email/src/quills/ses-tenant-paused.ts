/**
 * Recognising the provider's refusal of a send because the tenant it was sent
 * for is paused.
 *
 * The provider documents that a paused tenant's sends fail, and not which
 * exception says so. The account-wide pause has its own exception name
 * (`SendingPausedException`), and a tenant pause may reuse it or arrive as a
 * generic rejection, so the reading here is deliberately defensive: a failure
 * counts as a tenant pause only when the send named a tenant AND the provider's
 * text mentions the tenant AND either the exception is the pause one or the text
 * says paused, disabled or suspended. A pause exception that never mentions a
 * tenant is the whole account, which is not this workspace's to be told about,
 * and a rejection naming a tenant for any other reason (a missing association)
 * is not a pause.
 */

const PAUSE_WORDS = /\b(?:paus\w*|disabl\w*|suspend\w*)\b/i;

export function isTenantPausedFailure(input: {
  tenantName: string | undefined;
  code: string | null;
  message: string | null | undefined;
}): boolean {
  if (!input.tenantName) return false;
  const text = input.message ?? "";
  if (!/tenant/i.test(text)) return false;
  return input.code === "SendingPausedException" || PAUSE_WORDS.test(text);
}
