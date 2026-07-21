// Syncs the public GitHub sponsors of andrejsshell into constants/sponsors.json,
// which drives the Sponsors section on the landing page.
//
// Only sponsorships GitHub reports as PUBLIC are written; private sponsors are
// never included. Founding sponsors are pinned permanently and stay listed even
// if their sponsorship ends.
//
// Usage: GITHUB_TOKEN=<token with the read:user scope> node scripts/sync-sponsors.mjs

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAINTAINER = "andrejsshell";

const FOUNDING = [
  {
    login: "danielsada",
    name: "Daniel Sada",
    avatarUrl: "https://avatars.githubusercontent.com/u/2849006?v=4",
    tier: null,
  },
];

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
if (!token) {
  console.error(
    "Set GITHUB_TOKEN to a token with the read:user scope before running.",
  );
  process.exit(1);
}

const query = `
  query ($cursor: String) {
    user(login: "${MAINTAINER}") {
      sponsorshipsAsMaintainer(
        first: 100
        after: $cursor
        includePrivate: false
        activeOnly: false
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          isActive
          privacyLevel
          tier {
            monthlyPriceInDollars
          }
          sponsorEntity {
            ... on User {
              login
              name
              databaseId
            }
            ... on Organization {
              login
              name
              databaseId
            }
          }
        }
      }
    }
  }
`;

async function fetchSponsorships() {
  const nodes = [];
  let cursor = null;
  do {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    });
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }
    const connection = payload.data.user.sponsorshipsAsMaintainer;
    nodes.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (cursor);
  return nodes;
}

function toEntry(node) {
  const { login, name, databaseId } = node.sponsorEntity;
  return {
    login,
    name: name ?? null,
    avatarUrl: `https://avatars.githubusercontent.com/u/${databaseId}?v=4`,
    tier: node.tier?.monthlyPriceInDollars ?? null,
  };
}

const byLogin = (a, b) =>
  a.login.localeCompare(b.login, "en", { sensitivity: "base" });

const foundingLogins = new Set(FOUNDING.map((sponsor) => sponsor.login));
const fromApi = new Map();
const current = [];
const past = [];

for (const node of await fetchSponsorships()) {
  // includePrivate: false already omits private sponsorships; the privacy
  // check is a second guard so a private sponsor can never end up in the file.
  if (node.privacyLevel !== "PUBLIC" || !node.sponsorEntity?.login) {
    continue;
  }
  const entry = toEntry(node);
  if (foundingLogins.has(entry.login)) {
    fromApi.set(entry.login, entry);
  } else if (node.isActive) {
    current.push(entry);
  } else {
    past.push(entry);
  }
}

// Founding sponsors are permanent: fall back to the pinned entry if the API
// no longer returns their sponsorship.
const founding = FOUNDING.map(
  (sponsor) => fromApi.get(sponsor.login) ?? sponsor,
);
// Higher tiers come first so placement on the site follows tier promises.
current.sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0) || byLogin(a, b));
past.sort(byLogin);

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "constants",
  "sponsors.json",
);
const data = { founding, current, past };
// Tab indentation matches how Biome formats JSON in this repo.
await writeFile(outputPath, `${JSON.stringify(data, null, "\t")}\n`);
console.log(
  `Wrote ${founding.length} founding, ${current.length} current, and ${past.length} past sponsors to constants/sponsors.json`,
);
