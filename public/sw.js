// Service worker di Cronache del Tavolo.
//
// Volutamente minimo: NON salva in cache le pagine, perché contengono diari e schede
// private e il telefono potrebbe essere condiviso. Serve solo a rendere l'app
// installabile e a mostrare un messaggio chiaro quando manca la connessione.

const OFFLINE_HTML = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Senza connessione · Cronache del Tavolo</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif;
         background: #0c0e1d; color: #ece8f7; text-align: center; padding: 24px; box-sizing: border-box; }
  h1 { font-family: Georgia, serif; font-size: 1.6rem; margin: 0 0 .5rem; }
  p { color: #a5a2c6; max-width: 28rem; line-height: 1.5; }
  button { margin-top: 1rem; padding: .6rem 1.4rem; border-radius: 999px; border: 0; background: #e6c05c;
           color: #1c1405; font-weight: 800; font-size: 1rem; }
</style>
</head>
<body>
  <main>
    <h1>Niente connessione</h1>
    <p>Le Cronache vivono online: appena torna la rete, riprova.</p>
    <button onclick="location.reload()">Riprova</button>
  </main>
</body>
</html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  // Solo le navigazioni tra pagine: tutto il resto va in rete come sempre.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
