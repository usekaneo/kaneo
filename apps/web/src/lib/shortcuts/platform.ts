export const isMacPlatform = () =>
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

export const getModifierKeyText = () => (isMacPlatform() ? "⌘" : "Ctrl");
