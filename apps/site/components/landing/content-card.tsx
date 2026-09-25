import { ArrowUpRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The shared card used across the blog, guides, and comparison indexes so the
 * three content hubs read as one system rather than three sets of defaults.
 */
export function ContentCard({
  href,
  meta,
  title,
  body,
  footer,
  featured = false,
}: {
  href: string;
  meta?: ReactNode[];
  title: ReactNode;
  body: ReactNode;
  footer?: ReactNode;
  featured?: boolean;
}) {
  return (
    <a
      className={cn(
        "group relative flex flex-col border-t py-7 pr-8 transition-colors hover:border-foreground/30 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4",
        featured &&
          "gap-2 rounded-xl border bg-sidebar p-6 pr-12 md:p-10 md:pr-16",
      )}
      href={href}
    >
      <ArrowUpRight
        aria-hidden="true"
        className={cn(
          "absolute right-0 top-7 size-4 text-muted-foreground group-hover:text-foreground",
          featured && "right-6 top-6 md:right-10 md:top-10",
        )}
      />
      {meta?.length ? (
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          {meta.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: meta entries are a fixed, ordered list per card.
            <Fragment key={index}>
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              <span>{item}</span>
            </Fragment>
          ))}
        </div>
      ) : null}

      <h3
        className={cn(
          "text-balance font-medium leading-snug transition-colors group-hover:text-primary",
          meta?.length ? "mt-4" : "",
          featured
            ? "max-w-3xl text-2xl md:text-[2rem] md:leading-[1.15]"
            : "text-lg",
        )}
      >
        {title}
      </h3>

      <p
        className={cn(
          "mt-3 text-muted-foreground leading-relaxed",
          featured ? "max-w-2xl text-base md:text-lg" : "line-clamp-3 text-sm",
        )}
      >
        {body}
      </p>

      {footer ? (
        <div
          className={cn(
            "flex items-center gap-2.5 text-muted-foreground text-xs",
            featured ? "mt-6" : "mt-5 pt-1",
          )}
        >
          {footer}
        </div>
      ) : null}
    </a>
  );
}
