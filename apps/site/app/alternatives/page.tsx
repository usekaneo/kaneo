import type { Metadata } from "next";
import { FadeIn } from "@/components/landing/fade-in";
import { Footer } from "@/components/landing/footer";
import { breadcrumbJsonLd, JsonLd } from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import { SectionSeparator } from "@/components/landing/section-separator";
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
    body: "None of these can be run on your own infrastructure. The comparison is mostly about pricing, data ownership, and how much tool you have to administer.",
  },
  {
    id: "open-source",
    title: "Open-source and self-hosted tools",
    body: "These are peers. The differences are licence, how much you have to run, and which features sit behind a paid edition.",
  },
] as const;

export default function Page() {
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
                <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.06] md:text-5xl">
                  How Kaneo compares
                </h1>
              </FadeIn>
              <FadeIn delay={120}>
                <p className="mt-5 text-balance text-foreground/70 text-lg leading-relaxed">
                  Kaneo is an MIT-licensed project manager you can self-host for
                  free or run as a managed cloud from $4 a month. Here is how it
                  sits next to the tools people usually weigh it against, and
                  where each of them is the better answer.
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
                  <h2 className="text-2xl font-medium md:text-3xl">
                    {group.title}
                  </h2>
                  <p className="mt-3 text-foreground/70 text-sm leading-relaxed">
                    {group.body}
                  </p>
                </div>
                <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                  {comparisonList
                    .filter((comparison) => comparison.category === group.id)
                    .map((comparison) => (
                      <a
                        key={comparison.slug}
                        className="group rounded-xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-border hover:bg-accent/40"
                        href={alternativePath(comparison.slug)}
                      >
                        <h3 className="font-medium text-sm transition-colors group-hover:text-primary">
                          Kaneo vs {comparison.competitor}
                        </h3>
                        <p className="mt-2 text-foreground/70 text-sm leading-relaxed">
                          {comparison.summary}
                        </p>
                      </a>
                    ))}
                </div>
              </div>
            </section>
          </SectionSeparator>
        ))}

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto w-full max-w-6xl">
              <h2 className="text-2xl font-medium md:text-3xl">
                Guides worth reading first
              </h2>
              <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {guideList.slice(0, 6).map((guide) => (
                  <a
                    key={guide.slug}
                    className="group rounded-xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-border hover:bg-accent/40"
                    href={guidePath(guide.slug)}
                  >
                    <h3 className="font-medium text-sm transition-colors group-hover:text-primary">
                      {guide.question}
                    </h3>
                    <p className="mt-2 text-foreground/70 text-sm leading-relaxed">
                      {guide.summary}
                    </p>
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
