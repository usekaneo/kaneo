// Workspace Quackback URL — e.g. "https://feedback.acme.com"
export type InstanceUrl = string;

/**
 * Languages Quackback ships catalogs for, as BCP-47 tags (autocomplete hints
 * for the `locale` option). This is the single source for the `locale` type
 * below. The widget is a standalone package and does not import application catalogs.
 */
export const WIDGET_LOCALES = [
  "en",
  "fr",
  "de",
  "es",
  "ar",
  "ru",
  "pt-BR",
  "zh-CN",
  "zh-TW",
  "nl",
  "pl",
  "th",
  "uk",
] as const;

/** Passed to `Quackback("init", ...)` or `Quackback.init(...)`. */
export interface InitOptions {
  /** Workspace Quackback instance URL — required when using the npm package. */
  instanceUrl: InstanceUrl;
  placement?: "left" | "right";
  defaultBoard?: string;
  /** Set `launcher: false` to hide the default floating button and open programmatically. */
  launcher?: boolean;
  /**
   * Override the auto-detected UI language. Accepts any BCP-47 tag — the host
   * forwards it and the Quackback instance resolves the closest catalog it has.
   * The literals are autocomplete hints for the languages Quackback ships today
   * (see WIDGET_LOCALES).
   */
  locale?: (typeof WIDGET_LOCALES)[number] | (string & {});
  /** Bundle identity into init — shorthand for init + identify. */
  identity?: Identity;
  /**
   * Set `tracking: false` to keep host-page visitor analytics off: no pageview
   * beacons and no new device id, for example until the visitor accepts
   * analytics cookies. Turn it on later with `Quackback.tracking(true)`, or
   * withdraw with `Quackback.tracking(false)`, which also removes a stored
   * device id. Omitting the option keeps the host's last choice. Tracking runs
   * only when the instance also enables visitor analytics.
   */
  tracking?: boolean;
}

/**
 * What the host app passes to identify the current user.
 *
 * For anonymous sessions, call `identify()` with no argument — don't pass
 * `{ anonymous: true }`. (The runtime still accepts `{ anonymous: true }` for
 * backwards-compat with older integrations, but it's not in the type so
 * TypeScript users get nudged to the cleaner form.)
 */
export type Identity =
  | { ssoToken: string }
  | ({ id: string; email: string; name?: string; avatarURL?: string } & Record<
      string,
      unknown
    >);

/**
 * Arguments to `Quackback.open(...)`. Discriminated on the target:
 * - omit the payload or `{ view: 'home' }` to open the home view
 * - `{ view: 'new-post', title?, body?, board? }` pre-fills the new-post form
 * - `{ view: 'changelog', entryId? }` opens the changelog, optionally to one entry
 * - `{ view: 'help', query? }` opens help, optionally with search prefilled
 * - `{ view: 'chat' }` opens the live chat view
 * - `{ view: 'messages' }` opens the messenger conversations view, when it is enabled
 * - `{ view: 'tickets' }` opens the visitor's tickets list, or messages when that is unavailable
 * - `{ postId }` deep-links to a specific post
 * - `{ articleId }` deep-links to a help article (`article_…` TypeID or slug;
 *   stored `kb_article_…` ids also resolve)
 *
 * `postId` and `articleId` win over `view` when both are set. `board` applies
 * only to `new-post` — Home filtering uses `init({ defaultBoard })` or `?board=`.
 *
 * The iframe handles every field on this type. A target whose surface is
 * disabled (or a board the visitor cannot see) fails closed — the panel
 * still opens, but the widget does not invent access.
 */
export type OpenOptions =
  | undefined
  | { view?: "home" }
  | { view: "new-post"; title?: string; body?: string; board?: string }
  | { view: "changelog"; entryId?: string }
  | { view: "help"; query?: string }
  | { view: "chat" }
  | { view: "messages" }
  | { view: "tickets" }
  | { postId: string }
  | { articleId: string };

/** Payload types are inferred from the iframe boundary schemas. */
export type { WidgetUser, EventMap } from "./core/protocol.js";
import type { EventMap } from "./core/protocol.js";

export type EventName = keyof EventMap;
export type EventHandler<T extends EventName> = (payload: EventMap[T]) => void;
export type Unsubscribe = () => void;
