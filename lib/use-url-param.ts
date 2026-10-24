"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "gt:urlparam";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("popstate", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("popstate", cb);
  };
};

/**
 * One query-string value (?name=value) as state, without useSearchParams (which made hard reloads stall in this Next setup).
 * The server snapshot is null, so the first client render matches the server HTML.
 */
export function useUrlParam(name: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(subscribe, () => new URLSearchParams(window.location.search).get(name), () => null);
  const set = useCallback((next: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (next) params.set(name, next);
    else params.delete(name);
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    window.dispatchEvent(new Event(EVENT));
  }, [name]);
  return [value, set];
}
