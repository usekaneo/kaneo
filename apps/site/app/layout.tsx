import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kaneo.app"),
  title: {
    default: "IPSTUDIO — All you need. Nothing you don't.",
    template: "%s | IPSTUDIO",
  },
  description:
    "All you need. Nothing you don't. Open source project management that works for you, not against you.",
  keywords: [
    "ipstudio",
    "project management",
    "open source",
    "kanban",
    "task management",
    "self-hosted",
    "team collaboration",
  ],
  applicationName: "IPSTUDIO",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://kaneo.app",
    siteName: "IPSTUDIO",
    title: "IPSTUDIO — All you need. Nothing you don't.",
    description:
      "Open source project management that works for you, not against you. Self-hosted, simple, and powerful.",
    images: [
      {
        url: "/images/hero.png",
        width: 1200,
        height: 630,
        alt: "IPSTUDIO",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IPSTUDIO — All you need. Nothing you don't.",
    description:
      "Open source project management that works for you, not against you. Self-hosted, simple, and powerful.",
    images: ["/images/hero.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: This is necessary to apply the user's preferred color scheme before React hydration to prevent a flash of incorrect theme.
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var media = window.matchMedia('(prefers-color-scheme: dark)');
                  function applyTheme(isDark) {
                    document.documentElement.classList.toggle('dark', isDark);
                    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
                  }
                  applyTheme(media.matches);
                  if (media.addEventListener) {
                    media.addEventListener('change', function(e) { applyTheme(e.matches); });
                  } else if (media.addListener) {
                    media.addListener(function(e) { applyTheme(e.matches); });
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {children}
        <Script
          defer
          data-domain="kaneo.app"
          src="https://plausible.kaneo.app/js/script.file-downloads.hash.outbound-links.pageview-props.revenue.tagged-events.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {
            "window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }"
          }
        </Script>
      </body>
    </html>
  );
}
