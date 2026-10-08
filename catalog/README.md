# Kaneo plugin catalog

`index.json` lists community plugins for Kaneo. It powers the [plugins page](https://kaneo.app/plugins) on kaneo.app, and `kaneo add` uses it to warn before adding a package that is not listed.

To build a plugin, start with [Writing plugins](https://kaneo.app/docs/core/plugins/writing-plugins).

## What listing means

Listing is a light review, not a security audit. A Kaneo maintainer checks that your entry is well formed, that the package meets the requirements below, and that the repository and description match the package. Nobody reads all of your code, and a listed plugin can change with every release.

Plugins run inside Kaneo with full access, like any npm dependency. Operators should review a plugin before adding it, listed or not.

## Requirements

Your package must:

- Be published on npm and built with `kaneo-plugin build`.
- Include `kaneo-plugin` in `keywords`.
- Declare the Kaneo versions it supports in `engines.kaneo`, as a semver range.
- Export `./server`, `./web`, or both.
- Have no install scripts: no `preinstall`, `install`, or `postinstall`.
- Have a public source repository.

You should also publish it with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), so operators can verify it was built from your repository. A package without provenance can be listed, but the checks report it.

## Get listed

1. Publish your plugin to npm.
2. Fork [usekaneo/kaneo](https://github.com/usekaneo/kaneo) and add your entry to `catalog/index.json`. Keep the list sorted by package name.
3. Run the checks from the repository root. They only need Node.js and npm, so you can skip `pnpm install`:

   ```bash
   node scripts/catalog/check.mjs
   node scripts/catalog/check.mjs --remote
   ```

   The first command checks the file. The second also checks every listed package on npm.

4. Open a pull request titled `feat(catalog): list <package>` that only changes `catalog/index.json`. Open it from the GitHub account of one of the listed maintainers.

A maintainer reviews the entry and merges it. Your plugin shows up on kaneo.app after the next site deploy.

### Entry format

```json
{
  "package": "kaneo-plugin-example",
  "repository": "https://github.com/your-name/kaneo-plugin-example",
  "description": "Adds an example view to every project.",
  "maintainers": ["your-github-username"],
  "kaneo": ">=2.29.0 <3",
  "addedAt": "2026-10-08",
  "homepage": "https://example.com/kaneo-plugin-example"
}
```

| Field | Required | Description |
| --- | --- | --- |
| `package` | Yes | The npm package name, as people pass it to `kaneo add`. |
| `repository` | Yes | The public source repository, as an `https://` URL. |
| `description` | Yes | One line, up to 160 characters, about what the plugin does. |
| `maintainers` | Yes | GitHub usernames of the people responsible for the plugin, without `@`. |
| `kaneo` | Yes | The Kaneo versions the plugin supports, as a semver range. Keep it in line with `engines.kaneo`. |
| `addedAt` | Yes | The date you open the pull request, as `YYYY-MM-DD`. |
| `homepage` | No | A documentation or project page, as an `https://` URL. |

`schema.json` describes the same format for editors.

### Keep your entry current

When a release changes the supported Kaneo versions or what the plugin does, open a pull request that updates `kaneo` or `description`. To add or remove maintainers, open one from an account that is already listed.

## Report a problem plugin

- **Security issue in a plugin:** report it privately to the plugin's maintainers first. If the plugin looks malicious, or the maintainers do not respond, report it to Kaneo through [private vulnerability reporting](https://github.com/usekaneo/kaneo/security/advisories/new) or at [andrej@kaneo.app](mailto:andrej@kaneo.app). Do not open a public issue.
- **Anything else**, such as a broken plugin, a wrong description, or an abandoned package: [open an issue](https://github.com/usekaneo/kaneo/issues/new) that names the package.

## Removal

A plugin is removed from the list when:

- Its maintainers ask for it, in a pull request that deletes the entry.
- It is malicious, or it has a security issue its maintainers do not fix. Malicious plugins are removed right away, without notice.
- It is deprecated or unpublished on npm, or it no longer meets the requirements above and is not fixed after an issue is opened.
- It has not supported a current Kaneo release for a long time and nobody responds to an issue about it.

Removing an entry does not uninstall the plugin from instances that already use it. `kaneo add` treats it as unlisted from then on.
