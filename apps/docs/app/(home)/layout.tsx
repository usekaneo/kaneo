import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import type { ReactNode } from "react";
import { baseOptions } from "@/app/layout.config";

export const metadata: Metadata = {
  title: "Kaneo ⎯ All you need. Nothing you don't.",
  description:
    "All you need. Nothing you don't. Open source project management that works for you, not against you. Self-hosted, simple, and powerful.",
  alternates: {
    canonical: "https://kaneo.app",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://kaneo.app",
    title: "Kaneo ⎯ All you need. Nothing you don't.",
    description:
      "Open source project management that works for you, not against you. Self-hosted, simple, and powerful.",
    siteName: "Kaneo",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kaneo ⎯ All you need. Nothing you don't.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaneo ⎯ All you need. Nothing you don't.",
    description:
      "Open source project management that works for you, not against you. Self-hosted, simple, and powerful.",
    images: ["/og-image.png"],
    creator: "@usekaneo",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      "max-image-preview": "none",
    },
  },
  metadataBase: new URL("https://kaneo.app"),
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      className="bg-sidebar"
      {...baseOptions}
      links={[
        {
          type: "custom",
          on: "nav",
          children: (
            <Link
              href="https://cloud.kaneo.app"
              className="inline-flex items-center gap-1.5 p-2 text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground data-[active=true]:text-fd-primary [&_svg]:size-4 text-base"
            >
              Cloud
              <span className="rounded border border-fd-border bg-fd-card px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-fd-muted-foreground">
                Free Forever
              </span>
            </Link>
          ),
        },
        {
          type: "custom",
          on: "nav",
          children: (
            <Link
              href="/docs"
              className="inline-flex items-center gap-1 p-2 text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground data-[active=true]:text-fd-primary [&_svg]:size-4 text-base"
            >
              Documentation
            </Link>
          ),
        },
        {
          type: "menu",
          on: "menu",
          text: "Links",
          items: [
            {
              text: "Cloud (Always Free)",
              url: "https://cloud.kaneo.app",
              external: true,
            },
            {
              text: "Documentation",
              url: "/docs",
            },
          ],
        },
        {
          type: "icon",
          url: "https://github.com/usekaneo/kaneo",
          text: "GitHub",
          icon: (
            <svg
              aria-label="GitHub"
              role="img"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          ),
          external: true,
        },
        {
          type: "icon",
          url: "https://discord.com/invite/rU4tSyhXXU",
          text: "Discord",
          icon: (
            <svg
              viewBox="0 -28.5 256 256"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Discord</title>
              <g>
                <path
                  d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
                  fill="currentColor"
                />
              </g>
            </svg>
          ),
          external: true,
        },
      ]}
    >
      <Script
        defer
        data-domain="kaneo.app"
        src="https://plausible.kaneo.app/js/script.js"
      />
      {children}
    </HomeLayout>
  );
}
