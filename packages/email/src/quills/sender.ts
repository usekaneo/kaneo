/**
 * Sender identity, as a type.
 *
 * The rule: **a From address must be one the sending workspace has been shown
 * to be entitled to use.** Every workspace on a fleet sends through one mail
 * provider account, and the provider signs for any identity verified on that
 * account without any notion of which workspace an identity belongs to. So the
 * provider will sign a message from workspace B claiming to be
 * `support@workspace-a.example`, and no credential scoping and no provider-side
 * configuration can change that. The only thing that can is the app deciding,
 * before each send, that this workspace may use this address.
 *
 * This type is that decision, made checkable. A sender declares `from` as a
 * `SendingIdentity`, so handing one an arbitrary string is a compile error at
 * the call site rather than something a convention has to catch. It lives in
 * this package, next to the senders that demand it, for the same reason
 * `SecureRecipient` does: a guarantee the compiler makes reaches every file and
 * every import style, and a lint rule or a source scan only approximates one.
 *
 * The app mints it in exactly one module
 * (`lib/server/domains/channel-accounts/outbound-identity.ts`), which is the
 * only place in application code the cast appears. Nothing else can mint one,
 * so "this address went through the guard" is a property of the value rather
 * than a claim about the code path that produced it.
 *
 * Omitting `from` entirely is always allowed and always safe: it means the
 * platform's own configured sender, which every install is entitled to use.
 */

declare const SENDING_IDENTITY: unique symbol;

/** An address the sending workspace has been shown to be entitled to send as. */
export type SendingIdentity = string & { readonly [SENDING_IDENTITY]: true };
