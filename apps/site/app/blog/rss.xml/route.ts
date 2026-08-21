import { blogPath, getPosts } from "@/lib/blog";

export const dynamic = "force-static";

const SITE = "https://kaneo.app";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(date: string) {
  return new Date(`${date}T09:00:00Z`).toUTCString();
}

export function GET() {
  const posts = getPosts();
  const lastBuildDate = posts[0]
    ? rfc822(posts[0].date)
    : new Date(0).toUTCString();

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE}${blogPath(post.slug)}</link>
      <guid isPermaLink="true">${SITE}${blogPath(post.slug)}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <category>${escapeXml(post.category.name)}</category>
      <dc:creator>${escapeXml(post.author.name)}</dc:creator>
      <pubDate>${rfc822(post.date)}</pubDate>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Kaneo blog</title>
    <link>${SITE}/blog</link>
    <description>Writing from the Kaneo team on open source project management, self-hosting, and engineering.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
