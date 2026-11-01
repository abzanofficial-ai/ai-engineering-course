"use client";

// Registers the service worker and offers installation (ADR-0022). The prompt appears from
// the second visit, can be dismissed for good, and on iPhone explains Add to Home Screen.
import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore: storage blocked
  }
};

export function Pwa() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const visits = Number(read("visits") ?? "0") + 1;
    write("visits", String(visits));
    const eligible = visits >= 2 && read("install-dismissed") !== "1";
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone);
    if (!eligible || standalone) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      const t = setTimeout(() => setIos(true), 0);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!event && !ios) return null;
  const dismiss = () => {
    write("install-dismissed", "1");
    setEvent(null);
    setIos(false);
  };
  return (
    <div className="account-prompt" role="dialog" aria-labelledby="install-h">
      <div>
        <strong id="install-h">Install the app</strong>
        <p>
          {ios
            ? "Tap Share, then Add to Home Screen. You'll open it like an app and can read chapters offline."
            : "Add it to your home screen to open it like an app and read chapters offline."}
        </p>
      </div>
      <div className="ap-actions">
        {event && (
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              await event.prompt();
              dismiss();
            }}
          >
            Install
          </button>
        )}
        <button type="button" className="btn" onClick={dismiss}>
          {ios ? "Got it" : "Not now"}
        </button>
      </div>
    </div>
  );
}
