import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { breadcrumbJsonLd, JsonLd } from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import { PageIntro } from "@/components/landing/page-intro";
import { PluginCard } from "@/components/landing/plugin-card";
import { PluginCatalogEmpty } from "@/components/landing/plugin-catalog-empty";
import { SectionSeparator } from "@/components/landing/section-separator";
import { Button } from "@/components/ui/button";
import { withSocialMetadata } from "@/lib/metadata";
import { catalogPlugins, pluginLinks } from "@/lib/plugins";

export const metadata: Metadata = withSocialMetadata({
  title: "Plugins",
  description:
    "Community plugins for self-hosted Kaneo. Add views, task panels, pages, and commands to your instance, or build a plugin and get it listed.",
  alternates: { canonical: "/plugins" },
});

const notes = [
  {
    title: "Turned on per workspace",
    body: "Operators add plugins to their instance in one config file. Each workspace then decides which ones to turn on, and plugins stay off until it does.",
  },
  {
    title: "Report a problem",
    body: "Report a security issue privately, never in a public issue. For anything else, open an issue on GitHub that names the package. Details are in the",
    link: {
      href: `${pluginLinks.getListed}#report-a-problem-plugin`,
      label: "catalog guide",
    },
  },
  {
    title: "Removal",
    body: "A plugin leaves the list when its maintainers ask, when it stops meeting the requirements, or right away if it is malicious. Instances that already use it keep it installed.",
  },
];

export default function PluginsPage() {
  const hasPlugins = catalogPlugins.length > 0;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Kaneo", path: "/" },
          { name: "Plugins", path: "/plugins" },
        ])}
      />
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="px-6 pt-14 pb-12 md:pt-20 md:pb-16 lg:pt-24">
          <div className="mx-auto w-full max-w-6xl">
            <PageIntro
              eyebrow="Plugins"
              title={<>Extend Kaneo with plugins</>}
              description="Plugins are npm packages that add views, task panels, pages, and commands to Kaneo, react to task activity, and store their own data. Kaneo's own Gantt view is a built-in plugin, built on the same contract as community plugins."
            >
              <div className="mt-8 flex flex-wrap items-center gap-2.5">
                <Button
                  className="h-12 px-5 text-sm sm:h-12"
                  render={<a href={pluginLinks.docs} />}
                  size="lg"
                >
                  Read the plugin docs
                </Button>
                <Button
                  className="h-12 px-5 text-sm sm:h-12"
                  render={<a href={pluginLinks.writing} />}
                  size="lg"
                  variant="outline"
                >
                  Write a plugin
                </Button>
              </div>
            </PageIntro>
          </div>
        </section>

        <SectionSeparator>
          <section
            aria-labelledby="community-plugins"
            className="px-6 py-12 md:py-16"
          >
            <div className="mx-auto w-full max-w-6xl">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h2
                  className="font-medium text-2xl md:text-3xl"
                  id="community-plugins"
                >
                  Community plugins
                </h2>
                {hasPlugins ? (
                  <a
                    className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                    href={pluginLinks.getListed}
                  >
                    Get your plugin listed
                  </a>
                ) : null}
              </div>
              <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
                Listing is a light review, not a security audit. A Kaneo
                maintainer checks each entry and its npm package, not every line
                of code. Plugins run inside Kaneo with full access, so review a
                plugin before you add it.
              </p>

              <div className="mt-8">
                {hasPlugins ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {catalogPlugins.map((plugin) => (
                      <PluginCard key={plugin.package} plugin={plugin} />
                    ))}
                  </div>
                ) : (
                  <PluginCatalogEmpty />
                )}
              </div>
            </div>
          </section>
        </SectionSeparator>

        <SectionSeparator>
          <section className="px-6 py-12 md:py-16">
            <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-3">
              {notes.map((note) => (
                <div key={note.title} className="space-y-2">
                  <h3 className="font-medium text-sm">{note.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {note.body}
                    {note.link ? (
                      <>
                        {" "}
                        <a
                          className="text-foreground underline underline-offset-4 hover:no-underline"
                          href={note.link.href}
                        >
                          {note.link.label}
                        </a>
                        .
                      </>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </SectionSeparator>
      </main>
      <Footer />
    </>
  );
}
