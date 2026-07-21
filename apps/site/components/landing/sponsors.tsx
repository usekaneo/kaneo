import { FadeIn } from "@/components/landing/fade-in";
import sponsors from "@/constants/sponsors.json";
import { cn } from "@/lib/utils";

type Sponsor = {
  login: string;
  name: string | null;
  avatarUrl: string;
  tier: number | null;
};

const founding = sponsors.founding as Sponsor[];
const current = sponsors.current as Sponsor[];
const past = sponsors.past as Sponsor[];

const featured = [...founding, ...current];
const featuredLabel =
  current.length > 0 ? "Founding and current sponsors" : "Founding sponsor";

// Higher sponsorship tiers get larger placement, matching the tier rewards on
// GitHub Sponsors.
function avatarSize(tier: number | null) {
  if (tier == null) return "size-12";
  if (tier >= 250) return "size-20";
  if (tier >= 100) return "size-16";
  if (tier >= 15) return "size-14";
  return "size-12";
}

export function Sponsors() {
  return (
    <section id="sponsors" className="px-6 py-16 md:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <FadeIn>
          <h2 className="text-3xl font-semibold md:text-4xl">Sponsors</h2>
        </FadeIn>
        <FadeIn delay={80}>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Kaneo is{" "}
            <strong className="font-medium text-foreground">
              free and open source
            </strong>
            , and it stays independent because the people who use it fund it.
            Sponsorship pays for the development time behind every release, from
            new features to the unglamorous fixes that keep self-hosted
            instances running. If it saves your team time, you can{" "}
            <a
              className="font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:decoration-foreground"
              href="https://github.com/sponsors/andrejsshell"
              target="_blank"
              rel="noreferrer"
            >
              sponsor Kaneo
            </a>
            .
          </p>
        </FadeIn>
        <FadeIn delay={160}>
          <div className="mt-12">
            <p className="font-medium text-muted-foreground text-sm">
              {featuredLabel}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-10 gap-y-5">
              {featured.map((sponsor) => (
                <a
                  key={sponsor.login}
                  className="flex items-center gap-3"
                  href={`https://github.com/${sponsor.login}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    alt=""
                    className={cn(
                      "rounded-full border border-border/70",
                      avatarSize(sponsor.tier),
                    )}
                    src={sponsor.avatarUrl}
                    loading="lazy"
                  />
                  <span>
                    <span className="block font-medium text-base">
                      {sponsor.name ?? sponsor.login}
                    </span>
                    <span className="block text-muted-foreground text-sm">
                      @{sponsor.login}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </div>
          {past.length > 0 && (
            <div className="mt-10">
              <p className="font-medium text-muted-foreground text-sm">
                Past sponsors
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {past.map((sponsor) => (
                  <a
                    key={sponsor.login}
                    className="rounded-full"
                    href={`https://github.com/${sponsor.login}`}
                    target="_blank"
                    rel="noreferrer"
                    title={sponsor.name ?? `@${sponsor.login}`}
                  >
                    <img
                      alt={sponsor.name ?? sponsor.login}
                      className="size-10 rounded-full border border-border/70 opacity-80 transition-opacity hover:opacity-100"
                      src={sponsor.avatarUrl}
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </FadeIn>
      </div>
    </section>
  );
}
