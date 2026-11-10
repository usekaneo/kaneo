/**
 * Recipient classes, as types.
 *
 * The rule: **mail that can grant account access must never follow a
 * user-settable address.** In the app, `principal.contactEmail` has two
 * unverified writers — an agent typing an address into the inbox, and a visitor
 * typing one into a pre-chat form — so a password reset that fell back to it
 * would be an account-takeover path: set the contact address, trigger a reset,
 * receive it.
 *
 * The axis is not "security vs product". That breaks on magic links and
 * invitations, which have no account to look up — for an invitee one does not
 * exist yet. The honest axis is where the mail's authority comes from:
 *
 *   account   a capability over an EXISTING account. The address is read from
 *             the account by id, and from nowhere else.
 *   sealed    a capability over whoever holds an address. The address IS the
 *             claim being minted, so there is nothing to look up: mail exactly
 *             what the token was minted for.
 *   contact   carries no capability, so it may follow a contact address.
 *
 * These live in this package, not in the app, because this is where the senders
 * are declared. A sender that demands a `SecureRecipient` cannot be handed a
 * contact address by any caller, in any file, reached through any import style
 * — which is a guarantee the compiler makes rather than one a lint rule and a
 * source scan approximate. The app mints the brands in exactly one module
 * (`lib/server/email/recipient.ts`); nothing else can, because the constructors
 * are the only casts.
 *
 * There is deliberately no "but this contact address was verified" carve-out.
 * No column distinguishes a verified writer from the two unverified ones, so
 * the distinction is not expressible and a carve-out would be a lie.
 */

declare const ACCOUNT: unique symbol;
declare const SEALED: unique symbol;
declare const CONTACT: unique symbol;

/** An address read from the account record by id. */
export type AccountEmail = string & { readonly [ACCOUNT]: true };

/** The exact address a verification token was minted for. */
export type SealedEmail = string & { readonly [SEALED]: true };

/** A reachable address that may have been supplied by someone other than its owner. */
export type ContactEmail = string & { readonly [CONTACT]: true };

/**
 * Anything a capability may be put in front of. Excludes `ContactEmail`, and
 * that exclusion is the entire point of the type.
 */
export type SecureRecipient = AccountEmail | SealedEmail;
