import type { Metadata } from "next";
import { ComparisonPage } from "@/components/landing/comparison-page";
import { comparisons } from "@/lib/comparisons";

export const metadata: Metadata = {
  title: "Open-source Linear alternative",
  description:
    "Kaneo is an open-source, self-hostable project management tool, a simple Linear alternative you can run yourself or use as a managed cloud. Free to self-host, fair cloud pricing.",
  alternates: { canonical: "/linear-alternative" },
};

export default function Page() {
  return <ComparisonPage data={comparisons.linear} />;
}
