import { Button } from "@/components/ui/button";
import { pluginLinks } from "@/lib/plugins";

export function PluginCatalogEmpty() {
  return (
    <div className="rounded-xl border bg-sidebar p-6 md:p-8">
      <h3 className="text-balance font-medium text-xl leading-snug md:text-2xl">
        No community plugins are listed yet
      </h3>
      <p className="mt-2.5 max-w-2xl text-muted-foreground leading-relaxed">
        Build the first one. Start from the task progress example in the plugin
        guide, publish it to npm, and open a pull request that adds it to the
        catalog. Listed plugins show up here.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <Button
          className="h-12 px-5 text-sm sm:h-12"
          render={<a href={pluginLinks.writing} />}
          size="lg"
        >
          Build the first plugin
        </Button>
        <Button
          className="h-12 px-5 text-sm sm:h-12"
          render={<a href={pluginLinks.getListed} />}
          size="lg"
          variant="outline"
        >
          How to get listed
        </Button>
      </div>
    </div>
  );
}
