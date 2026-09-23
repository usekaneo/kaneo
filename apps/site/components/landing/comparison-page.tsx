import { Check, Minus } from "lucide-react";
import { FadeIn } from "@/components/landing/fade-in";
import { Footer } from "@/components/landing/footer";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  JsonLd,
} from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import { SectionSeparator } from "@/components/landing/section-separator";
import { alternativePath, comparisons } from "@/lib/comparisons";
import type { Cell, Comparison } from "@/lib/comparisons/types";

const SIGN_UP = "https://cloud.kaneo.app/auth/sign-up";

export type { Comparison };

function CellValue({ value, emphasize }: { value: Cell; emphasize?: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check
        aria-label="Yes"
        className={
          emphasize ? "size-4 text-primary" : "size-4 text-foreground/40"
        }
      />
    ) : (
      <Minus aria-label="No" className="size-4 text-foreground/30" />
    );
  }
  return (
    <span className={emphasize ? "text-foreground" : "text-foreground/70"}>
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
        <section className="relative overflow-hidden px-6 pt-14 pb-16 md:pt-20 md:pb-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl">
              <FadeIn delay={0}>
                <p className="font-medium text-primary text-sm">
                  Kaneo vs {data.competitor}
                </p>
              </FadeIn>
              <FadeIn delay={60}>
                <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.06] md:text-5xl">
                  {data.heading}
                </h1>
              </FadeIn>
              <FadeIn delay={120}>
                <p className="mt-5 text-balance text-foreground/70 text-lg leading-relaxed">
                  {data.subheading}
                </p>
              </FadeIn>
              <FadeIn delay={180}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-transparent bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                    href={SIGN_UP}
                  >
                    Start 14-day free trial
                  </a>
                  <a
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-transparent px-4 font-medium text-sm transition-colors hover:bg-accent"
                    href="/docs/core/installation"
                  >
                    Self-host for free
                  </a>
                </div>
              </FadeIn>
            </div>

            <FadeIn delay={200}>
              <div className="mt-12 max-w-3xl rounded-2xl border border-border/70 bg-card/70 p-5 md:p-6">
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
                    <dt className="font-medium text-foreground/50 text-xs uppercase tracking-wide">
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
              <div className="mt-12 overflow-hidden rounded-2xl border border-border/70 bg-card/70">
                <div className="grid grid-cols-[1.4fr_1fr_1fr] text-sm">
                  <div className="border-border/50 border-b px-4 py-3 font-medium sm:px-6" />
                  <div className="border-border/50 border-b bg-primary/5 px-4 py-3 text-center font-medium sm:px-6">
                    Kaneo
                  </div>
                  <div className="border-border/50 border-b px-4 py-3 text-center font-medium text-foreground/70 sm:px-6">
                    {data.competitor}
                  </div>

                  {data.rows.map((row) => (
                    <div key={row.feature} className="contents">
                      <div className="border-border/40 border-b px-4 py-3 text-foreground/80 sm:px-6">
                        {row.feature}
                      </div>
                      <div className="flex items-center justify-center border-border/40 border-b bg-primary/5 px-4 py-3 text-center sm:px-6">
                        <CellValue value={row.kaneo} emphasize />
                      </div>
                      <div className="flex items-center justify-center border-border/40 border-b px-4 py-3 text-center sm:px-6">
                        <CellValue value={row.them} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            <p className="mt-4 text-foreground/50 text-xs">
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
                    <p className="text-foreground/70 text-sm leading-relaxed">
                      {reason.body}
                    </p>
                  </div>
                ))}
              </div>

              {data.migration ? (
                <p className="mt-14 max-w-2xl text-foreground/70 text-sm leading-relaxed">
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

              <div className="mt-14 max-w-2xl rounded-xl border border-border/70 bg-card/70 p-5">
                <h3 className="font-medium text-sm">
                  When {data.competitor} is the better choice
                </h3>
                <p className="mt-2 text-foreground/70 text-sm leading-relaxed">
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
                    <p className="text-foreground/70 text-sm leading-relaxed">
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
                        className="inline-flex h-8 items-center rounded-lg border border-border/70 px-3 text-foreground/70 text-sm transition-colors hover:bg-accent hover:text-foreground"
                        href={alternativePath(entry.slug)}
                      >
                        Kaneo vs {entry.competitor}
                      </a>
                    ))}
                    <a
                      className="inline-flex h-8 items-center rounded-lg border border-border/70 px-3 text-foreground/70 text-sm transition-colors hover:bg-accent hover:text-foreground"
                      href="/alternatives"
                    >
                      All alternatives
                    </a>
                  </div>
                </div>
              ) : null}

              <div className="mt-12 flex flex-wrap items-center gap-3">
                <a
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-transparent bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                  href={SIGN_UP}
                >
                  Try Kaneo Cloud free
                </a>
                <a
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-transparent px-4 font-medium text-sm transition-colors hover:bg-accent"
                  href="/pricing"
                >
                  See pricing
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
