import Community from "@/components/community";
import Features from "@/components/features";
import Footer from "@/components/footer";
import Hero from "@/components/hero";
import Stats from "@/components/stats";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kaneo",
  description:
    "An open source project management platform focused on simplicity and efficiency.",
};

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Stats />
      <Features />
      <Community />
      <Footer />
    </main>
  );
}
