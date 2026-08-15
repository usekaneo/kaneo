# Security Policy

## Reporting a vulnerability

Please report security issues privately. Do not open a public issue, and do not include details in a pull request.

Use [GitHub's private vulnerability reporting](https://github.com/usekaneo/kaneo/security/advisories/new), which notifies the maintainers directly and keeps the discussion private until a fix ships. If you cannot use it, email [andrej@kaneo.app](mailto:andrej@kaneo.app) instead.

Helpful things to include, as far as you have them:

- the affected version or commit
- the endpoint, file, or flow involved
- what an attacker gains, and the minimum privilege they need to do it
- a proof of concept, if you have one

## What to expect

- An acknowledgement within 3 days.
- An assessment of severity and scope, and whether we can reproduce it, within 7 days.
- A fix released as soon as it is ready. Anything exploitable against a running instance is prioritised over other work.
- Credit in the advisory, unless you would rather stay anonymous.

We publish a [GitHub Security Advisory](https://github.com/usekaneo/kaneo/security/advisories) for issues that affect self-hosted instances, so operators can see whether they are affected and what to do about it, including any credentials worth rotating.

Please give us a chance to ship a fix before disclosing publicly. If you have a deadline in mind, say so in your report and we will work to it.

## Supported versions

Fixes land on the latest release. Self-hosted instances should track the most recent version; older versions do not receive backported patches.

| Version | Supported |
| ------- | --------- |
| Latest release | Yes |
| Older releases | No |

## Scope

In scope: the API (`apps/api`), the web app (`apps/web`), the MCP server (`packages/mcp`), the Helm chart, and the published Docker images.

Out of scope: findings that require an already-compromised host or database, denial of service through sheer request volume, missing hardening headers with no demonstrated impact, and vulnerabilities in third-party dependencies without a working path through Kaneo. For dependency advisories, a pull request bumping the dependency is welcome and can be public.

Self-hosted deployments are configured by their operator. Reports that depend on an insecure configuration are useful when Kaneo's own defaults or documentation lead operators there; please say which default you followed.
