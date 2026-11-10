# Public branding

This fork keeps upstream package names and compatibility identifiers. Product copy
uses `@kaneo/branding`; translation **values** are adapted when loaded, while their
keys remain upstream-compatible. Do not pass user content to `brandText`.

The product is `quills`. The app is hosted at `https://quills.playbookmedia.io`
(client URL) and the marketing site at `https://quills-site.playbookmedia.io`
(public URL), on separate origins like upstream. Its name, public URL and client
URL are set in `config.json`, alongside the other public destinations. Release
still requires fork-owned image and registry identifiers
and approved artwork.
Destination mappings live in `index.cjs`; review new
upstream links instead of inventing replacements for them.

Run from the repository root:

```sh
pnpm branding:test
pnpm branding:check
pnpm branding:release
node scripts/branding/check.mjs --output apps/web/dist
node scripts/branding/check.mjs --output apps/site/out
node scripts/branding/prepare.mjs docs
```

The docs command writes `.cache/branded-docs`. Use that directory as the docs
publication source; the original `apps/docs` directory retains upstream text.
The site loader adapts application-owned static copy before compilation. The blog
loader adapts checked-in article content, never submitted user content.

`branding:check` scans the complete tracked and new non-ignored app/package trees,
not just a diff. It detects names, requested spelling variants, domains, accessible
copy and metadata. It parses source so an allowed package import cannot hide text
elsewhere on the same line. Exit codes: `0` clean, `1` findings, `2` incomplete check
or invalid release configuration. Never use `|| true` for this check.

Compatibility exceptions in `technical-references.json` match a file and exact
literal value, with a reason. They do not exempt an entire line or directory.
Unused exceptions fail the source check. Review exceptions as code; public copy
must not be added to this list merely to make CI pass.
Upstream license credits use exact, file-scoped exceptions so the credited
component keeps its original identity. These credits do not permit product branding.

## Assets

`asset-review.json` records hashes of public images, icons, screenshots and videos.
All initial entries require human visual review. A hash does not establish that an
image has no upstream logo. New/changed files fail validation until reviewed.

Put approved replacements under this directory and add entries to `config.json`:

```json
{
  "source": "assets/favicon.svg",
  "target": "apps/web/public/favicon.svg",
  "sha256": "SHA256_OF_APPROVED_FILE",
  "approved": true
}
```

Packaging copies the approved file over the corresponding emitted public file;
the upstream source asset remains untouched. Review all themes, favicons, mobile
icons/splash images, social cards and screenshots. The web logo component uses
approved artwork in both themes. Vite serves an isolated public-directory overlay
in development and builds, so upstream source artwork stays untouched. Production
native configuration materializes approved replacements and remaps icon, splash
and notification asset paths before building.

## Upstream updates

Keep upstream synchronization separate from branding changes. After every merge,
run the full gate, inspect new links and asset hashes, and check the web HTML hook,
translation loaders, email defaults, Next loader and public packaging step. Keep
existing API fields, editor formats, environment variables, CLI commands, mobile
application IDs and storage keys compatible.

Publish npm packages from the generated `.cache/npm/<package>` directory. Build
the package, run `branding:release`, then run
`node scripts/branding/prepare-package.mjs packages/<package>` from the root.
Direct publication from a workspace package is blocked because its source
manifest and README retain upstream text for merges. The staged package contains
the configured public scope and metadata and has no private branding dependency.

Release workflows, direct Docker builds and production native config evaluation
reject placeholder configuration. The PR branding job also reports remaining
copy and asset findings. A repository status check must be made required in GitHub
branch protection by an administrator; committing a workflow does not set that
repository setting.

A new logo master needs user approval and a new approval pin. Exports of the
pinned master carry its approval; retained screenshots and other artwork need
individual review. Release remains blocked until configuration, public copy,
technical-reference review and asset approvals pass together.

## Existing product identity boundaries

The identity work is tracked in [M0](https://github.com/PlaybookMediaLLC/kaneo/issues/6) and [M6](https://github.com/PlaybookMediaLLC/kaneo/issues/12). The product name is `quills`, with the approved Q/quill logo and neutral light/dark colorways.

Do not copy UserJot assets, imply affiliation with Orchestrator, delete upstream attributions, or bundle proprietary third-party fonts/logos. The official Orchestrator desktop is **not** being modified or rebranded.

See [attribution](../docs/attribution.md). The approved logo master is saved at
[assets/quills-logo-v1.png](assets/quills-logo-v1.png), with its
[generation prompt](assets/quills-logo-v1.prompt.md). The complete derived kit is
in [assets/quills](assets/quills/README.md), with light/dark SVG and PNG logos,
favicons, install icons, email mark, native exports, a preview page and ZIP archive.
These replacements have approved hashes in `config.json`. Unrelated screenshots
and illustrations still require their own review.
