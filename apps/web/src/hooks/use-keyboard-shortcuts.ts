import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";

export function getModifierKeyText(): string {
  if (typeof window === "undefined") return "";
  return navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl";
}

type ShortcutHandler = () => void;
type ShortcutKey = string;
type PrefixKey = string;
type SequentialKey = string;

interface KeyboardShortcutsContextType {
  registerShortcut: (key: ShortcutKey, handler: ShortcutHandler) => void;
  registerSequentialShortcut: (
    prefix: PrefixKey,
    key: SequentialKey,
    handler: ShortcutHandler,
  ) => void;
  registerModifierShortcut: (
    modifierKey: string,
    key: string,
    handler: ShortcutHandler,
  ) => void;
  unregisterShortcut: (key: ShortcutKey) => void;
  unregisterSequentialShortcut: (prefix: PrefixKey, key: SequentialKey) => void;
  unregisterModifierShortcut: (modifierKey: string, key: string) => void;
  activePrefix: string | null;
}

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextType | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      "useKeyboardShortcuts must be used within a KeyboardShortcutsProvider",
    );
  }
  return context;
}

export function KeyboardShortcutsProvider({
  children,
}: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Map<string, ShortcutHandler>>(
    new Map(),
  );
  const [sequentialShortcuts, setSequentialShortcuts] = useState<
    Map<string, Map<string, ShortcutHandler>>
  >(new Map());
  const [modifierShortcuts, setModifierShortcuts] = useState<
    Map<string, ShortcutHandler>
  >(new Map());
  const [activePrefix, setActivePrefix] = useState<string | null>(null);
  const [prefixTimeout, setPrefixTimeout] = useState<number | null>(null);

  const resetPrefix = useCallback(() => {
    setActivePrefix(null);
    if (prefixTimeout) {
      window.clearTimeout(prefixTimeout);
      setPrefixTimeout(null);
    }
  }, [prefixTimeout]);

  const setPrefixWithTimeout = useCallback(
    (prefix: string) => {
      if (prefixTimeout) {
        window.clearTimeout(prefixTimeout);
      }

      setActivePrefix(prefix);

      const timeout = window.setTimeout(() => {
        setActivePrefix(null);
        setPrefixTimeout(null);
      }, 2000);

      setPrefixTimeout(timeout);
    },
    [prefixTimeout],
  );

  const registerShortcut = useCallback(
    (key: string, handler: ShortcutHandler) => {
      setShortcuts((prev) => new Map(prev).set(key, handler));
    },
    [],
  );

  const registerSequentialShortcut = useCallback(
    (prefix: string, key: string, handler: ShortcutHandler) => {
      setSequentialShortcuts((prev) => {
        const newMap = new Map(prev);
        if (!newMap.has(prefix)) {
          newMap.set(prefix, new Map());
        }
        const prefixMap = newMap.get(prefix);
        if (prefixMap) {
          prefixMap.set(key, handler);
        }
        return newMap;
      });
    },
    [],
  );

  const registerModifierShortcut = useCallback(
    (modifierKey: string, key: string, handler: ShortcutHandler) => {
      const shortcutKey = `${modifierKey}+${key.toLowerCase()}`;
      setModifierShortcuts((prev) => new Map(prev).set(shortcutKey, handler));
    },
    [],
  );

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts((prev) => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  }, []);

  const unregisterSequentialShortcut = useCallback(
    (prefix: string, key: string) => {
      setSequentialShortcuts((prev) => {
        const newMap = new Map(prev);
        if (newMap.has(prefix)) {
          const prefixMap = newMap.get(prefix);
          if (prefixMap) {
            prefixMap.delete(key);
            if (prefixMap.size === 0) {
              newMap.delete(prefix);
            }
          }
        }
        return newMap;
      });
    },
    [],
  );

  const unregisterModifierShortcut = useCallback(
    (modifierKey: string, key: string) => {
      const shortcutKey = `${modifierKey}+${key.toLowerCase()}`;
      setModifierShortcuts((prev) => {
        const newMap = new Map(prev);
        newMap.delete(shortcutKey);
        return newMap;
      });
    },
    [],
  );

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        const modifierKey = event.metaKey
          ? "⌘"
          : event.ctrlKey
            ? "Ctrl"
            : event.altKey
              ? "Alt"
              : "Shift";
        const shortcutKey = `${modifierKey}+${key}`;

        if (modifierShortcuts.has(shortcutKey)) {
          event.preventDefault();
          const handler = modifierShortcuts.get(shortcutKey);
          if (handler) {
            handler();
          }
          return;
        }
        return;
      }

      if (activePrefix && sequentialShortcuts.has(activePrefix)) {
        const prefixMap = sequentialShortcuts.get(activePrefix);
        if (prefixMap?.has(key)) {
          event.preventDefault();
          const handler = prefixMap.get(key);
          if (handler) {
            handler();
          }
          resetPrefix();
          return;
        }
      }

      if (shortcuts.has(key)) {
        event.preventDefault();
        const handler = shortcuts.get(key);
        if (handler) {
          handler();
        }
      } else if (sequentialShortcuts.has(key)) {
        event.preventDefault();
        setPrefixWithTimeout(key);
      }
    },
    [
      activePrefix,
      shortcuts,
      sequentialShortcuts,
      modifierShortcuts,
      resetPrefix,
      setPrefixWithTimeout,
    ],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      if (prefixTimeout) {
        window.clearTimeout(prefixTimeout);
      }
    };
  }, [handleKeyPress, prefixTimeout]);

  useEffect(() => {
    return () => {
      if (prefixTimeout) {
        window.clearTimeout(prefixTimeout);
      }
    };
  }, [prefixTimeout]);

  const value = {
    registerShortcut,
    registerSequentialShortcut,
    registerModifierShortcut,
    unregisterShortcut,
    unregisterSequentialShortcut,
    unregisterModifierShortcut,
    activePrefix,
  };

  return React.createElement(
    KeyboardShortcutsContext.Provider,
    { value },
    children,
  );
}

export function useRegisterShortcuts(shortcutsConfig: {
  shortcuts?: { [key: string]: ShortcutHandler };
  sequentialShortcuts?: {
    [prefix: string]: { [key: string]: ShortcutHandler };
  };
  modifierShortcuts?: {
    [modifierKey: string]: { [key: string]: ShortcutHandler };
  };
}) {
  const {
    registerShortcut,
    registerSequentialShortcut,
    registerModifierShortcut,
    unregisterShortcut,
    unregisterSequentialShortcut,
    unregisterModifierShortcut,
  } = useKeyboardShortcuts();

  useEffect(() => {
    if (shortcutsConfig.shortcuts) {
      for (const [key, handler] of Object.entries(shortcutsConfig.shortcuts)) {
        registerShortcut(key, handler);
      }
    }

    if (shortcutsConfig.sequentialShortcuts) {
      for (const [prefix, prefixMap] of Object.entries(
        shortcutsConfig.sequentialShortcuts,
      )) {
        for (const [key, handler] of Object.entries(prefixMap)) {
          registerSequentialShortcut(prefix, key, handler);
        }
      }
    }

    if (shortcutsConfig.modifierShortcuts) {
      for (const [modifierKey, keyMap] of Object.entries(
        shortcutsConfig.modifierShortcuts,
      )) {
        for (const [key, handler] of Object.entries(keyMap)) {
          registerModifierShortcut(modifierKey, key, handler);
        }
      }
    }

    return () => {
      if (shortcutsConfig.shortcuts) {
        for (const key of Object.keys(shortcutsConfig.shortcuts)) {
          unregisterShortcut(key);
        }
      }

      if (shortcutsConfig.sequentialShortcuts) {
        for (const [prefix, prefixMap] of Object.entries(
          shortcutsConfig.sequentialShortcuts,
        )) {
          for (const key of Object.keys(prefixMap)) {
            unregisterSequentialShortcut(prefix, key);
          }
        }
      }

      if (shortcutsConfig.modifierShortcuts) {
        for (const [modifierKey, keyMap] of Object.entries(
          shortcutsConfig.modifierShortcuts,
        )) {
          for (const key of Object.keys(keyMap)) {
            unregisterModifierShortcut(modifierKey, key);
          }
        }
      }
    };
  }, [
    registerShortcut,
    registerSequentialShortcut,
    registerModifierShortcut,
    unregisterShortcut,
    unregisterSequentialShortcut,
    unregisterModifierShortcut,
    shortcutsConfig,
  ]);
}
