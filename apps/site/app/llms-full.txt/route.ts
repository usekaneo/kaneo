import { blogPath, getPosts } from "@/lib/blog";
import { alternativePath, comparisonList } from "@/lib/comparisons";
import type { Cell } from "@/lib/comparisons/types";
import { guideList, guidePath } from "@/lib/guides";

export const dynamic = "force-static";

const SITE = "https://kaneo.app";

function cell(value: Cell) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return value;
}

function comparisonMarkdown() {
  return comparisonList
    .map((data) => {
      const rows = data.rows
        .map(
          (row) =>
            `| ${row.feature} | ${cell(row.kaneo)} | ${cell(row.them)} |`,
        )
        .join("\n");

      const reasons = data.reasons
        .map((reason) => `- **${reason.title}**: ${reason.body}`)
        .join("\n");

      const faq = data.faq
        .map((entry) => `**${entry.question}**\n\n${entry.answer}`)
        .join("\n\n");

      return `## Kaneo vs ${data.competitor}

URL: ${SITE}${alternativePath(data.slug)}
Competitor details checked: ${data.verifiedOn}

${data.verdict}

| | Kaneo | ${data.competitor} |
| --- | --- | --- |
${rows}

${reasons}

When ${data.competitor} is the better choice: ${data.honestNote}

${faq}`;
    })
    .join("\n\n---\n\n");
}

function guideMarkdown() {
  return guideList
    .map((guide) => {
      const sections = guide.sections
        .map((section) => {
          const body = section.body?.join("\n\n") ?? "";
          const items =
            section.items
              ?.map(
                (item) =>
                  `- **${item.name}**${item.meta ? ` (${item.meta})` : ""}: ${item.body}`,
              )
              .join("\n") ?? "";
          return `### ${section.heading}\n\n${[body, items].filter(Boolean).join("\n\n")}`;
        })
        .join("\n\n");

      const faq = guide.faq
        .map((entry) => `**${entry.question}**\n\n${entry.answer}`)
        .join("\n\n");

      return `## ${guide.question}

URL: ${SITE}${guidePath(guide.slug)}
Last updated: ${guide.updatedOn}

${guide.answer}

${sections}

${faq}`;
    })
    .join("\n\n---\n\n");
}

function blogMarkdown() {
  return getPosts()
    .map(
      (post) => `## ${post.title}

URL: ${SITE}${blogPath(post.slug)}
Published: ${post.date}${post.updatedOn ? `\nLast updated: ${post.updatedOn}` : ""}
Author: ${post.author.name}, ${post.author.role}
Category: ${post.category.name}

${post.markdown}`,
    )
    .join("\n\n---\n\n");
}

export function GET() {
  const body = `# Kaneo, full content

> Kaneo is an open-source, self-hostable project management platform under the MIT license. This file contains the full text of Kaneo's comparison pages, guides, and blog posts. Written by the Kaneo team, who build one of the tools discussed.

# Comparisons

${comparisonMarkdown()}

# Guides

${guideMarkdown()}

# Blog

${blogMarkdown()}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
