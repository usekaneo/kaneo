import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";

export function getModifierKeyText(): string {
  if (typeof window === "undefined") return "Ctrl+";
  return navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl+";
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
  unregisterShortcut: (key: ShortcutKey) => void;
  unregisterSequentialShortcut: (prefix: PrefixKey, key: SequentialKey) => void;
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

      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }

      const key = event.key.toLowerCase();

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
    unregisterShortcut,
    unregisterSequentialShortcut,
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
}) {
  const {
    registerShortcut,
    registerSequentialShortcut,
    unregisterShortcut,
    unregisterSequentialShortcut,
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
    };
  }, [
    registerShortcut,
    registerSequentialShortcut,
    unregisterShortcut,
    unregisterSequentialShortcut,
    shortcutsConfig,
  ]);
}
