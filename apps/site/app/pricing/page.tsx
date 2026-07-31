import type { Metadata } from "next";
import { FadeIn } from "@/components/landing/fade-in";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { PricingPlans } from "@/components/landing/pricing-plans";
import { SectionSeparator } from "@/components/landing/section-separator";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple pricing for Kaneo Cloud. Self-hosting stays free and open source forever.",
  alternates: {
    canonical: "/pricing",
  },
};

const notes = [
  {
    title: "Already on Kaneo Cloud?",
    body: "Accounts created before paid plans launched keep free access for at least 12 months, with 6 months notice before anything changes, and a full export or self-hosting path either way.",
  },
  {
    title: "Fair billing",
    body: "Payments are processed by Creem as merchant of record; applicable taxes are handled where required. Cancel anytime; your plan stays active until the end of the billing period.",
  },
  {
    title: "Questions?",
    body: "We answer billing and pricing questions at",
    email: "support@kaneo.app",
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="relative overflow-hidden px-6 pt-14 pb-16 md:pt-20 md:pb-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl">
              <FadeIn delay={0}>
                <p className="font-medium text-primary text-sm">Pricing</p>
              </FadeIn>
              <FadeIn delay={60}>
                <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.06] md:text-5xl">
                  Free to run yourself.
                  <br />
                  Fair when we run it for you.
                </h1>
              </FadeIn>
              <FadeIn delay={120}>
                <p className="mt-5 text-balance text-foreground/70 text-lg leading-relaxed">
                  Self-hosting is free forever. Kaneo Cloud starts with a 14-day
                  free trial, no credit card required.
                </p>
              </FadeIn>
            </div>

            <FadeIn delay={200}>
              <div className="mt-12">
                <PricingPlans />
              </div>
            </FadeIn>
          </div>
        </section>

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-3">
              {notes.map((note) => (
                <div key={note.title} className="space-y-2">
                  <h3 className="font-medium text-sm">{note.title}</h3>
                  <p className="text-foreground/70 text-sm leading-relaxed">
                    {note.body}
                    {note.email && (
                      <>
                        {" "}
                        <a
                          className="text-foreground underline underline-offset-4 hover:no-underline"
                          href={`mailto:${note.email}`}
                        >
                          {note.email}
                        </a>
                        .
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </SectionSeparator>
      </main>
      <Footer />
    </>
  );
}
