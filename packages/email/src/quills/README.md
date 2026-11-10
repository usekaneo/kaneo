# Quackback email import

This directory is Playbook-owned. Kaneo's original `@kaneo/email` entry point,
SMTP implementation, and callers remain separate. No application flow uses these
senders until it explicitly imports them.

## Usage and contracts

Import senders from `@kaneo/email/quills`, templates from
`@kaneo/email/quills/templates`, and helpers from the corresponding subpaths:
`anon`, `message-id`, `idempotency`, `provider`, `recipient`, `sender`, `ses`,
`ses-identity`, and `ses-tenant`.

The imported `EmailResult` is separate from Kaneo's result type. Preserve the
recipient/sender capability types and validate identities at the application
boundary; do not cast untrusted addresses into those types. Templates accepting
`bodyHtml` require trusted, sanitized HTML from their caller. Provider selection,
configuration errors, idempotency, anonymous-recipient refusal, and SES tenant
hooks retain the source behavior. Configuration uses the source `EMAIL_*`
variables (including its documented Resend fallback); these are only relevant
when the new senders are explicitly used.

Shared send fields and attachments are validated with Zod before provider
selection. `emailInputSchema`, `rawEmailInputSchema`, `emailAttachmentSchema`, and
`EmailInput` are available from the new entry point. `RawEmailOptions` and
`EmailAttachment` derive their shapes from schemas. Shape validation never grants
sender authority or promotes a contact address to a secure recipient. Invalid
inputs throw `ZodError`; header line breaks/NUL and attachments above the existing
10 MiB aggregate limit are rejected. Mailboxes in `from` and `replyTo` retain
display-name support; `to` must be an email address.

## Local adaptations

- Product links, the default logo URL, and the anonymous address domain use
  `quills.io`; fixtures and domain-guard tests match.

- Logger imports and mocks use `@kaneo/logger`. That workspace dependency must be
  delivered with this package. Its ESM build and declarations are required for
  Node consumers; email's build runs the logger build first.
- Imported TSX files use explicit React imports, matching Kaneo and the preview compiler.
- Tests use `vite-plus/test`; test discovery includes TSX. Fixtures and tests are
  excluded from emitted production output.
- `templates/index.ts` supplies the template barrel missing from the source
  package despite its declared templates export.
- Three indexed accesses were adapted for Kaneo's `noUncheckedIndexedAccess`.
  The SES import-guard test accepts either quote style.
  Formatting and small lint fixes follow Kaneo conventions. Local lint comments
  preserve static-email line keys and the existing rich-HTML contract.
- Mailpit tests require `QUACKBACK_EMAIL_MAILPIT_TESTS=1`; they otherwise make no
  connection to Mailpit. Only enable against a disposable mailbox: they delete
  all messages. They accept `MAILPIT_API_URL`, `MAILPIT_SMTP_HOST`, and
  `MAILPIT_SMTP_PORT`. An unavailable Mailpit service is reported as skipped.

## Checks

From the repository root, use the Node version required by the root manifest:

```sh
pnpm --filter @kaneo/email build
pnpm --filter @kaneo/email lint
pnpm --filter @kaneo/email test
pnpm --filter @kaneo/logger typecheck
pnpm --filter @kaneo/logger test
```

The email test task builds first, runs both email suites, then checks every built
public export in Node and typechecks consumer imports. Its smoke test also checks
that loading the original entry point does not load Quackback modules.

## Updating either upstream

Follow `docs/upstream-policy.md`: integrate `usekaneo/kaneo` through a reviewed
sync branch targeting `develop`. Keep this directory intact and reconcile shared
package manifests/build configuration explicitly; regenerate the lockfile using
pnpm. Do not use blanket ours/union merge drivers or ignore tracked files.

Update Quackback separately by comparing the recorded commit with a chosen source
revision. Copy only email changes, retain the adaptations above, update the
recorded commit, and run the checks. Keep import updates separate from Kaneo syncs.

Most source changes stay in this directory. Shared manifests, build/test config,
and the lockfile can still conflict. A clean Git merge is not proof of runtime
compatibility; run the package checks on the combined tree before accepting it.

## Browser previews

Run `pnpm run dev` from `packages/email` and open http://localhost:3002.
The catalog contains all nine Kaneo emails and all 25 Quills emails, with typed
fictional sample data. Preview links are examples, not live authentication tokens.
The shared static assets come from `apps/web/public/email`. Production deployments
must configure `KANEO_EMAIL_ASSETS_URL` or `KANEO_CLIENT_URL` for absolute image URLs.

Quills uses Kaneo's `EmailShell`, `EmailIntro`, `Frame`, `DetailRows`,
`InvitationCard`, `OtpCode`, `EmailButton`, `EmailNote`, and `EmailFooter`, with the
same color tokens and dark-mode CSS. The shared shell adds optional brand, logo and text-direction
overrides; existing Kaneo callers keep their defaults. Explicit React imports
match Kaneo's JSX configuration and React Email's preview compiler.
