import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useInstallPrompt — captures the PWA install prompt and exposes platform info.
 * - On Chrome/Edge/Android: beforeinstallprompt is captured; promptInstall() shows the native dialog.
 * - On iOS Safari: no API exists; show instructions instead (isIOS=true, canPrompt=false).
 */
export function useInstallPrompt() {
  const eventRef = useRef(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isIOSSafari = isIOS && isSafari;

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setIsInstalled(standalone);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      eventRef.current = e;
      setCanPrompt(true);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setCanPrompt(false);
      eventRef.current = null;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const e = eventRef.current;
    if (!e) return { outcome: "unavailable" };
    await e.prompt();
    const choice = await e.userChoice;
    if (choice.outcome === "accepted") {
      setCanPrompt(false);
      eventRef.current = null;
    }
    return choice;
  }, []);

  return {
    canPrompt,
    isIOS,
    isIOSSafari,
    isInstalled,
    promptInstall,
    isAvailable: canPrompt || isIOSSafari,
  };
}
