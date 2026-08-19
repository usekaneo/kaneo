import type { Metadata } from "next";
import { FadeIn } from "@/components/landing/fade-in";
import { Footer } from "@/components/landing/footer";
import { breadcrumbJsonLd, JsonLd } from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import { SectionSeparator } from "@/components/landing/section-separator";
import { alternativePath, comparisonList } from "@/lib/comparisons";
import { guideList, guidePath } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Practical guides to open-source and self-hosted project management: choosing a tool, self-hosting with Docker, single sign-on, data residency, and AI agents.",
  alternates: { canonical: "/guides" },
};

export default function Page() {
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
          itemListElement: guideList.map((guide, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: guide.question,
            url: `https://kaneo.app${guidePath(guide.slug)}`,
          })),
        }}
      />
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="px-6 pt-14 pb-12 md:pt-20 md:pb-16">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl">
              <FadeIn delay={0}>
                <p className="font-medium text-primary text-sm">Guides</p>
              </FadeIn>
              <FadeIn delay={60}>
                <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.06] md:text-5xl">
                  Straight answers about project tools
                </h1>
              </FadeIn>
              <FadeIn delay={120}>
                <p className="mt-5 text-balance text-foreground/70 text-lg leading-relaxed">
                  Questions people actually ask before choosing a project
                  manager, answered without pretending Kaneo is the answer to
                  all of them.
                </p>
              </FadeIn>
            </div>

            <div className="mt-12 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {guideList.map((guide) => (
                <a
                  key={guide.slug}
                  className="group rounded-xl border border-border/70 bg-card/70 p-5 transition-colors hover:border-border hover:bg-accent/40"
                  href={guidePath(guide.slug)}
                >
                  <h2 className="font-medium text-sm transition-colors group-hover:text-primary">
                    {guide.question}
                  </h2>
                  <p className="mt-2 text-foreground/70 text-sm leading-relaxed">
                    {guide.summary}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto w-full max-w-6xl">
              <h2 className="text-2xl font-medium md:text-3xl">
                Compare Kaneo directly
              </h2>
              <div className="mt-6 flex flex-wrap gap-2">
                {comparisonList.map((comparison) => (
                  <a
                    key={comparison.slug}
                    className="inline-flex h-8 items-center rounded-lg border border-border/70 px-3 text-foreground/70 text-sm transition-colors hover:bg-accent hover:text-foreground"
                    href={alternativePath(comparison.slug)}
                  >
                    vs {comparison.competitor}
                  </a>
                ))}
              </div>
            </div>
          </section>
        </SectionSeparator>
      </main>
      <Footer />
    </>
  );
}
