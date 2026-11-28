import { ArrowUpRight } from "lucide-react";
import { Fragment } from "react";
import { InstallCommand } from "@/components/landing/install-command";
import { formatBlogDateShort } from "@/lib/blog/format";
import type { CatalogPlugin } from "@/lib/plugins";

const linkClass =
  "inline-flex items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4";

export function PluginCard({ plugin }: { plugin: CatalogPlugin }) {
  return (
    <article className="flex flex-col rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
        <span>Kaneo {plugin.kaneo}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={plugin.addedAt}>
          Listed {formatBlogDateShort(plugin.addedAt)}
        </time>
      </div>

      <h3 className="mt-4 break-words font-medium text-lg leading-snug">
        {plugin.package}
      </h3>
      <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
        {plugin.description}
      </p>
      <p className="mt-4 text-muted-foreground text-xs">
        By{" "}
        {plugin.maintainers.map((maintainer, index) => (
          <Fragment key={maintainer}>
            {index > 0 ? ", " : null}
            <a
              className="text-foreground underline decoration-border underline-offset-4 hover:decoration-current"
              href={`https://github.com/${maintainer}`}
              rel="noreferrer"
              target="_blank"
            >
              @{maintainer}
            </a>
          </Fragment>
        ))}
      </p>

      <div className="mt-auto pt-6">
        <InstallCommand packageName={plugin.package} />
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <a
            className={linkClass}
            href={plugin.repository}
            rel="noreferrer"
            target="_blank"
          >
            Source
            <span className="sr-only"> for {plugin.package}</span>
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
          {plugin.homepage ? (
            <a
              className={linkClass}
              href={plugin.homepage}
              rel="noreferrer"
              target="_blank"
            >
              Website
              <span className="sr-only"> for {plugin.package}</span>
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
          <a
            className={linkClass}
            href={`https://www.npmjs.com/package/${plugin.package}`}
            rel="noreferrer"
            target="_blank"
          >
            npm
            <span className="sr-only"> for {plugin.package}</span>
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}
