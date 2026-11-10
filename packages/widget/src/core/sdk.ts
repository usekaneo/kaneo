import type {
  OpenOptions,
  WidgetUser,
  EventName,
  EventHandler,
} from "../types.js";
import { createEmitter } from "./events.js";
import {
  createBridge,
  type Bridge,
  type OutboundMessage,
} from "./postmessage.js";
import { createLauncher, type LauncherHandle } from "./launcher.js";
import { createPanel, type PanelHandle } from "./panel.js";
import {
  fetchServerConfig,
  serverConfigSchema,
  type ServerConfig,
} from "./config.js";
import { createTracker, type Tracker } from "./tracker.js";
import { clearDeviceId, getOrCreateDeviceId } from "./device.js";
import { removeStyles } from "./style.js";
import { privacyOptedOut } from "./privacy.js";
import {
  initOptionsSchema,
  identitySchema,
  isSafeHttpUrl,
  type RuntimeInitOptions,
} from "./options.js";

type Command =
  | "init"
  | "identify"
  | "logout"
  | "open"
  | "close"
  | "showLauncher"
  | "hideLauncher"
  | "destroy"
  | "metadata"
  | "tracking"
  | "on"
  | "off";

export interface SDK {
  dispatch(command: Command, arg1?: unknown, arg2?: unknown): unknown;
  isOpen(): boolean;
  getUser(): WidgetUser | null;
  isIdentified(): boolean;
}

export function createSDK(): SDK {
  let config: RuntimeInitOptions | null = null;
  let launcher: LauncherHandle | null = null;
  let panel: PanelHandle | null = null;
  let bridge: Bridge | null = null;
  let ready = false;
  let identifying = false;
  let configAbort: AbortController | null = null;
  let revealTimer: number | null = null;
  let metadata: Record<string, string> | null = null;
  // `pendingIdentify` can be an Identity, `{anonymous: true}`, or `null` (logout).
  // `pendingIdentifyPresent` distinguishes "nothing queued" from "logout queued".
  let pendingIdentify: unknown = null;
  let pendingIdentifyPresent = false;
  let pendingOpen: OpenOptions | null = null;
  let panelOpen = false;
  let currentUser: WidgetUser | null = null;
  // Effective launcher/panel corner: the init `placement` until the server
  // config's `position` (the workspace's widget setting) overrides it.
  let placement: "left" | "right" = "right";
  let mobileMql: MediaQueryList | null = null;
  let mobileCleanup: (() => void) | null = null;
  let tracker: Tracker | null = null;
  // The host page's say on pageview tracking (for example its consent
  // banner). Tracking runs only when both the host and the instance allow it.
  let hostTracking = true;
  let analyticsConfig: { instanceUrl: string; deviceTracking: boolean } | null =
    null;
  let pendingDevice: string | null = null;
  const emitter = createEmitter();

  function sendMobileState(): void {
    if (ready && bridge) bridge.send("quackback:mobile", !!mobileMql?.matches);
  }

  function iframeOrigin(): string {
    return new URL(config!.instanceUrl).origin;
  }

  function onIframeMessage(msg: OutboundMessage) {
    switch (msg.type) {
      case "quackback:ready":
        ready = true;
        panel?.markReady();
        flushIdentity();
        if (config?.locale) bridge!.send("quackback:locale", config.locale);
        if (metadata) bridge!.send("quackback:metadata", metadata);
        if (pendingDevice && hostTracking && !privacyOptedOut()) {
          bridge!.send("quackback:device", pendingDevice);
          pendingDevice = null;
        }
        if (pendingOpen) {
          bridge!.send("quackback:open", pendingOpen);
          pendingOpen = null;
        }
        sendMobileState();
        emitter.emit("ready", {});
        break;
      case "quackback:close":
        dispatch("close");
        break;
      case "quackback:unread": {
        launcher?.setUnread(msg.count);
        emitter.emit("unread", { count: msg.count });
        break;
      }
      case "quackback:expand":
        panel?.setExpanded(msg.expanded);
        break;
      case "quackback:identify-result": {
        if (!identifying) break;
        identifying = false;
        if (pendingIdentifyPresent) {
          flushIdentity();
          break;
        }
        currentUser = msg.success ? (msg.user ?? null) : null;
        emitter.emit("identify", {
          success: msg.success,
          user: currentUser,
          anonymous: msg.success && !currentUser,
          error: msg.error,
        });
        break;
      }
      case "quackback:auth-change":
        if (!identifying && !pendingIdentifyPresent) currentUser = msg.user;
        break;
      case "quackback:event":
        emitter.emit(msg.name, msg.payload);
        break;
      case "quackback:navigate": {
        if (isSafeHttpUrl(msg.url)) {
          // noopener: prevent tabnabbing via window.opener on the new tab.
          // noreferrer: avoid leaking the host page URL to third parties.
          window.open(msg.url, "_blank", "noopener,noreferrer");
        }
        break;
      }
    }
  }

  // Pending idle-time panel preload (see the init case). Cancelled on
  // destroy and made moot by an early open(), which creates the panel itself.
  let panelPreload: { kind: "idle" | "timeout"; id: number } | null = null;

  function schedulePanelPreload(): void {
    if (panel || panelPreload) return;
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
    };
    const initToken = config;
    const run = () => {
      if (!config || config !== initToken) return;
      panelPreload = null;
      if (config && !panel) ensurePanel();
    };
    if (typeof w.requestIdleCallback === "function") {
      panelPreload = {
        kind: "idle",
        id: w.requestIdleCallback(run, { timeout: 2500 }),
      };
    } else {
      // No requestIdleCallback (Safari): a short beat past the current task
      // keeps the iframe from racing the host page's own startup work.
      panelPreload = { kind: "timeout", id: window.setTimeout(run, 200) };
    }
  }

  function cancelPanelPreload(): void {
    if (!panelPreload) return;
    const w = window as Window & { cancelIdleCallback?: (id: number) => void };
    if (
      panelPreload.kind === "idle" &&
      typeof w.cancelIdleCallback === "function"
    ) {
      w.cancelIdleCallback(panelPreload.id);
    } else if (panelPreload.kind === "timeout") {
      window.clearTimeout(panelPreload.id);
    }
    panelPreload = null;
  }

  function ensurePanel(): PanelHandle {
    if (panel) return panel;
    cancelPanelPreload();
    panel = createPanel({
      widgetUrl: `${config!.instanceUrl}/widget`,
      placement,
      defaultBoard: config!.defaultBoard,
      // The open panel covers the launcher; closing belongs inside the iframe.
      showCloseButton: true,
      locale: config!.locale,
      onBackdropClick: () => dispatch("close"),
    });
    bridge = createBridge({
      getIframe: () => panel?.iframe ?? null,
      origin: iframeOrigin(),
    });
    bridge.onMessage(onIframeMessage);
    mobileMql = window.matchMedia("(max-width: 760px)");
    const mql = mobileMql;
    mql.addEventListener("change", sendMobileState);
    mobileCleanup = () => mql.removeEventListener("change", sendMobileState);
    return panel;
  }

  function flushIdentity(): void {
    if (!ready || !bridge || identifying || !pendingIdentifyPresent) return;
    const identity = pendingIdentify;
    pendingIdentify = null;
    pendingIdentifyPresent = false;
    identifying = true;
    try {
      bridge.send("quackback:identify", identity);
    } catch (error) {
      identifying = false;
      throw error;
    }
  }

  function sendIdentity(data: unknown): void {
    currentUser = null;
    pendingIdentify = data;
    pendingIdentifyPresent = true;
    flushIdentity();
  }

  function applyServerTheme(serverCfg: ServerConfig) {
    if (!launcher || !serverCfg.theme) return;
    const t = serverCfg.theme;
    const themeMode = t.themeMode ?? "user";
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = themeMode === "dark" || (themeMode === "user" && prefersDark);
    const backgroundColor = dark
      ? (t.darkPrimary ?? t.lightPrimary)
      : t.lightPrimary;
    const foregroundColor = dark
      ? (t.darkPrimaryForeground ?? t.lightPrimaryForeground)
      : t.lightPrimaryForeground;
    launcher.setColors({ backgroundColor, foregroundColor });
  }

  // Reveal the launcher only after brand colors are set (or via the fallback
  // if the config fetch is slow/fails), so users never see the default color
  // flash before the brand color lands.
  const LAUNCHER_REVEAL_FALLBACK_MS = 1800;
  /** Only the current initialization may apply server-controlled state. */
  function applyServerConfig(
    serverConfig: ServerConfig,
    initToken: RuntimeInitOptions,
  ): void {
    if (config !== initToken) return;
    applyServerTheme(serverConfig);
    launcher?.setGreeting(serverConfig.launcherGreeting);
    launcher?.setLabel(serverConfig.launcherLabel);
    if (serverConfig.position) {
      placement = serverConfig.position;
      launcher?.setPlacement(placement);
      panel?.setPlacement(placement);
    }
    // Host-page pageview tracking is instance-controlled: it starts only when
    // the server config enables visitor analytics, and only if this init is
    // still the live one. The durable device id is a separate opt-in on top.
    if (serverConfig.visitorAnalytics === true) {
      analyticsConfig = {
        instanceUrl: initToken.instanceUrl,
        deviceTracking: serverConfig.visitorDeviceTracking === true,
      };
      startTracking();
    }
  }

  function startTracking(): void {
    // A running tracker is left alone: restarting it would count the current
    // page again.
    if (!hostTracking || !analyticsConfig || tracker || privacyOptedOut())
      return;
    const deviceId = analyticsConfig.deviceTracking
      ? getOrCreateDeviceId()
      : null;
    tracker = createTracker(analyticsConfig.instanceUrl, deviceId);
    try {
      tracker.start();
    } catch {
      stopTracking();
      return;
    }
    // The iframe links the device to the session's principal; queue
    // until the panel reports ready if it hasn't yet.
    if (deviceId) {
      if (ready && bridge) bridge.send("quackback:device", deviceId);
      else pendingDevice = deviceId;
    }
  }

  function stopTracking(): void {
    tracker?.stop();
    tracker = null;
    pendingDevice = null;
  }

  function createLauncherIfNeeded(): void {
    if (launcher || !config || config.launcher === false) return;
    launcher = createLauncher({
      placement,
      onClick: () => {
        if (panelOpen) dispatch("close");
        else dispatch("open");
      },
    });
  }

  function dispatch(cmd: Command, a?: unknown, b?: unknown): unknown {
    switch (cmd) {
      case "init": {
        const next = initOptionsSchema.parse(a);
        // Validate before destroy so a bad re-init leaves the working instance intact.
        if (config) dispatch("destroy");
        config = next;
        // Only an explicit option changes the host's choice, so a withdrawal
        // made before init, or before a re-init, is never silently undone.
        if (next.tracking !== undefined) hostTracking = next.tracking;
        if (!hostTracking) clearDeviceId();
        placement = next.placement ?? "right";
        createLauncherIfNeeded();
        // Preload the hidden panel iframe off the host page's critical path:
        // init typically runs while the host is still loading, and the iframe
        // immediately competes for its bandwidth. An open() before the idle
        // slot fires still creates the panel on the spot.
        schedulePanelPreload();
        sendIdentity(config.identity ?? { anonymous: true });
        const targetLauncher = launcher;
        const reveal = () => {
          if (config === next) targetLauncher?.reveal();
        };
        const baked = window.__QUACKBACK_CONFIG__;
        const bakedMatches =
          !window.__QUACKBACK_URL__ ||
          window.__QUACKBACK_URL__ === next.instanceUrl;
        if (baked !== undefined && bakedMatches) {
          const parsed = serverConfigSchema.safeParse(baked);
          applyServerConfig(parsed.success ? parsed.data : {}, next);
          reveal();
        } else {
          const controller = new AbortController();
          configAbort = controller;
          const fallback = window.setTimeout(
            reveal,
            LAUNCHER_REVEAL_FALLBACK_MS,
          );
          revealTimer = fallback;
          void fetchServerConfig(next.instanceUrl, controller.signal)
            .then((serverConfig) => applyServerConfig(serverConfig, next))
            .finally(() => {
              window.clearTimeout(fallback);
              if (config !== next) return;
              configAbort = null;
              revealTimer = null;
              reveal();
            });
        }
        return;
      }
      case "identify":
        sendIdentity(identitySchema.parse(a ?? { anonymous: true }));
        return;
      case "logout":
        launcher?.setOpen(false);
        panel?.hide();
        panelOpen = false;
        currentUser = null;
        sendIdentity(null);
        return;
      case "open": {
        if (!config) return; // open before init is a no-op, matching close/hide
        const opts = (a as OpenOptions) ?? {};
        if (ready && bridge) bridge.send("quackback:open", opts);
        else pendingOpen = opts;
        // The idle preload may not have fired yet — create the panel now.
        ensurePanel().show();
        launcher?.setOpen(true);
        panelOpen = true;
        const ctx = opts as {
          view?:
            | "home"
            | "new-post"
            | "changelog"
            | "help"
            | "chat"
            | "messages"
            | "tickets";
          postId?: string;
          articleId?: string;
          entryId?: string;
        };
        emitter.emit("open", {
          view: ctx.view,
          postId: ctx.postId,
          articleId: ctx.articleId,
          entryId: ctx.entryId,
        });
        return;
      }
      case "close":
        launcher?.setOpen(false);
        panel?.hide();
        panelOpen = false;
        emitter.emit("close", {});
        return;
      case "showLauncher":
        if (!launcher) createLauncherIfNeeded();
        else launcher.el.style.display = "flex";
        return;
      case "hideLauncher":
        if (launcher) launcher.el.style.display = "none";
        return;
      case "on":
        return emitter.on(a as EventName, b as EventHandler<EventName>);
      case "off":
        emitter.off(a as EventName, b as EventHandler<EventName> | undefined);
        return;
      case "metadata": {
        const patch = a as Record<string, string | null>;
        metadata = metadata ?? {};
        for (const k of Object.keys(patch)) {
          const v = patch[k];
          if (v === null) delete metadata[k];
          else metadata[k] = String(v);
        }
        if (ready && bridge) bridge.send("quackback:metadata", metadata);
        return;
      }
      case "tracking":
        hostTracking = a === true;
        if (hostTracking) startTracking();
        else {
          // Withdrawn consent also removes the stored device id.
          stopTracking();
          clearDeviceId();
          // The panel keeps the id it was given for linking sessions to the
          // device; a null tells it to drop it.
          if (ready && bridge) bridge.send("quackback:device", null);
        }
        return;
      case "destroy":
        config = null;
        configAbort?.abort();
        configAbort = null;
        if (revealTimer !== null) window.clearTimeout(revealTimer);
        revealTimer = null;
        cancelPanelPreload();
        panel?.destroy();
        launcher?.remove();
        bridge?.dispose();
        stopTracking();
        analyticsConfig = null;
        mobileCleanup?.();
        mobileCleanup = null;
        mobileMql = null;
        removeStyles();
        panel = null;
        launcher = null;
        bridge = null;
        ready = false;
        identifying = false;
        metadata = null;
        pendingIdentify = null;
        pendingIdentifyPresent = false;
        pendingOpen = null;
        panelOpen = false;
        currentUser = null;
        placement = "right";
        config = null;
        return;
    }
  }

  return {
    dispatch,
    isOpen: () => panelOpen,
    getUser: () => currentUser,
    isIdentified: () => currentUser !== null,
  };
}
