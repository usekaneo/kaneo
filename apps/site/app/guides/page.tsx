import type { Metadata } from "next";
import { BlogPostCard } from "@/components/landing/blog-post-card";
import { ContentCard } from "@/components/landing/content-card";
import { Footer } from "@/components/landing/footer";
import { breadcrumbJsonLd, JsonLd } from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import { PageIntro } from "@/components/landing/page-intro";
import { SectionSeparator } from "@/components/landing/section-separator";
import { getPosts } from "@/lib/blog";
import { formatBlogDateShort } from "@/lib/blog/format";
import { guidePath } from "@/lib/guides";
import { guideGroups } from "@/lib/guides/groups";
import { withSocialMetadata } from "@/lib/metadata";

export const metadata: Metadata = withSocialMetadata({
  title: "Guides",
  description:
    "Practical guides to project management: choosing a tool, planning and scheduling a project, agile and kanban basics, and self-hosting your own tracker.",
  alternates: { canonical: "/guides" },
});

export default function Page() {
  const posts = getPosts().slice(0, 3);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Kaneo", path: "/" },
          { name: "Guides", path: "/guides" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Kaneo guides",
          itemListElement: guideGroups
            .flatMap((group) => group.guides)
            .map((guide, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: guide.question,
              url: `https://kaneo.app${guidePath(guide.slug)}`,
            })),
        }}
      />
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="px-6 pt-14 pb-16 md:pt-20 md:pb-20 lg:pt-24">
          <div className="mx-auto w-full max-w-6xl">
            <PageIntro
              eyebrow="Guides"
              title={<>Straight answers about project tools</>}
              description="The questions people actually ask before choosing a project manager, answered without pretending Kaneo is the answer to all of them."
            />

            <div className="mt-12 space-y-14">
              {guideGroups.map((group) => (
                <section aria-labelledby={group.id} key={group.id}>
                  <h2
                    className="scroll-mt-24 font-medium text-2xl md:text-3xl"
                    id={group.id}
                  >
                    {group.title}
                  </h2>
                  <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {group.guides.map((guide) => (
                      <ContentCard
                        body={guide.summary}
                        href={guidePath(guide.slug)}
                        key={guide.slug}
                        meta={[
                          "Guide",
                          <time dateTime={guide.updatedOn} key="updated">
                            Updated {formatBlogDateShort(guide.updatedOn)}
                          </time>,
                        ]}
                        title={guide.question}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        {posts.length > 0 ? (
          <SectionSeparator>
            <section className="px-6 py-12 md:py-16">
              <div className="mx-auto w-full max-w-6xl">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="font-medium text-2xl md:text-3xl">
                    Latest from the blog
                  </h2>
                  <a
                    className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                    href="/blog"
                  >
                    All posts
                  </a>
                </div>
                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {posts.map((post) => (
                    <BlogPostCard key={post.slug} post={post} />
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
