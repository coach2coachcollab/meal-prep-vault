import { lazy, ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-attempted";

/**
 * React.lazy with retry. Dynamic-import failures are usually transient
 * (network hiccup or a stale hashed chunk after a new deploy), so we retry
 * once and, if it still fails, force a single hard reload to pick up the
 * latest asset manifest instead of showing a blank screen.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err) {
      // Retry once — covers momentary network failures.
      try {
        const mod = await factory();
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      } catch (err2) {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          // Never resolves; the page is reloading.
          return new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}
