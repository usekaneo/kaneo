// Keep late 401 responses from replacing a pending identity-provider navigation.
export const signOutState = { isRedirecting: false };
