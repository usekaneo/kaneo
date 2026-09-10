"use client";

import { ArrowUpRight } from "lucide-react";
import { AppPreview } from "@/components/landing/app-preview";
import { FadeIn } from "@/components/landing/fade-in";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-14 pb-16 md:pt-20 md:pb-20 lg:pt-24">
      <div className="mx-auto w-full max-w-6xl">
        {/* ── Heading + description + buttons ── */}
        <div className="mb-10 max-w-4xl">
          <FadeIn delay={0}>
            <h1 className="text-balance text-4xl font-medium leading-[1.06] md:text-5xl">
              Project management{" "}
              <span className="text-primary md:block md:whitespace-nowrap">
                that doesn&apos;t become the project.
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={80}>
            <p className="mt-5 max-w-2xl text-balance text-lg text-muted-foreground leading-relaxed md:text-xl">
              Plan work, keep ownership clear, and move from backlog to release
              without adding process for process&apos;s sake.
            </p>
          </FadeIn>

          <FadeIn delay={160}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => {
                  window.location.href = "https://cloud.kaneo.app/auth/sign-up";
                }}
              >
                Start for free
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => {
                  window.location.href = "/docs/core";
                }}
              >
                Self-host
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  window.location.href = "https://github.com/usekaneo/kaneo";
                }}
              >
                View on GitHub
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </FadeIn>
        </div>

        {/* ── App preview: interactive mock of the real Kaneo UI ── */}
        <FadeIn delay={240} distance={32}>
          <AppPreview />
        </FadeIn>
      </div>
    </section>
  );
}
