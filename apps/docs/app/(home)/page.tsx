import Community from "@/components/community";
import Features from "@/components/features";
import Footer from "@/components/footer";
import Hero from "@/components/hero";
import Stats from "@/components/stats";

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
