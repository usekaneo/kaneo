import { Button } from "@/components/ui/button";
import { ChevronRight, Github, Users } from "lucide-react";

export default function Hero() {
  return (
    <div className="relative pb-36 pt-24 md:pt-36 lg:pt-44 overflow-hidden">
      <div className="relative z-10 mx-auto w-full container">
        <div className="md:w-1/2">
          <div>
            <h1 className="max-w-md text-balance text-5xl font-medium md:text-6xl">
              All you need. Nothing you don't.
            </h1>
            <p className="text-muted-foreground mb-8 mt-4 max-w-2xl text-balance text-xl">
              The project management tool that gets out of your way. Focus on
              what matters with Kaneo's minimalist approach to team
              collaboration.
            </p>
            <div className="flex items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <a href="/docs">
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
          <div className="mt-12">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">2000+</span>
                </div>
                <span className="text-sm font-medium">GitHub Stars</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="perspective-near mt-24 translate-x-12 md:absolute md:-right-6 md:bottom-16 md:left-1/2 md:top-40 md:mt-0 md:translate-x-0">
        <div className="before:border-foreground/5 before:bg-foreground/5 relative h-full max-w-3xl before:absolute before:-inset-x-4 before:bottom-7 before:top-0 before:skew-x-6 before:rounded-[calc(var(--radius)+1rem)] before:border">
          <div className="bg-background rounded-(--radius) shadow-foreground/10 ring-foreground/5 relative h-full -translate-y-12 skew-x-6 overflow-hidden border border-transparent shadow-md ring-1">
            <img
              src="/cover.png"
              alt="Kaneo Dashboard"
              className="w-full h-full object-cover object-left p-2 bg-sidebar hidden dark:block"
            />
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
