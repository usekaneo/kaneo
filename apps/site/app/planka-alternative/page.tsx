import type { Metadata } from "next";
import { ComparisonPage } from "@/components/landing/comparison-page";
import { comparisons } from "@/lib/comparisons";

export const metadata: Metadata = {
  title: "PLANKA alternative with free SSO",
  description:
    "PLANKA moved SSO to its paid Pro tier. Kaneo is an MIT-licensed, self-hostable project management tool with SSO included for free, and a one-command importer for your PLANKA boards.",
  alternates: { canonical: "/planka-alternative" },
};

export default function Page() {
  return <ComparisonPage data={comparisons.planka} />;
}
