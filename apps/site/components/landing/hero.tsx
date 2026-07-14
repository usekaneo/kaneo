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
              <Button
                variant="outline"
                size="lg"
                className="gap-2 border-[#da552f]/40 bg-[#da552f]/8 text-foreground hover:bg-[#da552f]/14"
                render={
                  <a
                    href="https://www.producthunt.com/products/kaneo"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View Kaneo on Product Hunt"
                  >
                    <img
                      src="/images/product-hunt.svg"
                      alt=""
                      className="size-5"
                      aria-hidden="true"
                    />
                    Product Hunt
                  </a>
                }
              />
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
