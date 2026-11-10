# Embeddable feedback widget

**Status:** documentation-only placeholder. **Milestone:** [M1](https://github.com/PlaybookMediaLLC/kaneo/issues/7).

A small customer-facing widget a founder embeds in their own software to collect feedback without sending customers to a separate site.

## Responsibilities

- A simple installation snippet or SDK with explicit product-scoped configuration.
- Feature requests, bug reports, text, screenshots/attachments and contextual diagnostics **with consent**.
- Accessible, fast, responsive, themeable feedback UI that does not interfere with the host app.
- Secure submission, idempotency, upload size/type controls, abuse/rate limits, origin controls and CSP-friendly behavior.

## Boundaries

This package must not require full Kaneo login to submit public feedback, contain privileged workspace/agent tokens in browser assets, or execute customer-supplied code. Customer context is evidence, not permission to infer sensitive data. Workspaces/products and private screenshots need appropriate authorization rules.

Read [portal](../feedback-portal/README.md) and [feedback domain](../../packages/feedback/README.md). No installable widget is provided by this scaffold.
