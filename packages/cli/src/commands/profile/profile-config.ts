import {
  type ConfigFile,
  DEFAULT_PROFILE,
  type Profile,
} from "../../config/format.js";

export type ProfileJson = {
  readonly name: string;
  readonly active: boolean;
  readonly apiUrl: string;
  readonly webUrl: string | null;
  readonly signedIn: boolean;
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  } | null;
  readonly workspaceId: string | null;
};

export function toProfileJson(
  name: string,
  profile: Profile,
  active: boolean,
): ProfileJson {
  return {
    name,
    active,
    apiUrl: profile.apiUrl,
    webUrl: profile.webUrl ?? null,
    signedIn: Boolean(profile.token),
    user: profile.user ?? null,
    workspaceId: profile.workspaceId ?? null,
  };
}

export function listProfiles(
  config: ConfigFile,
  activeName: string,
): ReadonlyArray<ProfileJson> {
  return Object.entries(config.profiles).map(([name, profile]) =>
    toProfileJson(name, profile, name === activeName),
  );
}

export function useProfile(
  config: ConfigFile,
  name: string,
): ConfigFile | undefined {
  return config.profiles[name] ? { ...config, activeProfile: name } : undefined;
}

export function removeProfile(
  config: ConfigFile,
  name: string,
): ConfigFile | undefined {
  if (!config.profiles[name]) return undefined;
  const { [name]: _removed, ...profiles } = config.profiles;
  const activeProfile =
    config.activeProfile === name
      ? (Object.keys(profiles)[0] ?? DEFAULT_PROFILE)
      : config.activeProfile;
  return { ...config, activeProfile, profiles };
}

export type RenamedProfile =
  | { readonly kind: "renamed"; readonly config: ConfigFile }
  | { readonly kind: "missing" }
  | { readonly kind: "taken" };

export function renameProfile(
  config: ConfigFile,
  from: string,
  to: string,
): RenamedProfile {
  if (!config.profiles[from]) return { kind: "missing" };
  if (from !== to && config.profiles[to]) return { kind: "taken" };
  const profiles = Object.fromEntries(
    Object.entries(config.profiles).map(([name, profile]) => [
      name === from ? to : name,
      profile,
    ]),
  );
  return {
    kind: "renamed",
    config: {
      ...config,
      activeProfile: config.activeProfile === from ? to : config.activeProfile,
      profiles,
    },
  };
}
