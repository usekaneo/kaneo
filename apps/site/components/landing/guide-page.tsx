import { FadeIn } from "@/components/landing/fade-in";
import { Footer } from "@/components/landing/footer";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  JsonLd,
} from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import { PageIntro } from "@/components/landing/page-intro";
import { SectionSeparator } from "@/components/landing/section-separator";
import { Button } from "@/components/ui/button";
import type { Guide } from "@/lib/guides";
import { guidePath } from "@/lib/guides";

const SIGN_UP = "https://cloud.kaneo.app/auth/sign-up";

function formatUpdatedOn(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function GuidePage({ data }: { data: Guide }) {
  const path = guidePath(data.slug);

  return (
    <>
      <JsonLd data={faqJsonLd(data.faq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Kaneo", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: data.question, path },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: data.title,
          description: data.description,
          dateModified: data.updatedOn,
          inLanguage: "en",
          mainEntityOfPage: `https://kaneo.app${path}`,
          author: { "@type": "Organization", name: "Kaneo" },
          publisher: { "@type": "Organization", name: "Kaneo" },
        }}
      />
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="px-6 pt-14 pb-12 md:pt-20 md:pb-16 lg:pt-24">
          <div className="mx-auto w-full max-w-3xl">
            <PageIntro eyebrow="Guide" title={data.question} />
            <FadeIn delay={120}>
              <div className="mt-8 border-l-2 border-foreground/20 py-1 pl-6">
                <h2 className="font-medium text-sm">Short answer</h2>
                <p className="mt-2 text-foreground/80 leading-relaxed">
                  {data.answer}
                </p>
              </div>
            </FadeIn>
            <p className="mt-4 text-muted-foreground text-xs">
              Last updated {formatUpdatedOn(data.updatedOn)}. Written by the
              Kaneo team, who also build one of the tools mentioned.
            </p>
          </div>
        </section>

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto w-full max-w-3xl space-y-12">
              {data.sections.map((section) => (
                <div key={section.heading}>
                  <h2 className="text-2xl font-medium md:text-3xl">
                    {section.heading}
                  </h2>
                  {section.body?.map((paragraph) => (
                    <p
                      key={paragraph.slice(0, 40)}
                      className="mt-4 text-muted-foreground leading-relaxed"
                    >
                      {paragraph}
                    </p>
                  ))}
                  {section.items ? (
                    <div className="mt-6 space-y-5">
                      {section.items.map((item) => (
                        <div key={item.name} className="border-t py-5">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <h3 className="font-medium text-sm">
                              {item.href ? (
                                <a
                                  className="underline underline-offset-4 transition-colors hover:text-primary"
                                  href={item.href}
                                >
                                  {item.name}
                                </a>
                              ) : (
                                item.name
                              )}
                            </h3>
                            {item.meta ? (
                              <span className="text-muted-foreground text-xs">
                                {item.meta}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                            {item.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </SectionSeparator>

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto w-full max-w-3xl">
              <h2 className="text-2xl font-medium md:text-3xl">
                Frequently asked
              </h2>
              <div className="mt-8 space-y-6">
                {data.faq.map((entry) => (
                  <div key={entry.question} className="space-y-2">
                    <h3 className="font-medium text-sm">{entry.question}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {entry.answer}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-12">
                <h3 className="font-medium text-sm">Keep reading</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.related.map((link) => (
                    <a
                      key={link.href}
                      className="inline-flex min-h-11 items-center rounded-lg border border-border/70 px-3 py-2 text-muted-foreground text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4 hover:bg-accent hover:text-foreground"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-12 flex flex-wrap items-center gap-3">
                <Button
                  variant="default"
                  size="lg"
                  className="h-12 px-5 text-sm sm:h-12"
                  render={<a href={SIGN_UP} />}
                >
                  Try Kaneo Cloud free
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-5 text-sm sm:h-12"
                  render={<a href="/docs/core/installation" />}
                >
                  Self-host for free
                </Button>
              </div>
            </div>
          </section>
        </SectionSeparator>
      </main>
      <Footer />
    </>
  );
}
