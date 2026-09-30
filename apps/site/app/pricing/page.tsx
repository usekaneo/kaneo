import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { PageIntro } from "@/components/landing/page-intro";
import { PricingPlans } from "@/components/landing/pricing-plans";
import { SectionSeparator } from "@/components/landing/section-separator";
import { withSocialMetadata } from "@/lib/metadata";

export const metadata: Metadata = withSocialMetadata({
  title: "Pricing",
  description:
    "Simple pricing for Kaneo Cloud. Self-hosting stays free and open source forever.",
  alternates: {
    canonical: "/pricing",
  },
});

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
        <section className="relative overflow-hidden px-6 pt-14 pb-16 md:pt-20 md:pb-20 lg:pt-24">
          <div className="mx-auto w-full max-w-6xl">
            <PageIntro
              eyebrow="Pricing"
              title={
                <>
                  Free to run yourself.
                  <br />
                  Fair when we run it for you.
                </>
              }
              description="Self-hosting is free forever. Kaneo Cloud starts with a 14-day free trial, no credit card required."
            />

            <div className="mt-12">
              <PricingPlans />
            </div>
          </div>
        </section>

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-3">
              {notes.map((note) => (
                <div key={note.title} className="space-y-2">
                  <h3 className="font-medium text-sm">{note.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
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
