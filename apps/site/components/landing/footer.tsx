import { Logo } from "@/components/landing/logo";

export function Footer() {
  return (
    <footer className="border-t border-border/30 bg-sidebar/70 px-6 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="space-y-4 md:col-span-2">
            <a href="/" aria-label="Kaneo home" className="inline-flex">
              <Logo />
            </a>
            <p className="max-w-sm text-balance text-muted-foreground text-sm">
              All you need. Nothing you don&apos;t.
            </p>
          </div>

          <div className="col-span-3 grid gap-6 sm:grid-cols-3">
            <div className="space-y-3 text-sm">
              <p className="font-medium">Product</p>
              <a
                className="block text-muted-foreground transition-colors hover:text-foreground"
                href="https://cloud.kaneo.app"
              >
                Open Cloud
              </a>
              <a
                className="block text-muted-foreground transition-colors hover:text-foreground"
                href="/docs/core"
              >
                Getting Started
              </a>
              <a
                className="block text-muted-foreground transition-colors hover:text-foreground"
                href="#features"
              >
                Features
              </a>
            </div>

            <div className="space-y-3 text-sm">
              <p className="font-medium">Resources</p>
              <a
                className="block text-muted-foreground transition-colors hover:text-foreground"
                href="https://github.com/usekaneo/kaneo"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <a
                className="block text-muted-foreground transition-colors hover:text-foreground"
                href="https://github.com/usekaneo/kaneo/blob/main/LICENSE"
                target="_blank"
                rel="noreferrer"
              >
                License
              </a>
              <a
                className="block text-muted-foreground transition-colors hover:text-foreground"
                href="https://github.com/usekaneo/kaneo/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noreferrer"
              >
                Contributing
              </a>
            </div>

            <div className="space-y-3 text-sm">
              <p className="font-medium">Community</p>
              <a
                className="block text-muted-foreground transition-colors hover:text-foreground"
                href="https://discord.com/invite/rU4tSyhXXU"
                target="_blank"
                rel="noreferrer"
              >
                Discord
              </a>
              <a
                className="block text-muted-foreground transition-colors hover:text-foreground"
                href="https://github.com/sponsors/andrejsshell"
                target="_blank"
                rel="noreferrer"
              >
                Sponsor
              </a>
              <a
                className="block text-muted-foreground transition-colors hover:text-foreground"
                href="/docs"
              >
                Documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
