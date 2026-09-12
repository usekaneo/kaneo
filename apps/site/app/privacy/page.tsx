import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kaneo Cloud collects, uses, and protects your data.",
  alternates: {
    canonical: "/privacy",
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

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="relative px-6 pt-14 pb-16 md:pt-20 md:pb-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl pb-12">
              <p className="font-medium text-primary text-sm">Legal</p>
              <h1 className="mt-3 text-4xl font-medium leading-[1.06] md:text-5xl">
                Privacy Policy
              </h1>
              <p className="mt-4 text-foreground/60 text-sm">
                Last updated: July 28, 2026
              </p>
              <p className="mt-5 text-foreground/85 text-base leading-relaxed">
                This policy describes how the Kaneo website (kaneo.app) and the
                managed Kaneo Cloud service (cloud.kaneo.app) handle your data.
                The service is operated by Andrej Acevski (sole proprietor,
                Macedonia), referred to as “we” below. If you self-host Kaneo,
                this policy does not apply: your instance is under your control
                and we receive no data from it.
              </p>
            </div>

            <Section title="Data we collect">
              <p>
                <strong className="font-medium text-foreground">
                  Account data.
                </strong>{" "}
                When you create a Kaneo Cloud account we store your name, email
                address, and, if you sign in with GitHub, Google, or Discord,
                the basic profile information those providers share (such as
                your avatar). We never receive your passwords for those
                providers.
              </p>
              <p>
                <strong className="font-medium text-foreground">
                  Content you create.
                </strong>{" "}
                Workspaces, projects, tasks, comments, and file attachments you
                upload are stored so the service can function. This content
                belongs to you.
              </p>
              <p>
                <strong className="font-medium text-foreground">
                  Payment data.
                </strong>{" "}
                Payments for Kaneo Cloud are processed by Creem (creem.io)
                acting as merchant of record. Creem collects and processes your
                payment details under its own privacy policy; we never see or
                store your card number. We receive only what is needed to manage
                your subscription (such as plan, status, and billing country).
              </p>
              <p>
                <strong className="font-medium text-foreground">
                  Technical data.
                </strong>{" "}
                Standard server logs (IP address, request time, user agent) are
                kept briefly for security and troubleshooting. Application
                errors are reported to Sentry (EU region) and may include
                technical context about the request that failed; we configure
                error reporting not to include personal data by default.
              </p>
              <p>
                <strong className="font-medium text-foreground">
                  Analytics.
                </strong>{" "}
                Our public website uses a self-hosted instance of Plausible
                Analytics, which is cookie-free and does not track you across
                sites or build a profile of you. No analytics data is shared
                with third-party advertising companies.
              </p>
            </Section>

            <Section title="How we use data">
              <p>
                We use your data only to provide and improve the service:
                operating your account, storing your project content, sending
                transactional email (such as invitations, password resets, and
                billing notices), providing support, and keeping the service
                secure. We do not sell your data or use it for advertising.
              </p>
            </Section>

            <Section title="Where data lives">
              <p>
                Kaneo Cloud runs on servers in the European Union (Hetzner,
                Germany and Finland). Encrypted backups are stored with
                Cloudflare (R2). The following subprocessors help us run the
                service:
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Hetzner Online GmbH: hosting (EU)</li>
                <li>Cloudflare, Inc.: content delivery and backup storage</li>
                <li>Creem: payment processing (merchant of record)</li>
                <li>Resend: transactional email delivery</li>
                <li>
                  Functional Software, Inc. (Sentry): error monitoring (EU
                  region)
                </li>
                <li>
                  GitHub, Google, Discord: only if you choose to sign in with
                  them
                </li>
              </ul>
            </Section>

            <Section title="Your rights">
              <p>
                You can access, correct, export, or delete your data at any
                time. Most of this is available directly in the app; for
                anything else, email{" "}
                <a
                  className="text-foreground underline underline-offset-4 hover:no-underline"
                  href="mailto:support@kaneo.app"
                >
                  support@kaneo.app
                </a>{" "}
                and we will respond within 30 days. If you are in the EU/EEA,
                these rights are guaranteed by the GDPR, and you may also lodge
                a complaint with your local data protection authority.
              </p>
            </Section>

            <Section title="Retention and deletion">
              <p>
                We keep your data for as long as your account is active. If you
                delete your account, or request deletion by email, your data is
                removed from live systems within 30 days and from backups as
                they rotate out (at most 6 months). Billing records are retained
                as long as legally required.
              </p>
            </Section>

            <Section title="Cookies">
              <p>
                The marketing website sets no cookies. Kaneo Cloud uses only
                essential cookies required to keep you signed in. There are no
                advertising or cross-site tracking cookies.
              </p>
            </Section>

            <Section title="Changes and contact">
              <p>
                If we make material changes to this policy, we will notify
                registered users by email before they take effect. Questions?
                Contact{" "}
                <a
                  className="text-foreground underline underline-offset-4 hover:no-underline"
                  href="mailto:support@kaneo.app"
                >
                  support@kaneo.app
                </a>
                .
              </p>
            </Section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
