# BrowserStack dependency hardening

This independent workspace keeps BrowserStack available while protecting its
transitive HTTP clients. Production packages do not consume these dependencies.

## http-cache-semantics 4.3.0

[GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)
lists affected versions through 4.2.0 and no patched version. The official npm
4.3.0 release still permits the reported stale-cookie reuse. A version-only
upgrade therefore does not establish that the behavior is fixed.

The checked-in pnpm patch requires `public` to store shared cookie responses.
Neither `immutable`, `s-maxage`, nor `must-revalidate` enables cookie sharing.
Authorization keeps the library's separate sharing rules. This is a
local hardening policy: RFC 9111 section 7.3 allows caching Set-Cookie responses,
and the upstream maintainer disputes the advisory in
[issue 56](https://github.com/kornelski/http-cache-semantics/issues/56).

The patch checks storage eligibility before reuse, including serialized entries,
and applies response revalidation requirements to `max-stale`,
`stale-while-revalidate`, and `stale-if-error`. It retains fresh responses with
explicit public cookie-sharing permission and private-cache behavior. Revalidation preserves
new response restrictions and cookies from 304 headers; an ineligible or
mismatched response cannot authorize replay of an old body. An invalid 304 now
fails closed and may require an unconditional retry by the caller.

Both installed consumers (got 11/cacheable-request 7 and got 12/cacheable-request
10) receive the same patch. Got disables caching by default, so dependency
presence alone does not establish a reachable shared cache in the BrowserStack
SDK. Tests deliberately enable or exercise cache policies using synthetic data.

Compare future releases against the
[upstream 4.3.0 source](https://github.com/kornelski/http-cache-semantics/blob/b1d4bd682fbab0252985de45219f4e7497c0067c/index.js)
and run `pnpm test:security` before removing or rebasing the patch. Do not remove
it solely because an advisory's version range no longer matches.

## basic-ftp 6.2.3

`get-uri` still declares basic-ftp 5.x, which is affected by the Unix listing
parser denial of service in
[GHSA-c475-qrg2-pj4r](https://github.com/advisories/GHSA-c475-qrg2-pj4r).
The workspace overrides only `get-uri>basic-ftp` to the official 6.2.3 release.
The CommonJS exports and Client methods consumed by get-uri remain available;
the regression test verifies them and processes the pathological listing in a
bounded child process. Remove this override once get-uri requests a fixed
version and the lockfile resolves it without the override.
