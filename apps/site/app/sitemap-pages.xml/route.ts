import {
  blogCategoryPath,
  blogPath,
  getPosts,
  getUsedCategories,
} from "@/lib/blog";
import { alternativePath, comparisonList } from "@/lib/comparisons";
import { guideList, guidePath } from "@/lib/guides";

export const dynamic = "force-static";

const SITE = "https://kaneo.app";

type Entry = { path: string; lastmod?: string };

const staticEntries: Entry[] = [
  { path: "/" },
  { path: "/pricing" },
  { path: "/press" },
  { path: "/alternatives" },
  { path: "/guides" },
  { path: "/blog" },
  { path: "/privacy" },
  { path: "/terms" },
];

export function GET() {
  // Only dated editorial content has a reliable lastmod. Build times and
  // competitor verification dates do not track every change to a page.
  const entries: Entry[] = [
    ...staticEntries,
    ...comparisonList.map((comparison) => ({
      path: alternativePath(comparison.slug),
    })),
    ...guideList.map((guide) => ({
      path: guidePath(guide.slug),
      lastmod: guide.updatedOn,
    })),
    ...getUsedCategories().map((category) => ({
      path: blogCategoryPath(category.slug),
    })),
    ...getPosts().map((post) => ({
      path: blogPath(post.slug),
      lastmod: post.updatedOn ?? post.date,
    })),
  ];

  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${SITE}${entry.path}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ""}
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
