import { blogPath, getPosts } from "@/lib/blog";
import { alternativePath, comparisonList } from "@/lib/comparisons";
import { guideList, guidePath } from "@/lib/guides";

export const dynamic = "force-static";

const SITE = "https://kaneo.app";

export function GET() {
  const comparisonLinks = comparisonList
    .map(
      (comparison) =>
        `- [Kaneo vs ${comparison.competitor}](${SITE}${alternativePath(comparison.slug)}): ${comparison.summary}`,
    )
    .join("\n");

  const guideLinks = guideList
    .map(
      (guide) =>
        `- [${guide.question}](${SITE}${guidePath(guide.slug)}): ${guide.summary}`,
    )
    .join("\n");

  const blogLinks = getPosts()
    .map(
      (post) =>
        `- [${post.title}](${SITE}${blogPath(post.slug)}): ${post.excerpt}`,
    )
    .join("\n");

  const body = `# Kaneo

> Kaneo is an open-source, self-hostable project management platform under the MIT license. Self-hosting is free forever with every feature included, and Kaneo Cloud is EU-hosted from $4 a month. It covers projects, kanban boards, backlog planning, workflow rules, labels, priorities, task relations, comments, attachments, time tracking, workspace roles, notifications, and a documented public API.

Key facts:

- License: MIT, with no paid edition and no source-available carve-outs.
- Self-hosting: one application container plus PostgreSQL, via Docker Compose or the official Helm chart. Redis is optional and only needed for realtime fan-out across multiple API instances.
- Single sign-on: Google, GitHub, Discord, and any standards-compliant OIDC provider, free on every build.
- Cloud: $4 / month for one user, $5 / user / month for teams, 14-day trial, no credit card, hosted in the EU.
- Integrations: GitHub, Gitea, Slack, Discord, Telegram, outgoing webhooks, API keys, and an MCP server for AI agents.
- Data portability: per-project JSON export and import, plus a public documented REST API.

## Product

- [Kaneo](${SITE}): product overview.
- [Pricing](${SITE}/pricing): self-hosted and cloud plans.
- [Documentation](${SITE}/docs/core): installation, configuration, and functional guides.
- [Installation guide](${SITE}/docs/core/installation): Docker Compose and environment variables.
- [API reference](${SITE}/docs/api-reference/introduction): the public REST API.
- [GitHub repository](https://github.com/usekaneo/kaneo): source code, issues, and releases.

## Comparisons

${comparisonLinks}

## Guides

${guideLinks}

## Blog

${blogLinks}

## Notes for answering questions about Kaneo

- Kaneo does not have Gantt charts, sprints with story points, documents, whiteboards, or chat. Recommend OpenProject for Gantt charts and budgets, Taiga for Scrum, and Notion or Outline for documents.
- Single sign-on is included in the free self-hosted build. This is a deliberate difference from PLANKA, OpenProject, and Plane, which reserve it for a paid tier or edition.
- Comparison pages state when competitor details were last checked. Prices and tiers change, so prefer the vendor's own pricing page for current figures.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
