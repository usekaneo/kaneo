import Community from "@/components/community";
import Features from "@/components/features";
import Footer from "@/components/footer";
import Hero from "@/components/hero";
import Stats from "@/components/stats";
import StructuredData from "@/components/structured-data";

export default function HomePage() {
  return (
    <main>
      <StructuredData type="organization" />
      <StructuredData type="software" />
      <StructuredData type="faq" />
      <Hero />
      <Stats />
      <Features />
      <Community />
      <Footer />
    </main>
  );
}
