import { Logo } from "../common/logo";

type AuthLayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
};

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-linear-to-b from-zinc-100 to-white dark:from-zinc-900 dark:to-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Logo className="mx-auto mb-6 w-full flex items-end justify-center" />

        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-6 shadow-xl shadow-zinc-200/20 dark:shadow-zinc-950/20">
          <h1 className="text-lg font-bold text-foreground dark:text-foreground mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              {subtitle}
            </p>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
