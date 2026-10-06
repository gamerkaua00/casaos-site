/* © 2026 Kauã Mazur dos Reis. Todos os direitos reservados. */
// Service worker do CasaOS.
//  - guarda a "casca" do app (HTML, CSS, JS, fontes, ícones) para abrir rápido e funcionar sem rede;
//  - NUNCA guarda dados: tudo que é /api/ (arquivos, fotos, login) sempre vai para a rede;
//  - recebe arquivos compartilhados de outros apps (menu Compartilhar do Android).
const VERSION = "casaos-v6";
const SHELL = [
  "./", "index.html", "style.css", "app.js", "config.js", "theme-init.js", "manifest.webmanifest",
  "fonts/bricolage.woff2", "fonts/instrument.woff2",
  "icon/icon-192.png", "icon/icon-512.png", "icon/icon-maskable-512.png", "icon/favicon-32.png", "icon/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map((u) => cache.add(u).catch(() => {}))); // um arquivo faltando (ex.: ícone) não impede a instalação
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== "casaos-share") await caches.delete(k);
    await self.clients.claim();
  })());
});

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((f) => f && f.name);
    await caches.delete("casaos-share");
    const cache = await caches.open("casaos-share");
    let i = 0;
    for (const f of files) {
      await cache.put(`share/${String(i++).padStart(4, "0")}`, new Response(f, {
        headers: { "Content-Type": f.type || "application/octet-stream", "X-Name": encodeURIComponent(f.name), "X-Mtime": String(f.lastModified || Date.now()) },
      }));
    }
    return Response.redirect(new URL(`./?share=${files.length}`, self.registration.scope).href, 303);
  } catch {
    return Response.redirect(new URL("./", self.registration.scope).href, 303);
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method === "POST" && url.pathname.endsWith("/share-target")) return e.respondWith(receiveShare(req));
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/") || url.pathname.startsWith("/s/")) return; // rede direta (dados e links públicos)

  if (req.mode === "navigate") { // página: rede primeiro (sempre a versão nova); sem rede, a cópia guardada
    e.respondWith(fetch(req).catch(async () => (await caches.match("index.html", { ignoreSearch: true })) || (await caches.match("./", { ignoreSearch: true }))));
    return;
  }
  e.respondWith((async () => { // arquivos do app: mostra o guardado e atualiza em segundo plano
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })());
});
