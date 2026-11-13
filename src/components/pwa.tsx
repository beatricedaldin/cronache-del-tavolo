"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Registra il service worker (serve per l'installazione e il messaggio "niente connessione"). */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "cronache:installa-nascosto";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Che dispositivo è, letto una volta nel browser (sul server: niente invito). */
type Device = "installed" | "ios" | "other";

function readDevice(): Device {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}
const noSubscribe = () => () => {};

/**
 * Invito a installare l'app sul telefono.
 * - Android/Chrome: bottone "Installa" (usa la richiesta del browser).
 * - iPhone/iPad: Safari non ha il bottone, quindi spieghiamo i due tocchi da fare.
 *
 * Normale (login e home): non compare se l'app è installata o se è stato chiuso.
 * `persistent` (pagina Account): c'è sempre, così chi l'ha chiuso per sbaglio lo ritrova.
 */
export function InstallHint({ persistent = false }: { persistent?: boolean }) {
  const device = useSyncExternalStore<Device>(noSubscribe, readDevice, () => "installed");
  const dismissed = useSyncExternalStore(noSubscribe, readDismissed, () => true);
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Va bene lo stesso: si richiude e basta.
    }
    setHidden(true);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === "accepted") setInstalled(true);
  }

  const isInstalled = installed || device === "installed";
  const mode = event ? "android" : device === "ios" ? "ios" : "other";

  if (!persistent && (hidden || dismissed || isInstalled || mode === "other")) return null;

  if (persistent && isInstalled) {
    return (
      <section className="panel flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- icona statica piccola */}
        <img src="/icons/icon-192.png" alt="" className="size-12 rounded-xl" />
        <p>
          <b>✓ L&apos;app è installata</b> <span className="text-muted">su questo dispositivo.</span>
        </p>
      </section>
    );
  }

  return (
    <aside className="panel flex flex-wrap items-center gap-3 border-gold" aria-label="Installa l'app">
      {/* eslint-disable-next-line @next/next/no-img-element -- icona statica piccola */}
      <img src="/icons/icon-192.png" alt="" className="size-12 rounded-xl" />
      <div className="min-w-48 flex-1">
        <p className="font-bold">Tienila sul telefono come un&apos;app</p>
        {mode === "android" && <p className="text-sm text-muted">Un tocco e la trovi tra le app, con la sua icona.</p>}
        {mode === "ios" && (
          <p className="text-sm text-muted">
            Apri il sito in <b className="text-ink">Safari</b>, tocca <b className="text-ink">Condividi</b>{" "}
            <span aria-hidden>(il quadrato con la freccia ↑)</span>, poi <b className="text-ink">Aggiungi alla schermata Home</b>.
          </p>
        )}
        {mode === "other" && (
          <ul className="list-disc pl-5 text-sm text-muted">
            <li>
              <b className="text-ink">Android:</b> in Chrome, menu ⋮ → <b className="text-ink">Installa app</b> (o «Aggiungi a schermata Home»).
            </li>
            <li>
              <b className="text-ink">iPhone:</b> in Safari, <b className="text-ink">Condividi</b> → <b className="text-ink">Aggiungi alla schermata Home</b>.
            </li>
            <li>
              <b className="text-ink">Computer:</b> in Chrome o Edge, l&apos;icona di installazione a destra nella barra degli indirizzi.
            </li>
          </ul>
        )}
        {!persistent && <p className="mt-1 text-xs text-muted">Se lo chiudi, lo ritrovi nella pagina Account.</p>}
      </div>
      <div className="flex gap-2">
        {mode === "android" && (
          <button type="button" className="btn" onClick={install}>
            Installa
          </button>
        )}
        {!persistent && (
          <button type="button" className="btn-ghost" onClick={dismiss}>
            {mode === "android" ? "Non ora" : "Ho capito"}
          </button>
        )}
      </div>
    </aside>
  );
}
