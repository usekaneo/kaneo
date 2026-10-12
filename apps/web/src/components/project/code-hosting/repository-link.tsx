import { ArrowUpRightIcon } from "lucide-react";

type RepositoryLinkProps = {
  name: string;
  href: string | null;
  label?: string;
};

export function RepositoryLink({ name, href, label }: RepositoryLinkProps) {
  if (!href) {
    return <span className="truncate font-mono text-[13px]">{name}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[13px] hover:underline"
    >
      <span className="truncate">{name}</span>
      <ArrowUpRightIcon
        aria-hidden="true"
        className="size-3 shrink-0 text-muted-foreground"
      />
    </a>
  );
}
