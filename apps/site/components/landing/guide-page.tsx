import { FadeIn } from "@/components/landing/fade-in";
import { Footer } from "@/components/landing/footer";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  JsonLd,
} from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import { SectionSeparator } from "@/components/landing/section-separator";
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
        <section className="px-6 pt-14 pb-12 md:pt-20 md:pb-16">
          <div className="mx-auto w-full max-w-3xl">
            <FadeIn delay={0}>
              <p className="font-medium text-primary text-sm">Guide</p>
            </FadeIn>
            <FadeIn delay={60}>
              <h1 className="mt-3 text-balance text-3xl font-medium leading-[1.1] md:text-4xl">
                {data.question}
              </h1>
            </FadeIn>
            <FadeIn delay={120}>
              <div className="mt-6 rounded-2xl border border-border/70 bg-card/70 p-5 md:p-6">
                <h2 className="font-medium text-sm">Short answer</h2>
                <p className="mt-2 text-foreground/80 leading-relaxed">
                  {data.answer}
                </p>
              </div>
            </FadeIn>
            <p className="mt-4 text-foreground/50 text-xs">
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
                      className="mt-4 text-foreground/70 leading-relaxed"
                    >
                      {paragraph}
                    </p>
                  ))}
                  {section.items ? (
                    <div className="mt-6 space-y-5">
                      {section.items.map((item) => (
                        <div
                          key={item.name}
                          className="rounded-xl border border-border/70 bg-card/70 p-5"
                        >
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
                              <span className="text-foreground/50 text-xs">
                                {item.meta}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-foreground/70 text-sm leading-relaxed">
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
                    <p className="text-foreground/70 text-sm leading-relaxed">
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
                      className="inline-flex h-8 items-center rounded-lg border border-border/70 px-3 text-foreground/70 text-sm transition-colors hover:bg-accent hover:text-foreground"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-12 flex flex-wrap items-center gap-3">
                <a
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-transparent bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                  href={SIGN_UP}
                >
                  Try Kaneo Cloud free
                </a>
                <a
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-transparent px-4 font-medium text-sm transition-colors hover:bg-accent"
                  href="/docs/core/installation"
                >
                  Self-host for free
                </a>
              </div>
            </div>
          </section>
        </SectionSeparator>
      </main>
      <Footer />
    </>
  );
}
