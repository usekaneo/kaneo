import type { Metadata } from "next";
import { CommunityProjectCard } from "@/components/landing/community-project-card";
import { Footer } from "@/components/landing/footer";
import { breadcrumbJsonLd, JsonLd } from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import { PageIntro } from "@/components/landing/page-intro";
import { SectionSeparator } from "@/components/landing/section-separator";
import { Button } from "@/components/ui/button";
import { communityProjects } from "@/lib/community";
import { withSocialMetadata } from "@/lib/metadata";

export const metadata: Metadata = withSocialMetadata({
  title: "Community projects",
  description:
    "Open-source tools the Kaneo community builds and maintains, from an email-to-task service to a one-command installer for Proxmox VE.",
  alternates: { canonical: "/community" },
});

export default function Page() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Kaneo", path: "/" },
          { name: "Community projects", path: "/community" },
        ])}
      />
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="px-6 pt-14 pb-16 md:pt-20 md:pb-20 lg:pt-24">
          <div className="mx-auto w-full max-w-6xl">
            <PageIntro
              eyebrow="Community"
              title={<>Built by the community</>}
              description="Tools that people build around Kaneo and share in the open. Each one is made and maintained by its authors, not the Kaneo team."
            />

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {communityProjects.map((project) => (
                <CommunityProjectCard key={project.href} project={project} />
              ))}
            </div>
          </div>
        </section>

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto w-full max-w-6xl">
              <h2 className="font-medium text-2xl md:text-3xl">
                Built something with Kaneo?
              </h2>
              <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
                Open an issue on GitHub with a link and a sentence about what it
                does, and we will add it here. Review any project before you
                give it an API key or point it at a production instance.
              </p>
              <div className="mt-8">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-5 text-sm sm:h-12"
                  render={
                    <a
                      href="https://github.com/usekaneo/kaneo/issues/new"
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  Share your project
                </Button>
              </div>
            </div>
          </section>
        </SectionSeparator>
      </main>
      <Footer />
    </>
  );
}
