"use client";

import { Check } from "lucide-react";
import { useState } from "react";

const APP_URL = "https://cloud.kaneo.app";

type Interval = "monthly" | "annual";

type Plan = {
  name: string;
  tagline: string;
  checkout?: "personal" | "team";
  monthly: { price: string; suffix: string; note: string };
  annual: { price: string; suffix: string; note: string };
  features: string[];
  cta: { href: string; label: string };
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Self-hosted",
    tagline: "Run it on your own servers",
    monthly: { price: "$0", suffix: "forever", note: "MIT licensed" },
    annual: { price: "$0", suffix: "forever", note: "MIT licensed" },
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
    monthly: { price: "$4", suffix: "/ month", note: "Billed monthly" },
    annual: {
      price: "$40",
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
    monthly: { price: "$5", suffix: "/ user / month", note: "Billed monthly" },
    annual: {
      price: "$50",
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
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex rounded-lg border border-border/70 bg-card/70 p-0.5 text-sm">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setInterval(value)}
              className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
                interval === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        {interval === "annual" ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
            2 months free
          </span>
        ) : null}
      </div>

      <div className="mt-8 rounded-2xl border border-border/70 bg-card/70 p-2">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = interval === "monthly" ? plan.monthly : plan.annual;
            const href = plan.checkout
              ? `${APP_URL}/auth/sign-up?checkout=${plan.checkout}-${interval}`
              : plan.cta.href;
            return (
              <article
                key={plan.name}
                className={`flex flex-col rounded-xl border p-6 lg:p-8 ${
                  plan.highlighted
                    ? "border-primary/40 bg-card shadow-[0_0_40px_-12px] shadow-primary/20"
                    : "border-border/70 bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-sm">{plan.name}</h2>
                  {plan.highlighted ? (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-foreground/60 text-sm">
                  {plan.tagline}
                </p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-medium tracking-tight">
                    {price.price}
                  </span>
                  <span className="text-foreground/60 text-sm">
                    {price.suffix}
                  </span>
                </div>
                <p className="mt-1.5 text-foreground/60 text-sm">
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

                <a
                  className={`mt-8 inline-flex h-10 items-center justify-center rounded-lg border px-4 font-medium text-sm transition-colors ${
                    plan.highlighted
                      ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-border bg-transparent hover:bg-accent"
                  }`}
                  href={href}
                >
                  {plan.cta.label}
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
