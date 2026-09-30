import Image from "next/image";
import { FadeIn } from "@/components/landing/fade-in";
import sponsors from "@/constants/sponsors.json";
import { landing } from "@/lib/landing";
import { cn } from "@/lib/utils";

type Sponsor = {
  login: string;
  name: string | null;
  avatarUrl: string;
  tier: number | null;
  founding: boolean;
};

const current = sponsors.current as Sponsor[];
const past = sponsors.past as Sponsor[];

// Higher sponsorship tiers get larger placement, matching the tier rewards on
// GitHub Sponsors.
function avatarSize(tier: number | null) {
  if (tier == null) return "size-24 md:size-28";
  if (tier >= 250) return "size-36 md:size-40";
  if (tier >= 100) return "size-32 md:size-36";
  if (tier >= 15) return "size-28 md:size-32";
  return "size-24 md:size-28";
}

export function Sponsors() {
  return (
    <section id="sponsors" className="px-6 py-20 md:py-28">
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
          <a
            href="https://www.blacksmith.sh/"
            target="_blank"
            rel="noreferrer"
            className="mt-10 inline-flex max-w-full flex-col items-start gap-4 rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
          >
            <span className="text-base">{landing.sponsors.ciSponsor}</span>
            <Image
              src="/images/blacksmith-powered.png"
              alt="CI powered by Blacksmith"
              width={736}
              height={252}
              sizes="(max-width: 448px) calc(100vw - 48px), 400px"
              className="h-auto w-100 max-w-full rounded-lg"
            />
          </a>
          {current.length > 0 && (
            <div className="mt-12">
              <p className="font-medium text-muted-foreground text-sm">
                Current sponsors
              </p>
              <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
                {current.map((sponsor) => (
                  <a
                    key={sponsor.login}
                    className="group flex min-w-0 flex-col items-center gap-4 rounded-lg text-center focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-8"
                    href={`https://github.com/${sponsor.login}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="flex h-36 items-center justify-center md:h-40">
                      <img
                        alt=""
                        className={cn(
                          "shrink-0 rounded-full border border-border/70",
                          avatarSize(sponsor.tier),
                        )}
                        src={sponsor.avatarUrl}
                        loading="lazy"
                      />
                    </span>
                    <span className="w-full break-words">
                      <span className="block font-semibold text-lg transition-colors group-hover:text-primary md:text-xl">
                        {sponsor.name ?? sponsor.login}
                      </span>
                      <span className="mt-1 block text-muted-foreground text-sm">
                        {sponsor.founding
                          ? "Founding sponsor"
                          : `@${sponsor.login}`}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div className="mt-14">
              <p className="font-medium text-muted-foreground text-sm">
                Past sponsors
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                {past.map((sponsor) => (
                  <a
                    key={sponsor.login}
                    className="rounded-full focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
                    href={`https://github.com/${sponsor.login}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`${sponsor.name ?? `@${sponsor.login}`}${
                      sponsor.founding ? " · Founding sponsor" : ""
                    }`}
                  >
                    <img
                      alt={sponsor.name ?? sponsor.login}
                      className="size-16 rounded-full border border-border/70 opacity-80 transition-opacity hover:opacity-100 md:size-20"
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
