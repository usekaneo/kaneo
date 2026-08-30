import type { Metadata } from "next";
import { BlogPostCard } from "@/components/landing/blog-post-card";
import { ContentCard } from "@/components/landing/content-card";
import { FadeIn } from "@/components/landing/fade-in";
import { Footer } from "@/components/landing/footer";
import { breadcrumbJsonLd, JsonLd } from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import { SectionSeparator } from "@/components/landing/section-separator";
import { getPosts } from "@/lib/blog";
import { formatBlogDateShort } from "@/lib/blog/format";
import { alternativePath, comparisonList } from "@/lib/comparisons";
import { guideList, guidePath } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Kaneo alternatives and comparisons",
  description:
    "How Kaneo compares to Jira, Trello, Linear, Asana, ClickUp, monday.com, PLANKA, Plane, OpenProject, Redmine, and other project management tools. Open source, self-hostable, MIT licensed.",
  alternates: { canonical: "/alternatives" },
};

const groups = [
  {
    id: "saas",
    title: "Hosted, closed-source tools",
    label: "Proprietary",
    body: "None of these can be run on your own infrastructure. The comparison is mostly about pricing, data ownership, and how much tool you have to administer.",
  },
  {
    id: "open-source",
    title: "Open-source and self-hosted tools",
    label: "Open source",
    body: "These are peers. The differences are licence, how much you have to run, and which features sit behind a paid edition.",
  },
] as const;

export default function Page() {
  const posts = getPosts().slice(0, 3);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Kaneo", path: "/" },
          { name: "Alternatives", path: "/alternatives" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Kaneo comparisons",
          itemListElement: comparisonList.map((comparison, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `Kaneo vs ${comparison.competitor}`,
            url: `https://kaneo.app${alternativePath(comparison.slug)}`,
          })),
        }}
      />
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="px-6 pt-14 pb-12 md:pt-20 md:pb-16">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl">
              <FadeIn delay={0}>
                <p className="font-medium text-primary text-sm">Comparisons</p>
              </FadeIn>
              <FadeIn delay={60}>
                <h1 className="mt-3 text-balance font-medium text-4xl leading-[1.06] md:text-5xl">
                  How Kaneo compares
                </h1>
              </FadeIn>
              <FadeIn delay={120}>
                <p className="mt-5 text-balance text-foreground/70 text-lg leading-relaxed">
                  Kaneo Cloud is managed, EU-hosted project management from $4 a
                  month, and it is open source if you would rather run it
                  yourself. Here is how it sits next to the tools people usually
                  weigh it against, and where each of them is the better answer.
                </p>
              </FadeIn>
            </div>
          </div>
        </section>

        {groups.map((group) => (
          <SectionSeparator key={group.id}>
            <section className="px-6 py-12 md:py-16">
              <div className="mx-auto w-full max-w-6xl">
                <div className="max-w-2xl">
                  <h2 className="font-medium text-2xl md:text-3xl">
                    {group.title}
                  </h2>
                  <p className="mt-3 text-foreground/70 leading-relaxed">
                    {group.body}
                  </p>
                </div>
                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {comparisonList
                    .filter((comparison) => comparison.category === group.id)
                    .map((comparison) => (
                      <ContentCard
                        body={comparison.summary}
                        href={alternativePath(comparison.slug)}
                        key={comparison.slug}
                        meta={[
                          group.label,
                          <time dateTime={comparison.verifiedOn} key="checked">
                            Checked {formatBlogDateShort(comparison.verifiedOn)}
                          </time>,
                        ]}
                        title={`Kaneo vs ${comparison.competitor}`}
                      />
                    ))}
                </div>
              </div>
            </section>
          </SectionSeparator>
        ))}

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto w-full max-w-6xl">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h2 className="font-medium text-2xl md:text-3xl">
                  Guides worth reading first
                </h2>
                <a
                  className="text-foreground/60 text-sm transition-colors hover:text-foreground"
                  href="/guides"
                >
                  All guides
                </a>
              </div>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {guideList.slice(0, 3).map((guide) => (
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
            </div>
          </section>
        </SectionSeparator>

        {posts.length > 0 ? (
          <SectionSeparator>
            <section className="px-6 py-12 md:py-16">
              <div className="mx-auto w-full max-w-6xl">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="font-medium text-2xl md:text-3xl">
                    Round-ups from the blog
                  </h2>
                  <a
                    className="text-foreground/60 text-sm transition-colors hover:text-foreground"
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
