"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "tsp-pwa-install-dismissed";
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Propose d’installer l’app (Chrome/Edge via beforeinstallprompt ;
 * iOS : instructions « Sur l’écran d’accueil »).
 */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
      setIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", onBip);

    // iOS Safari : pas d’événement beforeinstallprompt
    if (isIos() && !isStandalone()) {
      const t = window.setTimeout(() => {
        if (!wasDismissedRecently()) {
          setIosHint(true);
          setVisible(true);
        }
      }, 2500);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBip);
        window.clearTimeout(t);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!visible) return null;

  async function onInstall() {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
        setVisible(false);
      }
    } finally {
      setDeferred(null);
      setInstalling(false);
    }
  }

  function onClose() {
    dismiss();
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[190] p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_20px_50px_-18px_rgba(21,34,56,0.45)]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1D2D50] text-[#FFCD79]">
          <Download className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--navy)]">Installer Solidarité Plus</p>
          {iosHint ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Sur iPhone : appuyez sur{" "}
              <Share className="inline h-3.5 w-3.5 text-[var(--sand)]" strokeWidth={2} /> Partager
              puis « Sur l’écran d’accueil ».
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Ajoutez l’application à votre téléphone pour un accès rapide, comme une app native.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {!iosHint && deferred && (
              <button
                type="button"
                disabled={installing}
                onClick={onInstall}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#1D2D50] px-3.5 py-1.5 text-xs font-semibold text-[#FFCD79] transition hover:bg-[#152238] disabled:opacity-60"
              >
                {installing ? "Ouverture…" : "Installer"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-[var(--muted)] transition hover:bg-[var(--cream)] hover:text-[var(--navy)]"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
