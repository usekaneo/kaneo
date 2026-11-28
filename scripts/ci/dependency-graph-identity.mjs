// pnpm peer contexts and patch hashes are not part of the published npm version.
export function packageIdentity(key) {
  if (typeof key !== "string") throw new Error("Expected a package key");
  const base = key.split("(", 1)[0];
  let depth = 0;
  for (const character of key.slice(base.length)) {
    if (character === "(") depth++;
    else if (character === ")") depth--;
    else if (depth === 0) throw new Error(`Invalid pnpm suffix: ${key}`);
    if (depth < 0) throw new Error(`Invalid pnpm suffix: ${key}`);
  }
  if (depth !== 0) throw new Error(`Invalid pnpm suffix: ${key}`);
  const match =
    /^(?<name>(?:@[^/@\s]+\/)?[^/@\s]+)@(?<version>\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?(?:\+[\da-zA-Z.-]+)?)$/.exec(
      base,
    );
  if (!match) throw new Error(`Unsupported npm package identity: ${key}`);
  const { name, version } = match.groups;
  const encodedName = name.split("/").map(encodeURIComponent).join("/");
  return {
    base,
    purl: `pkg:npm/${encodedName}@${encodeURIComponent(version)}`,
  };
}

export function dependencyKey(name, reference) {
  if (typeof reference !== "string" || reference.length === 0) {
    throw new Error(`Invalid resolved reference for ${name}`);
  }
  const value = reference.startsWith("npm:") ? reference.slice(4) : reference;
  // Aliases carry the real package name, including scoped names, in the version.
  const key = value.split("(", 1)[0].includes("@") ? value : `${name}@${value}`;
  packageIdentity(key);
  return key;
}
