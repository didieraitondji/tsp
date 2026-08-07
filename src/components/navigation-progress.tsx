"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Listener = (pending: boolean) => void;
const listeners = new Set<Listener>();

/** Déclenche le spinner pour une navigation programmée (router.push, etc.). */
export function beginPageTransition() {
  listeners.forEach((l) => l(true));
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [pending, setPending] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    overlayTimer.current = null;
    safetyTimer.current = null;
  }, []);

  const start = useCallback(() => {
    setPending(true);
    clearTimers();
    // Overlay après un court délai pour éviter un flash sur les navigations rapides
    overlayTimer.current = setTimeout(() => setShowOverlay(true), 180);
    safetyTimer.current = setTimeout(() => {
      setPending(false);
      setShowOverlay(false);
    }, 12_000);
  }, [clearTimers]);

  const stop = useCallback(() => {
    clearTimers();
    setPending(false);
    setShowOverlay(false);
  }, [clearTimers]);

  useEffect(() => {
    stop();
  }, [routeKey, stop]);

  useEffect(() => subscribe((v) => (v ? start() : stop())), [start, stop]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const el = (e.target as HTMLElement | null)?.closest("a");
      if (!el) return;

      const a = el as HTMLAnchorElement;
      if (a.target === "_blank" || a.hasAttribute("download")) return;

      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash === window.location.hash
      ) {
        return;
      }

      start();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]" aria-live="polite" aria-busy="true">
      {/* Barre fine en haut */}
      <div className="absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-[#1D2D50]/10">
        <div className="tsp-nav-bar h-full w-1/3 rounded-full bg-gradient-to-r from-[#D09C79] via-[#FFCD79] to-[#FFCD79]" />
      </div>

      {showOverlay && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#152238]/30 backdrop-blur-[3px] transition-opacity duration-200">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/15 bg-[#152238]/90 px-8 py-7 shadow-[0_24px_60px_-20px_rgba(15,24,40,0.65)]">
            <span className="relative flex h-12 w-12 items-center justify-center" aria-hidden>
              <span className="absolute inset-0 rounded-full border-2 border-[#FFCD79]/20" />
              <span className="tsp-nav-spin absolute inset-0 rounded-full border-2 border-transparent border-t-[#FFCD79] border-r-[#D09C79]" />
              <span className="h-2 w-2 rounded-full bg-[#FFCD79]" />
            </span>
            <p className="text-sm font-medium tracking-wide text-[#F4E4D7]/90">Chargement…</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
