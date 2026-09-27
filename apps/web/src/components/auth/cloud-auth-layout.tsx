import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type CloudAuthLayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  workspaceName?: string;
  note?: "signUp" | "onboarding" | "invite" | "plan";
  contentClassName?: string;
};

export function CloudAuthLayout({
  children,
  title,
  subtitle,
  workspaceName,
  note = "signUp",
  contentClassName,
}: CloudAuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <main className="grid h-svh w-full overflow-y-auto bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex min-w-0 flex-col px-6 py-6 sm:px-10 lg:px-14 lg:py-8">
        <header>
          <img src="/logo-dark.svg" alt="Kaneo" className="h-6 dark:hidden" />
          <img
            src="/logo-light.svg"
            alt="Kaneo"
            className="hidden h-6 dark:block"
          />
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className={cn("w-full max-w-sm", contentClassName)}>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden min-w-0 flex-col overflow-hidden border-l border-border bg-muted lg:flex"
      >
        <div className="max-w-lg px-12 pt-[12vh]">
          <p className="text-xl font-medium tracking-tight text-foreground">
            {t(`auth:cloud.${note}.title`)}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t(`auth:cloud.${note}.description`)}
          </p>
        </div>
        <div className="relative mt-10 flex-1">
          <div className="@container absolute top-0 left-12 w-[1380px] overflow-hidden rounded-tl-xl border-t border-l border-border shadow-lg">
            <div className="aspect-[3456/2000] bg-[url(/images/auth/board-light.webp)] bg-cover dark:bg-[url(/images/auth/board-dark.webp)]" />
            {workspaceName ? (
              // Cover the "Studio North" labels baked into the screenshot so it
              // reads back the name being typed. Offsets are measured against
              // the 3456×2000 source and scale with the container; backgrounds
              // match the sampled sidebar and header colors.
              <>
                <span className="absolute top-[1.5%] left-[1.15%] flex h-[2.25%] w-[5.9%] items-center bg-[#fafafa] ps-[0.25cqw] text-[0.81cqw] font-medium text-neutral-800 dark:bg-[#111111] dark:text-neutral-100">
                  <span className="truncate">{workspaceName}</span>
                </span>
                <span className="absolute top-[2.25%] left-[17.36%] flex h-[1.75%] w-[4.92%] items-center bg-white ps-[0.2cqw] text-[0.75cqw] font-medium text-neutral-800 dark:bg-[#191919] dark:text-neutral-100">
                  <span className="truncate">{workspaceName}</span>
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
