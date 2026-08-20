import { formatBlogDate } from "@/lib/blog/format";
import type { BlogPost } from "@/lib/blog/types";
import { blogCategoryPath, blogPath } from "@/lib/blog/types";
import { BlogByline } from "./blog-byline";
import { BlogCta } from "./blog-cta";
import { BlogPostCard } from "./blog-post-card";
import { BlogToc } from "./blog-toc";
import { FadeIn } from "./fade-in";
import { Footer } from "./footer";
import { breadcrumbJsonLd, JsonLd } from "./json-ld";
import { Navbar } from "./navbar";
import { SectionSeparator } from "./section-separator";

const SITE = "https://kaneo.app";

/**
 * Splits the rendered body just before the nth <h2> so a call to action can sit
 * mid-article, where it is read, rather than only after 3,000 words.
 */
function splitBeforeHeading(html: string, occurrence: number) {
  let at = -1;

  for (let found = 0; found < occurrence; found += 1) {
    at = html.indexOf("<h2", at + 1);
    if (at === -1) return [html, ""] as const;
  }

  return [html.slice(0, at), html.slice(at)] as const;
}

export function BlogPostPage({
  post,
  related,
}: {
  post: BlogPost;
  related: BlogPost[];
}) {
  const path = blogPath(post.slug);
  const [opening, remainder] = splitBeforeHeading(post.html, 3);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Kaneo", path: "/" },
          { name: "Blog", path: "/blog" },
          {
            name: post.category.name,
            path: blogCategoryPath(post.category.slug),
          },
          { name: post.title, path },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.updatedOn ?? post.date,
          articleSection: post.category.name,
          image: `${SITE}${post.image}`,
          inLanguage: "en",
          mainEntityOfPage: `${SITE}${path}`,
          wordCount: post.markdown.split(/\s+/).filter(Boolean).length,
          author: {
            "@type": "Person",
            name: post.author.name,
            jobTitle: post.author.role,
            ...(post.author.url ? { url: post.author.url } : {}),
          },
          publisher: {
            "@type": "Organization",
            name: "Kaneo",
            url: SITE,
            logo: `${SITE}/logo-512.png`,
          },
        }}
      />
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="px-6 pt-14 pb-10 md:pt-20 md:pb-12">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto w-full max-w-3xl lg:mx-0">
              <FadeIn delay={0}>
                <div className="flex items-center gap-2 text-sm">
                  <a
                    className="text-foreground/50 transition-colors hover:text-foreground"
                    href="/blog"
                  >
                    Blog
                  </a>
                  <span aria-hidden="true" className="text-foreground/30">
                    /
                  </span>
                  <a
                    className="font-medium text-primary"
                    href={blogCategoryPath(post.category.slug)}
                  >
                    {post.category.name}
                  </a>
                </div>
              </FadeIn>

              <FadeIn delay={60}>
                <h1 className="mt-3 text-balance text-3xl font-medium leading-[1.1] md:text-[2.75rem]">
                  {post.title}
                </h1>
              </FadeIn>

              <FadeIn delay={120}>
                <p className="mt-5 text-balance text-foreground/70 text-lg leading-relaxed">
                  {post.description}
                </p>
              </FadeIn>

              <FadeIn delay={180}>
                <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <BlogByline author={post.author} />
                  <span
                    aria-hidden="true"
                    className="h-4 w-px bg-border max-sm:hidden"
                  />
                  <p className="text-foreground/50 text-sm">
                    <time dateTime={post.date}>
                      {formatBlogDate(post.date)}
                    </time>
                    {" · "}
                    {post.readingTimeMinutes} min read
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto w-full max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
              <article className="mx-auto w-full max-w-3xl lg:mx-0">
                <div
                  className="blog-prose"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: post bodies are trusted markdown files in this repository, rendered to HTML at build time.
                  dangerouslySetInnerHTML={{ __html: opening }}
                />

                {remainder ? (
                  <>
                    <div className="mt-12">
                      <BlogCta />
                    </div>
                    <div
                      className="blog-prose mt-12"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: post bodies are trusted markdown files in this repository, rendered to HTML at build time.
                      dangerouslySetInnerHTML={{ __html: remainder }}
                    />
                  </>
                ) : null}

                <div className="mt-14 lg:hidden">
                  <BlogCta compact />
                </div>

                {post.updatedOn ? (
                  <p className="mt-8 text-foreground/50 text-xs">
                    Last updated {formatBlogDate(post.updatedOn)}.
                  </p>
                ) : null}
              </article>

              <aside className="max-lg:hidden">
                <div className="sticky top-24 space-y-8">
                  <BlogCta compact />
                  <BlogToc entries={post.toc} />
                </div>
              </aside>
            </div>
          </section>
        </SectionSeparator>

        {related.length > 0 ? (
          <SectionSeparator>
            <section className="px-6 py-12 md:py-16">
              <div className="mx-auto w-full max-w-6xl">
                <h2 className="text-2xl font-medium md:text-3xl">
                  Keep reading
                </h2>
                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((item) => (
                    <BlogPostCard key={item.slug} post={item} />
                  ))}
                </div>
              </div>
            </section>
          </SectionSeparator>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
