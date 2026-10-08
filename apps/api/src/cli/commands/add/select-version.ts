import semver from "semver";

export type PackageRelease = {
  version: string;
  engines?: unknown;
  deprecated?: unknown;
};

export type VersionChoice =
  | { status: "ok"; version: string; range: string }
  | { status: "no-stable" }
  | { status: "all-deprecated"; newest: string }
  | { status: "no-engines"; newest: string }
  | { status: "incompatible"; newest: string; range: string };

function kaneoRange(engines: unknown): string | null {
  if (typeof engines !== "object" || engines === null) return null;
  const range = (engines as { kaneo?: unknown }).kaneo;
  return typeof range === "string" && range.trim() ? range.trim() : null;
}

function isDeprecated(release: PackageRelease): boolean {
  return (
    release.deprecated === true ||
    (typeof release.deprecated === "string" && release.deprecated.length > 0)
  );
}

function supports(range: string, kaneoVersion: string): boolean {
  return (
    semver.validRange(range) !== null &&
    semver.satisfies(kaneoVersion, range, { includePrerelease: true })
  );
}

export function selectVersion(
  releases: readonly PackageRelease[],
  kaneoVersion: string,
): VersionChoice {
  const stable = releases
    .filter(
      (release) =>
        semver.valid(release.version) !== null &&
        semver.prerelease(release.version) === null,
    )
    .sort((a, b) => semver.rcompare(a.version, b.version));
  const [newestStable] = stable;
  if (!newestStable) return { status: "no-stable" };

  const active = stable.filter((release) => !isDeprecated(release));
  const [newestActive] = active;
  if (!newestActive) {
    return { status: "all-deprecated", newest: newestStable.version };
  }

  const declared = active.flatMap((release) => {
    const range = kaneoRange(release.engines);
    return range ? [{ version: release.version, range }] : [];
  });
  const [newestDeclared] = declared;
  if (!newestDeclared) {
    return { status: "no-engines", newest: newestActive.version };
  }

  const match = declared.find((release) =>
    supports(release.range, kaneoVersion),
  );
  if (match) return { status: "ok", ...match };
  return {
    status: "incompatible",
    newest: newestDeclared.version,
    range: newestDeclared.range,
  };
}
