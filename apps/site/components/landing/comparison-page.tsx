import { Check, Minus } from "lucide-react";
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
import { alternativePath, comparisons } from "@/lib/comparisons";
import type { Cell, Comparison } from "@/lib/comparisons/types";
import { landing } from "@/lib/landing";

const SIGN_UP = "https://cloud.kaneo.app/auth/sign-up";

export type { Comparison };

function CellValue({ value, emphasize }: { value: Cell; emphasize?: boolean }) {
  if (typeof value === "boolean") {
    return (
      <span className="inline-flex items-center justify-center">
        {value ? (
          <Check
            aria-hidden="true"
            className={
              emphasize ? "size-4 text-primary" : "size-4 text-foreground/40"
            }
          />
        ) : (
          <Minus aria-hidden="true" className="size-4 text-foreground/30" />
        )}
        <span className="sr-only">
          {value ? landing.comparison.yes : landing.comparison.no}
        </span>
      </span>
    );
  }
  return (
    <span className={emphasize ? "text-foreground" : "text-muted-foreground"}>
      {value}
    </span>
  );
}

function formatVerifiedOn(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ComparisonPage({ data }: { data: Comparison }) {
  const path = alternativePath(data.slug);
  const related = data.related
    .map((slug) => comparisons[slug])
    .filter((entry): entry is Comparison => Boolean(entry));

  const facts = [
    { label: "License", value: data.facts.license },
    { label: "Hosting", value: data.facts.hosting },
    { label: "Single sign-on", value: data.facts.sso },
    { label: "Pricing", value: data.facts.pricing },
  ];

  return (
    <>
      <JsonLd data={faqJsonLd(data.faq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Kaneo", path: "/" },
          { name: "Alternatives", path: "/alternatives" },
          { name: `Kaneo vs ${data.competitor}`, path },
        ])}
      />
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="relative overflow-hidden px-6 pt-14 pb-16 md:pt-20 md:pb-20 lg:pt-24">
          <div className="mx-auto w-full max-w-6xl">
            <PageIntro
              eyebrow={<>Kaneo vs {data.competitor}</>}
              title={data.heading}
              description={data.subheading}
            >
              <FadeIn delay={180}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button
                    variant="default"
                    size="lg"
                    className="h-12 px-5 text-sm sm:h-12"
                    render={<a href={SIGN_UP} />}
                  >
                    Start 14-day free trial
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
              </FadeIn>
            </PageIntro>

            <FadeIn delay={200}>
              <div className="mt-12 max-w-3xl border-l-2 border-foreground/20 py-1 pl-6">
                <h2 className="font-medium text-sm">
                  Short answer: is Kaneo a good {data.competitor} alternative?
                </h2>
                <p className="mt-2 text-foreground/80 text-sm leading-relaxed md:text-base">
                  {data.verdict}
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={220}>
              <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {facts.map((fact) => (
                  <div key={fact.label} className="space-y-1">
                    <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      {fact.label}
                    </dt>
                    <dd className="text-foreground/80 text-sm leading-relaxed">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </FadeIn>

            <FadeIn delay={260}>
              <div className="mt-12 overflow-x-auto rounded-xl border bg-background">
                <table className="w-full min-w-[36rem] table-fixed text-sm">
                  <caption className="sr-only">{data.heading}</caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="w-[42%] border-border/50 border-b px-4 py-3 text-left font-medium sm:px-6"
                      >
                        {landing.comparison.feature}
                      </th>
                      <th
                        scope="col"
                        className="border-border/50 border-b bg-sidebar px-4 py-3 text-center font-medium sm:px-6"
                      >
                        Kaneo
                      </th>
                      <th
                        scope="col"
                        className="border-border/50 border-b px-4 py-3 text-center font-medium text-muted-foreground sm:px-6"
                      >
                        {data.competitor}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.feature}>
                        <th
                          scope="row"
                          className="border-border/40 border-b px-4 py-3 text-left font-normal text-foreground/80 sm:px-6"
                        >
                          {row.feature}
                        </th>
                        <td className="border-border/40 border-b bg-sidebar px-4 py-3 text-center sm:px-6">
                          <CellValue value={row.kaneo} emphasize />
                        </td>
                        <td className="border-border/40 border-b px-4 py-3 text-center sm:px-6">
                          <CellValue value={row.them} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeIn>

            <p className="mt-4 text-muted-foreground text-xs">
              {data.competitor} details checked on{" "}
              {formatVerifiedOn(data.verifiedOn)}.{" "}
              {data.sources.map((source, index) => (
                <span key={source.href}>
                  {index > 0 ? ", " : ""}
                  <a
                    className="underline underline-offset-4 transition-colors hover:text-foreground"
                    href={source.href}
                  >
                    {source.label}
                  </a>
                </span>
              ))}
              .
            </p>
          </div>
        </section>

        <SectionSeparator>
          <section className="px-6 py-14 md:py-20">
            <div className="mx-auto w-full max-w-6xl">
              <h2 className="max-w-2xl text-2xl font-medium md:text-3xl">
                Why teams choose Kaneo
              </h2>
              <div className="mt-8 grid gap-8 md:grid-cols-3">
                {data.reasons.map((reason) => (
                  <div key={reason.title} className="space-y-2">
                    <h3 className="font-medium text-sm">{reason.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {reason.body}
                    </p>
                  </div>
                ))}
              </div>

              {data.migration ? (
                <p className="mt-14 max-w-2xl text-muted-foreground text-sm leading-relaxed">
                  {data.migration.body}{" "}
                  <a
                    className="text-foreground underline underline-offset-4 transition-colors hover:text-primary"
                    href={data.migration.href}
                  >
                    {data.migration.linkText}
                  </a>
                  .
                </p>
              ) : null}

              <div className="mt-14 max-w-2xl border-l-2 border-foreground/20 py-1 pl-6">
                <h3 className="font-medium text-sm">
                  When {data.competitor} is the better choice
                </h3>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                  {data.honestNote}
                </p>
              </div>
            </div>
          </section>
        </SectionSeparator>

        <SectionSeparator>
          <section className="px-6 py-14 md:py-20">
            <div className="mx-auto w-full max-w-6xl">
              <h2 className="max-w-2xl text-2xl font-medium md:text-3xl">
                Kaneo vs {data.competitor}, answered
              </h2>
              <div className="mt-8 grid gap-8 md:grid-cols-2">
                {data.faq.map((entry) => (
                  <div key={entry.question} className="space-y-2">
                    <h3 className="font-medium text-sm">{entry.question}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {entry.answer}
                    </p>
                  </div>
                ))}
              </div>

              {related.length > 0 ? (
                <div className="mt-14">
                  <h3 className="font-medium text-sm">Other comparisons</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {related.map((entry) => (
                      <a
                        key={entry.slug}
                        className="inline-flex min-h-11 items-center rounded-lg border border-border/70 px-3 py-2 text-muted-foreground text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4 hover:bg-accent hover:text-foreground"
                        href={alternativePath(entry.slug)}
                      >
                        Kaneo vs {entry.competitor}
                      </a>
                    ))}
                    <a
                      className="inline-flex min-h-11 items-center rounded-lg border border-border/70 px-3 py-2 text-muted-foreground text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4 hover:bg-accent hover:text-foreground"
                      href="/alternatives"
                    >
                      All alternatives
                    </a>
                  </div>
                </div>
              ) : null}

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
                  render={<a href="/pricing" />}
                >
                  See pricing
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
