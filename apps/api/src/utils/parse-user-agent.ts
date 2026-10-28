export type UserAgentDevice = {
  browser?: string;
  os?: string;
};

const MAX_USER_AGENT_LENGTH = 512;

const browsers: Array<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

const systems: Array<[RegExp, string]> = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bMacintosh\b|\bMac OS X\b/, "macOS"],
  [/\bWindows\b/, "Windows"],
  [/\bLinux\b/, "Linux"],
];

function match(userAgent: string, patterns: Array<[RegExp, string]>) {
  return patterns.find(([pattern]) => pattern.test(userAgent))?.[1];
}

export function parseUserAgent(
  userAgent: string | null | undefined,
): UserAgentDevice | undefined {
  if (!userAgent) return undefined;

  const value = userAgent.slice(0, MAX_USER_AGENT_LENGTH);
  const device = {
    browser: match(value, browsers),
    os: match(value, systems),
  };

  return device.browser || device.os ? device : undefined;
}
