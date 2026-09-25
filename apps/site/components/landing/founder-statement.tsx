import { FadeIn } from "@/components/landing/fade-in";
import { landing } from "@/lib/landing";

export function FounderStatement() {
  return (
    <section id="why" className="px-6 py-16 md:py-20">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] lg:gap-16">
        <FadeIn>
          <h2 className="text-balance text-3xl font-semibold md:text-4xl">
            {landing.founder.title}
          </h2>
        </FadeIn>
        <FadeIn delay={80} className="max-w-[40rem] lg:pt-1">
          <div className="space-y-6 text-lg font-normal leading-relaxed text-foreground">
            <p>{landing.founder.intro}</p>
            <p>{landing.founder.problem}</p>
            <p>{landing.founder.principle}</p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
