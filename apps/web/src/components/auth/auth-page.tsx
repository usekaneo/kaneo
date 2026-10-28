import type { ReactNode } from "react";
import { AuthLegalFooter } from "./auth-legal-footer";

type AuthPageProps = {
  title: string;
  description?: ReactNode;
  notice?: ReactNode;
  children?: ReactNode;
};

export function AuthPage({
  title,
  description,
  notice,
  children,
}: AuthPageProps) {
  return (
    <main className="h-svh w-full overflow-y-auto bg-background">
      <div className="flex min-h-full flex-col items-center">
        <div className="flex w-full grow flex-col items-center justify-center px-4 py-12 sm:px-6">
          <div className="flex w-full max-w-[360px] flex-col">
            <div className="flex flex-col gap-5 pb-8">
              <img
                src="/favicon.svg"
                alt=""
                className="size-10 shrink-0 rounded-lg border border-border"
              />
              <div className="flex flex-col gap-1.5">
                <h1 className="font-semibold text-[22px] text-foreground leading-7 tracking-[-0.02em]">
                  {title}
                </h1>
                {description ? (
                  <p className="text-muted-foreground text-sm">{description}</p>
                ) : null}
              </div>
              {notice}
            </div>
            {children}
          </div>
        </div>
        <AuthLegalFooter />
      </div>
    </main>
  );
}
