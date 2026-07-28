import { Check } from "lucide-react";
import type { Metadata } from "next";
import { FadeIn } from "@/components/landing/fade-in";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { SectionSeparator } from "@/components/landing/section-separator";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple pricing for Kaneo Cloud. Self-hosting stays free and open source forever.",
  alternates: {
    canonical: "/pricing",
  },
};

type Plan = {
  name: string;
  tagline: string;
  price: string;
  priceSuffix: string;
  annualNote: string;
  features: string[];
  cta: { href: string; label: string };
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Self-hosted",
    tagline: "Your servers, your rules",
    price: "€0",
    priceSuffix: "forever",
    annualNote: "MIT licensed, no strings attached",
    features: [
      "Unlimited users and projects",
      "Every feature, including SSO",
      "Your data on your servers",
      "Community support on Discord",
    ],
    cta: {
      href: "/docs/core/installation",
      label: "Read installation guide",
    },
  },
  {
    name: "Cloud Personal",
    tagline: "Managed hosting for one",
    price: "€4",
    priceSuffix: "/ month",
    annualNote: "€40 / year (2 months free)",
    features: [
      "Single user",
      "Unlimited projects and tasks",
      "Automatic backups and updates",
      "Email support",
    ],
    cta: {
      href: "https://cloud.kaneo.app",
      label: "Start 14-day free trial",
    },
  },
  {
    name: "Cloud Team",
    tagline: "Managed hosting for teams",
    price: "€5",
    priceSuffix: "/ user / month",
    annualNote: "€50 / user / year (2 months free)",
    features: [
      "Unlimited team members",
      "Unlimited projects and tasks",
      "Workspace roles and permissions",
      "Automatic backups and updates",
      "Priority email support",
    ],
    cta: {
      href: "https://cloud.kaneo.app",
      label: "Start 14-day free trial",
    },
    highlighted: true,
  },
];

const notes = [
  {
    title: "Already on Kaneo Cloud?",
    body: "Accounts created before paid plans launched keep free access for at least 12 months, with 6 months notice before anything changes, and a full export or self-hosting path either way.",
  },
  {
    title: "Fair billing",
    body: "Payments are processed by Creem as merchant of record; VAT is handled where required. Cancel anytime; your plan stays active until the end of the billing period.",
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
              <div className="mt-12 rounded-2xl border border-border/70 bg-card/70 p-2">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                  {plans.map((plan) => (
                    <article
                      key={plan.name}
                      className={`flex flex-col rounded-xl border p-6 lg:p-8 ${
                        plan.highlighted
                          ? "border-primary/40 bg-card shadow-[0_0_40px_-12px] shadow-primary/20"
                          : "border-border/70 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="font-medium text-sm">{plan.name}</h2>
                        {plan.highlighted && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                            Most popular
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-foreground/60 text-sm">
                        {plan.tagline}
                      </p>

                      <div className="mt-6 flex items-baseline gap-1.5">
                        <span className="text-4xl font-medium tracking-tight">
                          {plan.price}
                        </span>
                        <span className="text-foreground/60 text-sm">
                          {plan.priceSuffix}
                        </span>
                      </div>
                      <p className="mt-1.5 text-foreground/60 text-sm">
                        {plan.annualNote}
                      </p>

                      <ul className="mt-8 flex-1 space-y-3 text-sm">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2.5"
                          >
                            <Check
                              aria-hidden="true"
                              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                            />
                            <span className="text-foreground/90">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <a
                        className={`mt-8 inline-flex h-10 items-center justify-center rounded-lg border px-4 font-medium text-sm transition-colors ${
                          plan.highlighted
                            ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                            : "border-border bg-transparent hover:bg-accent"
                        }`}
                        href={plan.cta.href}
                      >
                        {plan.cta.label}
                      </a>
                    </article>
                  ))}
                </div>
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
