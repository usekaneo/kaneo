import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Kaneo Cloud.",
  alternates: {
    canonical: "/terms",
  },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-border/50 py-10 md:grid-cols-[260px_1fr] md:gap-10">
      <h2 className="font-medium text-base">{title}</h2>
      <div className="space-y-4 text-foreground/85 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="relative px-6 pt-14 pb-16 md:pt-20 md:pb-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl pb-12">
              <p className="font-medium text-primary text-sm">Legal</p>
              <h1 className="mt-3 text-4xl font-medium leading-[1.06] md:text-5xl">
                Terms of Service
              </h1>
              <p className="mt-4 text-foreground/60 text-sm">
                Last updated: July 28, 2026
              </p>
              <p className="mt-5 text-foreground/85 text-base leading-relaxed">
                These terms govern your use of the managed Kaneo Cloud service
                at cloud.kaneo.app, operated by Andrej Acevski (sole proprietor,
                Macedonia), referred to as “we” or “us”. By creating an account
                you agree to these terms. The open-source Kaneo software itself
                is separately licensed under the MIT license, and self-hosted
                installations are not covered by these terms.
              </p>
            </div>

            <Section title="1. The service">
              <p>
                Kaneo Cloud is a hosted version of the open-source Kaneo project
                management application. We operate the infrastructure, apply
                updates, and maintain backups so you don’t have to. We may
                improve or modify the service over time; we will not materially
                reduce core functionality of a paid plan during a paid period.
              </p>
            </Section>

            <Section title="2. Accounts">
              <p>
                You must provide accurate information and keep your account
                credentials secure. You are responsible for activity under your
                account and for content your workspace members create. You must
                be at least 16 years old to use the service.
              </p>
            </Section>

            <Section title="3. Plans, billing, and trials">
              <p>
                Current prices are listed on our{" "}
                <a
                  className="text-foreground underline underline-offset-4 hover:no-underline"
                  href="/pricing"
                >
                  pricing page
                </a>
                . Paid plans start with a 14-day free trial. Payments are
                processed by Creem as merchant of record. Creem is the seller of
                record and handles payment collection, invoices, and applicable
                taxes. Subscriptions renew automatically (monthly or annually)
                until cancelled. You can cancel anytime; your plan remains
                active until the end of the paid period. If you believe a charge
                is in error, contact us within 14 days and we will work with you
                on a refund where appropriate.
              </p>
              <p>
                Accounts created before paid plans were introduced keep free
                access for at least 12 months from that introduction, and we
                will give at least 6 months notice before their terms change.
              </p>
            </Section>

            <Section title="4. Your content">
              <p>
                Content you create in Kaneo Cloud belongs to you. You grant us
                only the rights needed to host, back up, and display it to you
                and the people you share it with. You can export your data at
                any time, including for migration to a self-hosted installation.
              </p>
            </Section>

            <Section title="5. Acceptable use">
              <p>
                Don’t use the service to break the law, infringe others’ rights,
                distribute malware, send spam, or attempt to disrupt the service
                or access other customers’ data. We may suspend accounts that
                do, after notice where practical.
              </p>
            </Section>

            <Section title="6. Availability and support">
              <p>
                We aim for high availability and maintain monitoring and daily
                backups, but the service is provided without a formal uptime
                guarantee (SLA). Support is provided by email at{" "}
                <a
                  className="text-foreground underline underline-offset-4 hover:no-underline"
                  href="mailto:support@kaneo.app"
                >
                  support@kaneo.app
                </a>
                .
              </p>
            </Section>

            <Section title="7. Disclaimer and liability">
              <p>
                The service is provided “as is” without warranties of any kind,
                to the extent permitted by law. Our total liability for any
                claims arising from the service is limited to the amount you
                paid us in the 12 months before the claim. We are not liable for
                indirect or consequential damages, or for loss of data you have
                not given us a reasonable opportunity to help recover.
              </p>
            </Section>

            <Section title="8. Termination">
              <p>
                You may delete your account at any time. We may terminate or
                suspend accounts that violate these terms. If we ever
                discontinue the service, we will give at least 6 months notice
                and provide a data export path. The open-source, self-hosted
                edition of Kaneo will always remain available.
              </p>
            </Section>

            <Section title="9. Changes and governing law">
              <p>
                We may update these terms; material changes will be announced to
                registered users by email at least 30 days in advance. These
                terms are governed by the laws of Macedonia, without affecting
                mandatory consumer protections of your country of residence.
              </p>
            </Section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
