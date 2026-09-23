import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { PageIntro } from "@/components/landing/page-intro";
import { Button } from "@/components/ui/button";
import { press, pressLinks } from "@/lib/press";

export const metadata: Metadata = {
  title: press.title,
  description: press.description,
  alternates: { canonical: "/press" },
  openGraph: {
    title: `${press.title} | Kaneo`,
    description: press.description,
    url: "/press",
    images: [{ url: "/images/hero.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${press.title} | Kaneo`,
    description: press.description,
    images: ["/images/hero.png"],
  },
};

const linkClass =
  "inline-flex items-center gap-2 rounded-sm text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4";

const logos = [
  {
    title: press.darkLogo,
    detail: press.darkLogoDetail,
    alt: press.darkLogoAlt,
    src: "/logo-dark.svg",
    filename: "kaneo-wordmark-dark.svg",
    background: "bg-[#f5f5f5]",
    width: 450,
    height: 104,
  },
  {
    title: press.lightLogo,
    detail: press.lightLogoDetail,
    alt: press.lightLogoAlt,
    src: "/logo-light.svg",
    filename: "kaneo-wordmark-light.svg",
    background: "bg-[#141414]",
    width: 450,
    height: 104,
  },
  {
    title: press.icon,
    detail: press.iconDetail,
    alt: press.iconAlt,
    src: "/logo-512.png",
    filename: "kaneo-icon.png",
    background: "bg-[#e8e8e8]",
    width: 512,
    height: 512,
  },
];

const screenshots = [
  {
    title: press.lightScreenshot,
    alt: press.lightScreenshotAlt,
    src: "/images/light.png",
    filename: "kaneo-board-light.png",
    width: 3456,
    height: 2000,
  },
  {
    title: press.darkScreenshot,
    alt: press.darkScreenshotAlt,
    src: "/images/dark.png",
    filename: "kaneo-board-dark.png",
    width: 3456,
    height: 2000,
  },
  {
    title: press.lightListScreenshot,
    alt: press.lightListScreenshotAlt,
    src: "/images/product/list-light.png",
    filename: "kaneo-list-light.png",
    width: 3456,
    height: 2000,
  },
  {
    title: press.darkListScreenshot,
    alt: press.darkListScreenshotAlt,
    src: "/images/product/list-dark.png",
    filename: "kaneo-list-dark.png",
    width: 3456,
    height: 2000,
  },
  {
    title: press.lightTimelineScreenshot,
    alt: press.lightTimelineScreenshotAlt,
    src: "/images/product/timeline-light.png",
    filename: "kaneo-timeline-light.png",
    width: 3456,
    height: 2000,
  },
  {
    title: press.darkTimelineScreenshot,
    alt: press.darkTimelineScreenshotAlt,
    src: "/images/product/timeline-dark.png",
    filename: "kaneo-timeline-dark.png",
    width: 3456,
    height: 2000,
  },
  {
    title: press.lightTaskScreenshot,
    alt: press.lightTaskScreenshotAlt,
    src: "/images/product/task-light.png",
    filename: "kaneo-task-light.png",
    width: 3456,
    height: 2000,
  },
  {
    title: press.darkTaskScreenshot,
    alt: press.darkTaskScreenshotAlt,
    src: "/images/product/task-dark.png",
    filename: "kaneo-task-dark.png",
    width: 3456,
    height: 2000,
  },
];

function AssetCard({
  title,
  detail,
  src,
  filename,
  children,
}: {
  title: string;
  detail: string;
  src: string;
  filename: string;
  children: ReactNode;
}) {
  return (
    <a
      href={src}
      download={filename}
      aria-label={`${press.download} ${title}`}
      className="group block overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      {children}
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <ArrowDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
        />
      </div>
    </a>
  );
}

export default function PressPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-14 px-6 py-14 md:space-y-16 md:py-20 lg:pt-24">
        <PageIntro
          eyebrow={press.title}
          title={press.headline}
          description={press.intro}
        >
          <Button
            size="lg"
            className="mt-8 h-12 gap-3 px-5 text-sm sm:h-12"
            render={<a href="/press/kaneo-press-kit.zip" download />}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
            {press.downloadKit}
          </Button>
        </PageIntro>

        <section aria-labelledby="logos" className="border-t pt-12">
          <h2
            id="logos"
            className="text-2xl font-medium tracking-tight md:text-3xl"
          >
            {press.logosTitle}
          </h2>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>{press.usageContrast}</li>
            <li>{press.usageProportions}</li>
            <li>{press.usageSpace}</li>
          </ul>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {logos.map((logo) => (
              <AssetCard key={logo.src} {...logo}>
                <div
                  className={`flex aspect-[4/3] items-center justify-center p-8 ${logo.background}`}
                >
                  <Image
                    src={logo.src}
                    alt={logo.alt}
                    width={logo.width}
                    height={logo.height}
                    className={
                      logo.width === 512
                        ? "size-20 rounded-2xl"
                        : "h-auto w-full"
                    }
                  />
                </div>
              </AssetCard>
            ))}
          </div>
        </section>

        <section aria-labelledby="screenshots" className="border-t pt-12">
          <h2
            id="screenshots"
            className="text-2xl font-medium tracking-tight md:text-3xl"
          >
            {press.screenshotsTitle}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {screenshots.map((screenshot) => (
              <AssetCard
                key={screenshot.src}
                {...screenshot}
                detail={`${screenshot.width} × ${screenshot.height}, PNG`}
              >
                <Image
                  src={screenshot.src}
                  alt={screenshot.alt}
                  width={screenshot.width}
                  height={screenshot.height}
                  className="h-auto w-full"
                  sizes="(min-width: 1200px) 568px, (min-width: 640px) calc(50vw - 32px), calc(100vw - 48px)"
                />
              </AssetCard>
            ))}
          </div>
        </section>

        <section aria-labelledby="about" className="max-w-2xl border-t pt-12">
          <h2
            id="about"
            className="text-2xl font-medium tracking-tight md:text-3xl"
          >
            {press.boilerplateTitle}
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {press.boilerplate}
          </p>
        </section>

        <section aria-labelledby="contact-title" className="border-t pt-8">
          <h2
            id="contact-title"
            className="text-2xl font-medium tracking-tight md:text-3xl"
          >
            {press.contactTitle}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {press.contactBody}
          </p>
          <a
            href={`mailto:${pressLinks.email}`}
            className={`${linkClass} mt-3 min-h-8`}
          >
            {pressLinks.email}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        </section>
      </main>
      <Footer />
    </>
  );
}
