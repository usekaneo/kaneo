"use client";

import { Github } from "lucide-react";
import { AppPreview } from "@/components/landing/app-preview";
import { FadeIn } from "@/components/landing/fade-in";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-14 pb-16 md:pt-20 md:pb-20 lg:pt-24">
      <div className="mx-auto w-full max-w-6xl">
        {/* ── Heading + description + buttons ── */}
        <div className="mb-10 max-w-2xl">
          <FadeIn delay={0}>
            <a
              href="https://www.producthunt.com/products/kaneo?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-kaneo-2"
              target="_blank"
              rel="noopener noreferrer"
              className="mb-6 inline-block"
            >
              {/* biome-ignore lint/performance/noImgElement: Product Hunt requires their exact embed markup */}
              <img
                alt="Kaneo - All you need. Nothing you don't. | Product Hunt"
                width={220}
                height={48}
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1051454&theme=light&t=1778000906780"
              />
            </a>
          </FadeIn>
          <FadeIn delay={40}>
            <h1 className="text-balance text-4xl font-medium leading-[1.06] md:text-5xl lg:text-6xl">
              All you <span className="text-primary">need</span>. Nothing you
              don&apos;t.
            </h1>
          </FadeIn>
          <FadeIn delay={80}>
            <p className="mt-5 text-balance text-lg text-muted-foreground leading-relaxed md:text-xl">
              Kaneo gives you clean planning, focused execution, and full
              ownership of your workflow from backlog to release.
            </p>
          </FadeIn>

          <FadeIn delay={160}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => {
                  window.location.href = "https://cloud.kaneo.app";
                }}
              >
                Cloud
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => {
                  window.location.href = "/docs/core";
                }}
              >
                Get Started
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => {
                  window.location.href = "https://github.com/usekaneo/kaneo";
                }}
              >
                <Github className="h-4 w-4" />
                GitHub
              </Button>
            </div>
          </FadeIn>
        </div>

        {/* ── App preview — interactive mock of the real Kaneo UI ── */}
        <FadeIn delay={240} distance={32}>
          <AppPreview />
        </FadeIn>
      </div>
    </section>
  );
}
