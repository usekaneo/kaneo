import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OnboardingProgress } from "./onboarding-progress";

type OnboardingShellProps = {
  stepKey: string;
  progress: { current: number; total: number } | null;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  email?: string;
  opening: boolean;
  onSignOut: () => void;
  preview: ReactNode;
  children: ReactNode;
};

export function OnboardingShell({
  stepKey,
  progress,
  eyebrow,
  title,
  description,
  email,
  opening,
  onSignOut,
  preview,
  children,
}: OnboardingShellProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const offset = reduceMotion ? 0 : 12;

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      <motion.div
        animate={{ opacity: opening ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className="flex h-full w-full shrink-0 flex-col overflow-y-auto px-6 py-8 sm:px-16 lg:w-[600px]"
      >
        <header className="flex items-center justify-between gap-4">
          <img
            src="/favicon.svg"
            alt=""
            className="size-8 rounded-lg border border-border"
          />
          {progress ? (
            <OnboardingProgress
              current={progress.current}
              total={progress.total}
            />
          ) : null}
        </header>
        <div className="flex flex-1 flex-col justify-center py-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stepKey}
              initial={{ opacity: 0, y: offset }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -offset }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-[400px]"
            >
              <div className="flex flex-col gap-2 pb-8">
                {eyebrow ? (
                  <p className="font-medium text-[13px] text-muted-foreground">
                    {eyebrow}
                  </p>
                ) : null}
                <h1 className="font-semibold text-[30px] text-foreground leading-9 tracking-[-0.025em]">
                  {title}
                </h1>
                {description ? (
                  <p className="text-muted-foreground text-sm">{description}</p>
                ) : null}
              </div>
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
        {email ? (
          <footer className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
            <span>{t("auth:onboarding.signedInAs", { email })}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onSignOut}
              className="cursor-pointer underline underline-offset-[3px] transition-colors hover:text-foreground"
            >
              {t("auth:onboarding.signOut")}
            </button>
          </footer>
        ) : null}
      </motion.div>
      {preview}
    </div>
  );
}
