import { ChevronRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <div className="relative pt-24 pb-24 md:pt-36 lg:pt-44 overflow-hidden p-4">
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="md:w-1/2">
          <div>
            <a
              href="https://github.com/usekaneo/kaneo/releases/tag/v2.0.0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/30 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card/50 hover:text-foreground mb-6"
            >
              <span className="text-base">🎉</span>
              <span>Version 2 is now available</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
            <h1 className="max-w-md text-balance text-5xl font-medium md:text-6xl">
              All you{" "}
              <span className="relative text-primary">
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-4"
                  viewBox="0 0 100 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 8C20 3, 40 2, 60 3C75 4, 85 6, 98 8"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-primary/40"
                  />
                </svg>
                <span className="relative">need</span>
              </span>
              . Nothing you don't.
            </h1>
            <p className="text-muted-foreground mb-8 mt-4 max-w-2xl text-balance text-xl">
              The project management tool that gets out of your way. Focus on
              what matters with Kaneo's minimalist approach to team
              collaboration.
            </p>
            <div className="flex items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <a href="/docs" className="text-white">
                  Get Started
                  <ChevronRight className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <a href="https://github.com/usekaneo/kaneo">
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="perspective-near mt-24 translate-x-0 md:absolute md:-right-6 md:bottom-16 md:left-1/2 md:top-40 md:mt-0 md:-translate-x-16">
        <div className="before:border-foreground/5 before:bg-foreground/5 relative h-full max-w-2xl before:absolute before:-inset-x-4 before:bottom-7 before:top-0 before:skew-x-6 before:rounded-[calc(var(--radius)+1rem)] before:border">
          <div className="bg-background rounded-(--radius) shadow-foreground/10 ring-foreground/5 relative h-full -translate-y-12 skew-x-6 overflow-hidden border border-transparent shadow-md ring-1">
            {/** biome-ignore lint/performance/noImgElement: we need to use the img element */}
            <img
              src="/cover-dark.png"
              alt="Kaneo Dashboard"
              className="w-full h-full object-cover object-left p-2 bg-sidebar hidden dark:block"
            />
            {/** biome-ignore lint/performance/noImgElement: we need to use the img element */}
            <img
              alt="Kaneo Dashboard"
              className="w-full h-full object-cover object-left p-2 block dark:hidden"
              src="/cover-white.png"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
