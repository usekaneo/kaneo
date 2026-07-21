// Syncs the public GitHub sponsors of andrejsshell into constants/sponsors.json,
// which drives the Sponsors section on the landing page.
//
// Only sponsorships GitHub reports as PUBLIC are written; private sponsors are
// never included. Sponsors are grouped strictly by activity (current vs past).
// Founding is a permanent badge for the project's early backers: they keep the
// badge in either group and stay on the wall even if the API stops returning
// their sponsorship.
//
// Usage: GITHUB_TOKEN=<token with the read:user scope> node scripts/sync-sponsors.mjs

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAINTAINER = "andrejsshell";

// The project's early backers. Pinned so they can never disappear from the
// wall; the entries double as fallbacks if the API no longer returns them.
const FOUNDING = [
  {
    login: "danielsada",
    name: "Daniel Sada",
    avatarUrl: "https://avatars.githubusercontent.com/u/2849006?v=4",
  },
  {
    login: "achouvardas",
    name: "Angelos Chouvardas",
    avatarUrl: "https://avatars.githubusercontent.com/u/77693989?v=4",
  },
  {
    login: "alexgutjahr",
    name: "Alex Gutjahr",
    avatarUrl: "https://avatars.githubusercontent.com/u/58935?v=4",
  },
  {
    login: "KnudH",
    name: "Knud Hollander",
    avatarUrl: "https://avatars.githubusercontent.com/u/26556793?v=4",
  },
  {
    login: "MakoPhil",
    name: null,
    avatarUrl: "https://avatars.githubusercontent.com/u/36614366?v=4",
  },
  {
    login: "ndinevski",
    name: "Nikola Dinevski",
    avatarUrl: "https://avatars.githubusercontent.com/u/61565298?v=4",
  },
  {
    login: "TehMaat",
    name: null,
    avatarUrl: "https://avatars.githubusercontent.com/u/60507708?v=4",
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

const foundingLogins = new Set(FOUNDING.map((sponsor) => sponsor.login));

function toEntry(node) {
  const { login, name, databaseId } = node.sponsorEntity;
  return {
    login,
    name: name ?? null,
    avatarUrl: `https://avatars.githubusercontent.com/u/${databaseId}?v=4`,
    tier: node.tier?.monthlyPriceInDollars ?? null,
    founding: foundingLogins.has(login),
  };
}

const byLogin = (a, b) =>
  a.login.localeCompare(b.login, "en", { sensitivity: "base" });

const current = [];
const past = [];

for (const node of await fetchSponsorships()) {
  // includePrivate: false already omits private sponsorships; the privacy
  // check is a second guard so a private sponsor can never end up in the file.
  if (node.privacyLevel !== "PUBLIC" || !node.sponsorEntity?.login) {
    continue;
  }
  const entry = toEntry(node);
  if (node.isActive) {
    current.push(entry);
  } else {
    past.push(entry);
  }
}

// Founding sponsors are permanent: if the API no longer returns one of them,
// keep them on the wall via the pinned fallback entry.
const seen = new Set([...current, ...past].map((entry) => entry.login));
for (const sponsor of FOUNDING) {
  if (!seen.has(sponsor.login)) {
    past.push({ ...sponsor, tier: null, founding: true });
  }
}

// Higher tiers come first so placement on the site follows tier promises.
current.sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0) || byLogin(a, b));
past.sort(byLogin);

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "constants",
  "sponsors.json",
);
const data = { current, past };
// Tab indentation matches how Biome formats JSON in this repo.
await writeFile(outputPath, `${JSON.stringify(data, null, "\t")}\n`);
console.log(
  `Wrote ${current.length} current and ${past.length} past sponsors to constants/sponsors.json`,
);
