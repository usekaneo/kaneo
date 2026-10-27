import { AsyncLocalStorage } from "node:async_hooks";

type CustomOAuthSignIn = { profile?: Record<string, unknown> };

const customOAuthSignIn = new AsyncLocalStorage<CustomOAuthSignIn>();

export function runCustomOAuthCallback<T>(callback: () => T): T {
  return customOAuthSignIn.run({}, callback);
}

export function rememberCustomOAuthProfile(profile: Record<string, unknown>) {
  const store = customOAuthSignIn.getStore();
  if (store) store.profile = profile;
}

export function isCustomOAuthCallback() {
  return customOAuthSignIn.getStore() !== undefined;
}

export function takeCustomOAuthProfile() {
  const store = customOAuthSignIn.getStore();
  const profile = store?.profile;
  if (store) store.profile = undefined;
  return profile;
}
