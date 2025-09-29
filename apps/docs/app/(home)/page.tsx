import Hero from "@/components/hero";
import StructuredData from "@/components/structured-data";

export default function HomePage() {
  return (
    <main>
      <StructuredData type="organization" />
      <StructuredData type="software" />
      <StructuredData type="faq" />
      <Hero />
    </main>
  );
}
