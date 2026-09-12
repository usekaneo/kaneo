import type { BlogAuthor } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function BlogAvatar({
  author,
  className,
}: {
  author: BlogAuthor;
  className?: string;
}) {
  if (author.avatar) {
    return (
      <img
        alt=""
        className={cn("size-8 shrink-0 rounded-full object-cover", className)}
        src={author.avatar}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-[0.625rem] text-muted-foreground",
        className,
      )}
    >
      {initials(author.name)}
    </span>
  );
}

export function BlogByline({
  author,
  meta,
}: {
  author: BlogAuthor;
  meta?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <BlogAvatar author={author} />
      <div className="min-w-0 text-sm">
        <p className="font-medium leading-tight">{author.name}</p>
        <p className="truncate text-foreground/50 text-xs leading-tight">
          {meta ?? author.role}
        </p>
      </div>
    </div>
  );
}
