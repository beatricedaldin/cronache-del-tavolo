import type { MetadataRoute } from "next";

/** Il manifest della PWA: rende l'app installabile su Android e iPhone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cronache del Tavolo",
    short_name: "Cronache",
    description: "Schede, diario e memoria condivisa della vostra campagna di Fabula Ultima.",
    lang: "it",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0e1d",
    theme_color: "#141733",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
