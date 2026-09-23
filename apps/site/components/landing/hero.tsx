"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { FadeIn } from "@/components/landing/fade-in";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { Button } from "@/components/ui/button";
import { landing } from "@/lib/landing";

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
            <div className="mt-8 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="h-12 gap-3 px-5 text-sm sm:h-12"
                  render={<a href="https://cloud.kaneo.app/auth/sign-up" />}
                >
                  {landing.hero.cloudCta}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-5 text-sm sm:h-12"
                  render={<a href="/docs/core/installation" />}
                >
                  {landing.hero.selfHostCta}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {landing.hero.trialNote}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6">
              <a
                href="https://github.com/usekaneo/kaneo"
                className="inline-flex min-h-11 items-center gap-2 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
              >
                <GithubIcon className="size-3.5" />
                {landing.hero.github}
              </a>
              <a
                href="https://www.producthunt.com/products/kaneo"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
              >
                {landing.hero.productHunt}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </a>
            </div>
          </FadeIn>
        </div>

        <ProductShowcase />
      </div>
    </section>
  );
}
