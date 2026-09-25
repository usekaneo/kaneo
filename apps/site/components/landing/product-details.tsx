import { ArrowUpRight } from "lucide-react";
import { landing } from "@/lib/landing";
import { productAnswers } from "@/lib/product";

const resources = [
  {
    ...landing.resources.docker,
    href: "/guides/self-host-project-management-docker",
  },
  {
    ...landing.resources.sso,
    href: "/docs/core/social-providers/custom-oauth",
  },
  {
    ...landing.resources.mcp,
    href: "/guides/project-management-mcp-ai-agents",
  },
  { ...landing.resources.linear, href: "/linear-alternative" },
];

export function ProductDetails() {
  return (
    <section
      className="px-6 py-16 md:py-24"
      aria-labelledby="product-details-title"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[0.85fr_1.3fr] md:gap-20">
          <div>
            <h2
              id="product-details-title"
              className="text-2xl font-medium tracking-tight md:text-3xl"
            >
              {landing.product.title}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {landing.product.description}
            </p>
          </div>
          <div className="divide-y border-y">
            {productAnswers.map((item) => (
              <div key={item.href} className="py-6 first:pt-6">
                <h3 className="font-medium">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {item.answer}
                </p>
                <a
                  href={item.href}
                  className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
                >
                  {item.link}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-20 md:mt-28">
          <p className="text-xs text-muted-foreground">
            {landing.resources.eyebrow}
          </p>
          <h2 className="mt-4 max-w-xl text-2xl font-medium tracking-tight md:text-3xl">
            {landing.resources.title}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {landing.resources.description}
          </p>
          <div className="mt-8 grid gap-x-10 md:grid-cols-2">
            {resources.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group flex items-start justify-between gap-6 border-t py-6 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
              >
                <div>
                  <h3 className="text-sm font-medium group-hover:underline underline-offset-4">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <ArrowUpRight
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
