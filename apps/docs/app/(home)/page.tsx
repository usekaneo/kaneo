import Features from "@/components/features";
import Footer from "@/components/footer";
import Hero from "@/components/hero";
import PersonalStatement from "@/components/personal-statement";
import SectionSeparator from "@/components/section-separator";
import StructuredData from "@/components/structured-data";

export default function HomePage() {
  return (
    <>
      <main className="relative">
        <StructuredData type="organization" />
        <StructuredData type="software" />
        <StructuredData type="faq" />

        <div className="relative">
          <Hero />
        </div>

        <SectionSeparator>
          <Features />
        </SectionSeparator>

        <SectionSeparator>
          <PersonalStatement />
        </SectionSeparator>
      </main>

      <Footer />
    </>
  );
}
