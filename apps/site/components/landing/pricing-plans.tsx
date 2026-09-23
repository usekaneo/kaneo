"use client";

import NumberFlow from "@number-flow/react";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const APP_URL = "https://cloud.kaneo.app";

type Interval = "monthly" | "annual";

type Plan = {
  name: string;
  tagline: string;
  checkout?: "personal" | "team";
  monthly: { price: number; suffix: string; note: string };
  annual: { price: number; suffix: string; note: string };
  features: string[];
  cta: { href: string; label: string };
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Self-hosted",
    tagline: "Run it on your own servers",
    monthly: { price: 0, suffix: "forever", note: "MIT licensed" },
    annual: { price: 0, suffix: "forever", note: "MIT licensed" },
    features: [
      "Unlimited users and projects",
      "Every feature, including SSO",
      "Your data on your servers",
      "Community support on Discord",
    ],
    cta: { href: "/docs/core/installation", label: "Read installation guide" },
  },
  {
    name: "Cloud Personal",
    tagline: "Managed hosting for one",
    checkout: "personal",
    monthly: { price: 4, suffix: "/ month", note: "Billed monthly" },
    annual: {
      price: 40,
      suffix: "/ year",
      note: "$3.33 / month, billed yearly",
    },
    features: [
      "Single user",
      "Unlimited projects and tasks",
      "Automatic backups and updates",
      "Email support",
    ],
    cta: { href: APP_URL, label: "Start 14-day free trial" },
  },
  {
    name: "Cloud Team",
    tagline: "Managed hosting for teams",
    checkout: "team",
    monthly: { price: 5, suffix: "/ user / month", note: "Billed monthly" },
    annual: {
      price: 50,
      suffix: "/ user / year",
      note: "$4.17 / user / month, billed yearly",
    },
    features: [
      "Unlimited team members",
      "Unlimited projects and tasks",
      "Workspace roles and permissions",
      "Automatic backups and updates",
      "Priority email support",
    ],
    cta: { href: APP_URL, label: "Start 14-day free trial" },
    highlighted: true,
  },
];

export function PricingPlans() {
  const [interval, setInterval] = useState<Interval>("annual");

  return (
    <div>
      <div className="inline-flex rounded-lg border bg-sidebar p-1 text-sm">
        {(["monthly", "annual"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setInterval(value)}
            aria-pressed={interval === value}
            className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 sm:px-4 ${
              interval === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="capitalize">{value}</span>
            {value === "annual" && (
              <span className="whitespace-nowrap rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                2 months free
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border bg-background">
        <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {plans.map((plan) => {
            const price = interval === "monthly" ? plan.monthly : plan.annual;
            const href = plan.checkout
              ? `${APP_URL}/auth/sign-up?checkout=${plan.checkout}-${interval}`
              : plan.cta.href;
            return (
              <article
                key={plan.name}
                className={`flex min-w-0 flex-col p-6 lg:p-8 ${
                  plan.highlighted ? "bg-sidebar" : "bg-background"
                }`}
              >
                <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium text-base">{plan.name}</h2>
                  {plan.highlighted ? (
                    <span className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-muted-foreground text-sm">
                  {plan.tagline}
                </p>

                <div className="mt-8 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <NumberFlow
                    value={price.price}
                    locales="en-US"
                    format={{
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }}
                    transformTiming={{
                      duration: 250,
                      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
                    }}
                    opacityTiming={{
                      duration: 150,
                      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
                    }}
                    respectMotionPreference
                    className="text-5xl font-medium tracking-tight tabular-nums"
                  />
                  <span className="text-muted-foreground text-sm">
                    {price.suffix}
                  </span>
                </div>
                <p className="mt-1.5 text-muted-foreground text-sm">
                  {price.note}
                </p>

                <ul className="mt-8 flex-1 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      />
                      <span className="text-foreground/90">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.highlighted ? "default" : "outline"}
                  size="lg"
                  className="mt-8 h-12 w-full gap-3 px-4 text-sm sm:h-12"
                  render={<a href={href} />}
                >
                  {plan.cta.label}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
