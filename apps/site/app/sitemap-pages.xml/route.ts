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

type Entry = { path: string; changefreq: string; priority: string };

const staticEntries: Entry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/alternatives", changefreq: "weekly", priority: "0.8" },
  { path: "/guides", changefreq: "weekly", priority: "0.8" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

export function GET() {
  const lastmod = new Date().toISOString();

  const entries: Entry[] = [
    ...staticEntries,
    ...comparisonList.map((comparison) => ({
      path: alternativePath(comparison.slug),
      changefreq: "monthly",
      priority: "0.7",
    })),
    ...guideList.map((guide) => ({
      path: guidePath(guide.slug),
      changefreq: "monthly",
      priority: "0.7",
    })),
    ...getUsedCategories().map((category) => ({
      path: blogCategoryPath(category.slug),
      changefreq: "weekly",
      priority: "0.5",
    })),
    ...getPosts().map((post) => ({
      path: blogPath(post.slug),
      changefreq: "monthly",
      priority: "0.7",
    })),
  ];

  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${SITE}${entry.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
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
