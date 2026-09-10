import { FadeIn } from "@/components/landing/fade-in";

export function Features() {
  return (
    <section
      id="features"
      className="relative bg-sidebar/55 px-6 py-16 md:py-20"
    >
      <div className="mx-auto w-full max-w-6xl">
        <FadeIn>
          <div className="rounded-2xl border border-border/70 bg-card/70 p-2">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
              <article className="rounded-md border border-border/70 bg-card p-6 lg:col-span-5 lg:p-8">
                <p className="font-medium text-muted-foreground text-sm">
                  Core workflows
                </p>
                <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">
                  Minimal surface area. Maximum execution clarity.
                </h2>
                <p className="mt-4 max-w-xl text-muted-foreground text-base leading-relaxed">
                  Kaneo keeps planning operational: less dashboard theater, more
                  visible ownership and throughput.
                </p>
                <div className="mt-6 rounded-xl border border-border/60 bg-muted/30 p-4">
                  <h3 className="text-sm font-medium">
                    Board and list, same source of truth
                  </h3>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                    Plan in list view, execute in board view, and keep statuses,
                    priorities, and labels in sync.
                  </p>
                </div>
              </article>

              <div className="grid grid-cols-1 gap-2 lg:col-span-7 sm:grid-cols-2">
                <article className="rounded-md border border-border/70 bg-card p-6">
                  <h3 className="text-sm font-medium">
                    Planning that stays focused
                  </h3>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                    Assign owners, due dates, and priorities without introducing
                    heavy process.
                  </p>
                </article>

                <article className="rounded-md border border-border/70 bg-card p-6">
                  <h3 className="text-sm font-medium">Labels and priorities</h3>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                    Organize initiatives with labels and prioritize work clearly
                    across backlog and active scope.
                  </p>
                </article>

                <article className="rounded-md border border-border/70 bg-card p-6 sm:col-span-2">
                  <h3 className="text-sm font-medium">
                    Native GitHub integration
                  </h3>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                    Sync issues and keep product planning aligned with
                    development execution.
                  </p>
                </article>

                <article className="rounded-md border border-border/70 bg-card p-6">
                  <h3 className="text-sm font-medium">Privacy first</h3>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                    Minimal analytics and transparent architecture for teams
                    that care about control.
                  </p>
                </article>

                <article className="rounded-md border border-border/70 bg-card p-6">
                  <h3 className="text-sm font-medium">
                    Self-hosted by default
                  </h3>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                    Deploy with Docker and keep full ownership of your
                    infrastructure and data.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
