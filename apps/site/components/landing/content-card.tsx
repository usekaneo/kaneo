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
        "group flex flex-col rounded-xl border border-border/70 bg-card/70 p-5 transition-colors hover:border-border hover:bg-accent/40",
        featured && "gap-2 p-6 md:p-8",
      )}
      href={href}
    >
      {meta?.length ? (
        <div className="flex flex-wrap items-center gap-2 text-foreground/50 text-xs">
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
          meta?.length ? "mt-2" : "",
          featured
            ? "max-w-3xl text-2xl md:text-[2rem] md:leading-[1.15]"
            : "text-base",
        )}
      >
        {title}
      </h3>

      <p
        className={cn(
          "mt-2 text-foreground/70 leading-relaxed",
          featured ? "max-w-2xl text-base md:text-lg" : "line-clamp-3 text-sm",
        )}
      >
        {body}
      </p>

      {footer ? (
        <div
          className={cn(
            "flex items-center gap-2.5 text-foreground/60 text-xs",
            featured ? "mt-6" : "mt-5 pt-1",
          )}
        >
          {footer}
        </div>
      ) : null}
    </a>
  );
}
