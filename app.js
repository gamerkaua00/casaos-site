"use strict";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const API = (window.CASAOS_API || "").replace(/\/$/, "");
const abs = (u) => (u && u.startsWith("/") ? API + u : u);
const enc = encodeURIComponent;
const join = (a, b) => (a ? `${a}/${b}` : b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isMobile = () => matchMedia("(max-width: 800px)").matches;
const state = { me: null, view: "files", path: "", entries: [], photos: [], photosTotal: 0, photosBusy: false, lastMonth: "", grid: null, pick: "folder" };

/* ---------- ícones ---------- */
const ICONS = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  photos: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  list: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  play: '<path class="fill" d="M8 5v14l11-7z"/>',
  dots: '<circle class="fill" cx="12" cy="5" r="1.7"/><circle class="fill" cx="12" cy="12" r="1.7"/><circle class="fill" cx="12" cy="19" r="1.7"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
};
function icon(name) {
  const i = document.createElement("i"); i.className = "ico";
  i.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`; return i;
}
$$("[data-icon]").forEach((el) => el.prepend(icon(el.dataset.icon)));

/* ---------- utilidades ---------- */
function fmtSize(n) {
  if (n == null) return "";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1).replace(".", ",")} ${u[i]}`;
}
const fmtDate = (ts) => new Date(ts * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
let toastTimer;
function toast(msg, bad = false) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 4500);
}
const authHeader = () => { const t = store.get("casaos_token"); return t ? { Authorization: "Bearer " + t } : {}; };

async function api(url, opts = {}) {
  const init = { ...opts, headers: { ...authHeader(), ...(opts.headers || {}) } };
  if (opts.json !== undefined) { init.method = init.method || "POST"; init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.json); }
  let res;
  try { res = await fetch(API + url, init); }
  catch { const e = new Error("Não consegui falar com o servidor de casa. Ele pode estar desligado."); e.offline = true; throw e; }
  if (res.status === 401 && !url.includes("/auth/login")) { showLogin(); throw new Error("Sessão expirada. Entre novamente."); }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { const d = await res.json(); msg = typeof d.detail === "string" ? d.detail : "Dados inválidos."; } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return res.json();
}

/* ---------- preferências do perfil ---------- */
function applyPrefs(p) {
  const r = document.documentElement, t = p.theme || "auto";
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  r.dataset.mode = dark ? "dark" : "light"; r.dataset.accent = p.accent || "cobalto"; r.dataset.photo = p.photo_size || "medium";
  store.set("casaos_prefs", JSON.stringify(p));
  syncThemeColor();
}
function syncThemeColor() { // cor da barra de status do celular acompanha o tema
  const m = document.querySelector('meta[name="theme-color"]'); if (!m) return;
  const v = getComputedStyle(document.documentElement).getPropertyValue($("#app")?.hidden === false ? "--surface" : "--hero").trim();
  if (v) m.setAttribute("content", v);
}
const prefsNow = () => state.me?.settings || JSON.parse(store.get("casaos_prefs") || "{}");
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyPrefs(prefsNow()));

function setMe(me) {
  state.me = me; applyPrefs(me.settings);
  const shown = me.display_name || me.username;
  $("#me-name").textContent = shown;
  const { used_bytes: used, quota_bytes: quota } = me, fill = $("#meter-fill");
  let txt;
  if (used == null) { txt = "Armazenamento offline"; fill.style.width = "0"; }
  else if (quota) { const pct = Math.min(100, (used / quota) * 100); fill.style.width = pct + "%"; fill.classList.toggle("full", pct >= 90); txt = `${fmtSize(used)} de ${fmtSize(quota)}`; }
  else { fill.style.width = "0"; txt = `${fmtSize(used)} usados · sem limite`; }
  $("#meter-text").textContent = txt;
  $("#chip-text").textContent = used == null ? "offline" : quota ? `${fmtSize(used)} / ${fmtSize(quota)}` : fmtSize(used);
}
async function refreshMe() { try { setMe(await api("/api/auth/me")); if (state.view === "profile") renderProfile(); } catch {} }

/* ---------- entrada (com status do servidor de casa) ---------- */
let healthTimer;
async function checkHealth() {
  const dot = $("#dot"), title = $("#hero-title"), detail = $("#hero-detail");
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000);
    const h = await (await fetch(API + "/api/health", { signal: ctl.signal })).json(); clearTimeout(t);
    if (store.get("casaos_token") && !$("#login").hidden) setTimeout(boot, 0); // servidor voltou: entra sozinho
    if (h.storage_online) { dot.className = "dot on"; title.textContent = "Servidor de casa online."; detail.textContent = "Seus arquivos ficam no disco de casa, não no de ninguém."; }
    else { dot.className = "dot disk"; title.textContent = "O disco de casa está desconectado."; detail.textContent = "O servidor está ligado, mas o armazenamento não. Você consegue entrar, só não vai ver os arquivos até reconectar."; }
  } catch { dot.className = "dot"; title.textContent = "Servidor de casa desligado."; detail.textContent = "O notebook está desligado ou sem internet. Tentando de novo a cada poucos segundos."; }
}
function showLogin(keepToken = false) {
  state.me = null; if (!keepToken) store.del("casaos_token"); // servidor desligado não é motivo para perder o login
  $("#app").hidden = true; $("#login").hidden = false; $("#login-form").password.value = ""; syncThemeColor();
  checkHealth(); clearInterval(healthTimer); healthTimer = setInterval(checkHealth, 15000);
}
async function boot() {
  applyPrefs(prefsNow());
  if (!store.get("casaos_token")) return showLogin();
  try { setMe(await api("/api/auth/me")); enterApp(); } catch (e) { if (e.offline) showLogin(true); }
}
function enterApp() {
  clearInterval(healthTimer);
  $("#login").hidden = true; $("#app").hidden = false; syncThemeColor();
  $("#nav-admin").hidden = !state.me.is_admin;
  state.path = "";
  const q = new URLSearchParams(location.search), v = q.get("view"); // atalhos do ícone: ?view=photos
  setView(["files", "photos", "trash", "profile"].includes(v) || (v === "admin" && state.me.is_admin) ? v : "files");
  if (q.has("share")) handleShared();
  if (q.has("view") || q.has("share")) history.replaceState(null, "", location.pathname);
  renderInstall();
}
$("#login-form").onsubmit = async (e) => {
  e.preventDefault(); $("#login-error").textContent = "";
  const f = e.target, btn = f.querySelector("button"); btn.disabled = true;
  try {
    const r = await api("/api/auth/login", { json: { username: f.username.value, password: f.password.value } });
    store.set("casaos_token", r.token); setMe(r.user); enterApp();
  } catch (err) { $("#login-error").textContent = err.message; }
  btn.disabled = false;
};
async function logout() { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); showLogin(); }
$("#btn-logout").onclick = logout;
$("#btn-logout-rail").onclick = logout;

/* ---------- diálogos: pergunta, menu (computador) e folha (celular) ---------- */
function ask(title, value = "", type = "text") {
  return new Promise((resolve) => {
    const dlg = $("#ask"), input = $("#ask-input");
    $("#ask-title").textContent = title; input.type = type; input.value = value;
    const done = (v) => { dlg.close(); $("#ask-form").onsubmit = null; $("#ask-cancel").onclick = null; dlg.oncancel = null; resolve(v); };
    $("#ask-form").onsubmit = (e) => { e.preventDefault(); done(input.value.trim()); };
    $("#ask-cancel").onclick = () => done(null);
    dlg.oncancel = () => done(null);
    dlg.showModal(); input.focus(); input.select();
  });
}
let openMenuEl = null;
function closeMenu() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; } if ($("#sheet").open) $("#sheet").close(); }
function openActions(anchor, title, actions) { // actions: [rótulo, ícone, função, classe]
  closeMenu();
  if (isMobile()) {
    $("#sheet-title").textContent = title || ""; const body = $("#sheet-body"); body.replaceChildren();
    for (const [label, ic, fn, cls] of actions) {
      const b = document.createElement("button"); b.className = "sheet-btn" + (cls ? " " + cls : "");
      b.append(icon(ic), document.createTextNode(label)); b.onclick = () => { $("#sheet").close(); fn(); }; body.append(b);
    }
    $("#sheet").showModal(); return;
  }
  const m = document.createElement("div"); m.className = "menu"; m.setAttribute("role", "menu");
  for (const [label, ic, fn, cls] of actions) {
    const b = document.createElement("button"); b.setAttribute("role", "menuitem"); if (cls) b.className = cls;
    b.append(icon(ic), document.createTextNode(label)); b.onclick = () => { closeMenu(); fn(); }; m.append(b);
  }
  document.body.append(m); openMenuEl = m;
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8)) + "px";
  m.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + "px";
  m.querySelector("button").focus();
}
$("#sheet").addEventListener("click", (e) => { if (e.target === $("#sheet")) $("#sheet").close(); });
document.addEventListener("click", (e) => { if (openMenuEl && !openMenuEl.contains(e.target) && !e.target.closest(".more")) closeMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

/* ---------- navegação ---------- */
function setView(v) {
  state.view = v; closeMenu();
  $$("main > section").forEach((s) => (s.hidden = s.id !== "view-" + v));
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  $("#fab").hidden = !(v === "files" || v === "photos");
  window.scrollTo(0, 0);
  if (v === "files") loadDir(state.path);
  if (v === "photos") resetPhotos();
  if (v === "trash") loadTrash();
  if (v === "profile") { renderProfile(); refreshMe(); }
  if (v === "admin") loadAdmin();
}
$$(".nav-btn").forEach((b) => (b.onclick = () => setView(b.dataset.view)));
$("#chip").onclick = () => setView("profile");

/* ---------- arquivos ---------- */
const MEDIA = ["image", "video", "audio"];
function sortEntries(list) {
  const k = prefsNow().files_sort || "name";
  const cmp = { name: (a, b) => a.name.localeCompare(b.name, "pt", { numeric: true, sensitivity: "base" }), date: (a, b) => b.modified - a.modified, size: (a, b) => (b.size || 0) - (a.size || 0) }[k];
  return [...list].sort((a, b) => (a.is_dir !== b.is_dir ? (a.is_dir ? -1 : 1) : cmp(a, b)));
}
async function loadDir(path) {
  try {
    const d = await api(`/api/files?path=${enc(path)}`);
    state.path = d.path; state.entries = d.entries; renderCrumbs(); renderEntries();
  } catch (err) { if (err.status === 404 && path) return loadDir(""); toast(err.message, true); }
  refreshMe();
}
function renderCrumbs() {
  const nav = $("#crumbs"); nav.replaceChildren();
  const parts = state.path ? state.path.split("/") : [];
  const add = (label, path, last) => { const b = document.createElement("button"); b.textContent = label; if (last) b.setAttribute("aria-current", "page"); else b.onclick = () => loadDir(path); nav.append(b); };
  add("Meus arquivos", "", parts.length === 0);
  let acc = "";
  parts.forEach((p, i) => { const s = document.createElement("span"); s.className = "sep"; s.textContent = "/"; nav.append(s); acc = join(acc, p); add(p, acc, i === parts.length - 1); });
  $("#folder-title").textContent = parts.length ? parts[parts.length - 1] : "Meus arquivos";
  const back = $("#back-btn"); back.hidden = parts.length === 0;
  back.onclick = () => loadDir(parts.slice(0, -1).join("/"));
}
function thumbFor(e) {
  const t = document.createElement("span"); t.className = "thumb";
  if (e.thumb) { const img = document.createElement("img"); img.loading = "lazy"; img.alt = ""; img.src = abs(e.thumb); t.append(img); }
  else t.append(icon({ folder: "folder", video: "play", audio: "music" }[e.kind] || "file"));
  return t;
}
function renderEntries() {
  const p = prefsNow(), mode = p.files_view === "tiles" ? "tiles" : "list";
  const ul = $("#list"); ul.replaceChildren(); ul.className = "list " + (mode === "tiles" ? "tiles" : "rows");
  $("#mode-list").setAttribute("aria-pressed", mode === "list"); $("#mode-tiles").setAttribute("aria-pressed", mode === "tiles");
  $("#sort").value = p.files_sort || "name";
  $("#empty").hidden = state.entries.length > 0; ul.hidden = state.entries.length === 0;
  const sorted = sortEntries(state.entries), media = sorted.filter((e) => MEDIA.includes(e.kind));
  for (const e of sorted) {
    const path = join(state.path, e.name);
    const li = document.createElement("li"); li.className = mode === "tiles" ? "tile" : "row";
    const open = document.createElement("button"); open.className = "open";
    const txt = document.createElement("span"); txt.className = "txt";
    const name = document.createElement("b"); name.textContent = e.name; txt.append(name);
    if (mode === "list") { const sub = document.createElement("span"); sub.className = "sub"; sub.textContent = e.is_dir ? fmtDate(e.modified) : [fmtSize(e.size), fmtDate(e.modified)].join(" · "); txt.append(sub); }
    open.append(thumbFor(e), txt);
    open.onclick = () => (e.is_dir ? loadDir(path) : MEDIA.includes(e.kind) ? openViewer(media, media.indexOf(e)) : download(e));
    const more = document.createElement("button"); more.className = "more"; more.setAttribute("aria-label", `Ações para ${e.name}`); more.append(icon("dots"));
    more.onclick = () => openActions(more, e.name, [
      ...(e.is_dir ? [] : [["Baixar", "download", () => download(e)]]),
      ["Renomear", "edit", () => renameEntry(e, path)],
      ["Mover para a lixeira", "trash", () => removeEntry(e, path), "danger"],
    ]);
    li.append(open, more); ul.append(li);
  }
}
function download(e) { const a = document.createElement("a"); a.href = abs(e.dl); a.download = e.name; document.body.append(a); a.click(); a.remove(); }
async function renameEntry(e, path) {
  const name = await ask("Novo nome", e.name); if (!name || name === e.name) return;
  try { await api("/api/files/rename", { json: { path, new_name: name } }); loadDir(state.path); } catch (err) { toast(err.message, true); }
}
async function removeEntry(e, path) {
  try { await api(`/api/files?path=${enc(path)}`, { method: "DELETE" }); toast(`“${e.name}” foi para a lixeira.`); loadDir(state.path); } catch (err) { toast(err.message, true); }
}
async function newFolder() {
  const name = await ask("Nome da nova pasta"); if (!name) return;
  try { await api("/api/files/folder", { json: { path: state.path, name } }); loadDir(state.path); } catch (err) { toast(err.message, true); }
}
$("#btn-folder").onclick = newFolder;
$("#mode-list").onclick = () => saveSetting("files_view", "list");
$("#mode-tiles").onclick = () => saveSetting("files_view", "tiles");
$("#sort").onchange = (e) => saveSetting("files_sort", e.target.value);

/* ---------- envio: pequenos em lote, grandes em partes com retomada ---------- */
const up = { active: false, cancel: false, xhr: null, wake: null };
const BIG = 8 * 1024 * 1024;
function xhrSend(method, url, body, { headers = {}, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); up.xhr = x;
    x.open(method, API + url);
    for (const [k, v] of Object.entries({ ...authHeader(), ...headers })) x.setRequestHeader(k, v);
    if (onProgress) x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    x.onload = () => {
      let data = null; try { data = JSON.parse(x.responseText); } catch {}
      if (x.status >= 200 && x.status < 300) return resolve(data);
      const err = new Error(data && typeof data.detail === "string" ? data.detail : `Erro ${x.status}`); err.status = x.status; reject(err);
    };
    x.onerror = () => { const e = new Error("Sem conexão com o servidor de casa."); e.offline = true; reject(e); };
    x.onabort = () => { const e = new Error("Cancelado"); e.aborted = true; reject(e); };
    x.send(body);
  });
}
const showUp = (text, frac) => { $("#upbar").hidden = false; $("#up-text").textContent = text; $("#up-fill").style.width = Math.round(frac * 100) + "%"; };
async function keepAwake(on) { try { if (on) up.wake = await navigator.wakeLock?.request("screen"); else { await up.wake?.release(); up.wake = null; } } catch {} }
window.addEventListener("beforeunload", (e) => { if (up.active) { e.preventDefault(); e.returnValue = ""; } });
$("#up-cancel").onclick = () => { up.cancel = true; up.xhr?.abort(); };

async function putChunk(id, offset, blob, onProgress) {
  let tries = 0;
  for (;;) {
    try { return (await xhrSend("PUT", `/api/uploads/${id}?offset=${offset}`, blob, { headers: { "Content-Type": "application/octet-stream" }, onProgress })).offset; }
    catch (e) {
      if (e.aborted || up.cancel) throw e;
      if (e.status === 409) return (await api(`/api/uploads/${id}`)).offset; // o servidor diz onde parou
      if (e.status && e.status < 500 && e.status !== 408) throw e;           // erro definitivo
      if (++tries > 8) throw e;
      $("#up-text").textContent = "Conexão instável, tentando de novo…";
      await sleep(Math.min(1000 * 2 ** tries, 15000));
      try { return (await api(`/api/uploads/${id}`)).offset; } catch {}
    }
  }
}
async function sendChunked(f, path, onBytes) {
  const key = ["casaos_up", state.me.username, path, f.name, f.size, f.lastModified].join("|");
  let id = store.get(key), offset = 0, chunk = BIG;
  if (id) { try { const st = await api(`/api/uploads/${id}`); offset = st.offset; chunk = st.chunk_size || chunk; } catch { id = null; store.del(key); } } // retoma de onde parou
  if (!id) { const r = await api("/api/uploads", { json: { path, name: f.name, size: f.size, mtime: f.lastModified || null } }); id = r.id; chunk = r.chunk_size; store.set(key, id); }
  try {
    while (offset < f.size) {
      if (up.cancel) { const e = new Error("Cancelado"); e.aborted = true; throw e; }
      const base = offset;
      offset = await putChunk(id, base, f.slice(base, Math.min(base + chunk, f.size)), (l) => onBytes(base + l));
    }
    await api(`/api/uploads/${id}/finish`, { method: "POST" });
    store.del(key);
  } catch (e) {
    if (e.aborted || up.cancel) { api(`/api/uploads/${id}`, { method: "DELETE" }).catch(() => {}); store.del(key); }
    else if (e.status === 404) store.del(key);
    throw e;
  }
}
async function uploadFiles(files, path, after) {
  files = [...files]; if (!files.length) return;
  if (up.active) return toast("Já existe um envio em andamento.", true);
  up.active = true; up.cancel = false;
  const total = files.reduce((s, f) => s + f.size, 0) || 1, t0 = Date.now();
  let done = 0, count = 0;
  const report = (extra = 0) => {
    const cur = done + extra, sec = Math.max(1, (Date.now() - t0) / 1000);
    showUp(`${Math.min(count + 1, files.length)} de ${files.length} · ${fmtSize(cur)} de ${fmtSize(total)} · ${fmtSize(cur / sec)}/s`, Math.min(1, cur / total));
  };
  keepAwake(true); report();
  try {
    let batch = [], bytes = 0;
    const flush = async () => {
      if (!batch.length) return;
      const fd = new FormData(); fd.append("mtimes", JSON.stringify(batch.map((f) => f.lastModified || 0)));
      batch.forEach((f) => fd.append("files", f, f.name));
      const base = done, size = bytes;
      await xhrSend("POST", `/api/files/upload?path=${enc(path)}`, fd, { onProgress: (l) => report(Math.min(l, size)) });
      done = base + size; count += batch.length; batch = []; bytes = 0; report();
    };
    for (const f of files.filter((f) => f.size < BIG)) { batch.push(f); bytes += f.size; if (bytes >= 24 * 1024 * 1024 || batch.length >= 20) await flush(); }
    await flush();
    for (const f of files.filter((f) => f.size >= BIG)) { const base = done; await sendChunked(f, path, (l) => report(l)); done = base + f.size; count++; report(); }
    toast(`${files.length} arquivo(s) enviado(s).`);
  } catch (e) {
    if (e.aborted || up.cancel) toast("Envio cancelado.");
    else if (e.status === 401) showLogin();
    else toast(`${e.message}${count ? ` (${count} já enviado(s))` : ""}`, true);
  } finally { up.active = false; up.xhr = null; keepAwake(false); $("#upbar").hidden = true; if (after) after(); }
}
function pick(inputId, target) { state.pick = target; $("#" + inputId).click(); }
async function uploadToPhotos(files) {
  const folder = prefsNow().photo_folder || "Fotos";
  try { await api("/api/files/folder", { json: { path: "", name: folder } }); } catch (e) { if (e.status !== 409) return toast(e.message, true); }
  uploadFiles(files, folder, () => (state.view === "photos" ? resetPhotos() : refreshMe()));
}
for (const id of ["file-input", "photo-input", "camera-input"]) {
  $("#" + id).onchange = (e) => {
    const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
    if (state.pick === "photos") uploadToPhotos(files); else uploadFiles(files, state.path, () => loadDir(state.path));
  };
}
$("#btn-upload").onclick = () => pick("file-input", "folder");
$("#btn-photo-upload").onclick = () => pick("photo-input", "photos");
$("#fab").onclick = () => {
  if (state.view === "photos") openActions($("#fab"), "Adicionar", [
    ["Enviar fotos e vídeos", "photos", () => pick("photo-input", "photos")], ["Tirar foto", "camera", () => pick("camera-input", "photos")]]);
  else openActions($("#fab"), "Adicionar", [
    ["Enviar arquivos", "upload", () => pick("file-input", "folder")], ["Enviar fotos e vídeos", "photos", () => pick("photo-input", "folder")],
    ["Tirar foto", "camera", () => pick("camera-input", "folder")], ["Nova pasta", "plus", newFolder]]);
};
const dz = $("#dropzone");
["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", (e) => uploadFiles(e.dataTransfer.files, state.path, () => loadDir(state.path)));

/* ---------- fotos ---------- */
const photoIO = new IntersectionObserver((en) => { if (en[0].isIntersecting) loadPhotos(); }, { rootMargin: "800px" });
function resetPhotos() { state.photos = []; state.photosTotal = 0; state.lastMonth = ""; state.grid = null; $("#mosaic").replaceChildren(); $("#photos-empty").hidden = true; loadPhotos(true); }
async function loadPhotos(first = false) {
  if (state.photosBusy || (!first && state.photos.length >= state.photosTotal)) return;
  state.photosBusy = true; $("#sentinel").hidden = false;
  try {
    const d = await api(`/api/files/photos?offset=${state.photos.length}&limit=120`);
    state.photosTotal = d.total;
    for (const it of d.items) { state.photos.push(it); addShot(it, state.photos.length - 1); }
    $("#photos-empty").hidden = state.photosTotal > 0;
  } catch (err) { toast(err.message, true); }
  state.photosBusy = false; $("#sentinel").hidden = state.photos.length >= state.photosTotal;
  if (state.photos.length < state.photosTotal) photoIO.observe($("#sentinel")); else photoIO.unobserve($("#sentinel"));
}
function addShot(it, idx) {
  let month = new Date(it.modified * 1000).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  month = month.charAt(0).toUpperCase() + month.slice(1);
  if (month !== state.lastMonth) {
    const h = document.createElement("h3"); h.className = "month"; h.textContent = month;
    state.grid = document.createElement("div"); state.grid.className = "mosaic-grid"; $("#mosaic").append(h, state.grid); state.lastMonth = month;
  }
  const b = document.createElement("button"); b.className = "shot"; b.setAttribute("aria-label", it.name);
  if (it.kind === "image") { const img = document.createElement("img"); img.loading = "lazy"; img.alt = ""; img.src = abs(it.thumb || it.view); b.append(img); }
  else {
    const v = document.createElement("video"); v.muted = true; v.preload = "metadata"; v.playsInline = true; v.src = abs(it.view) + "#t=0.1"; b.append(v);
    const badge = document.createElement("span"); badge.className = "badge"; badge.append(icon("play")); b.append(badge);
  }
  b.onclick = () => openViewer(state.photos, idx);
  state.grid.append(b);
}

/* ---------- visualizador (HEIC aparece convertido) ---------- */
let pv = { items: [], i: 0 };
function openViewer(items, i) { pv = { items, i: Math.max(0, i) }; showViewer(); $("#preview").showModal(); }
function showViewer() {
  const it = pv.items[pv.i], body = $("#pv-body"); body.replaceChildren();
  const el = document.createElement(it.kind === "image" ? "img" : it.kind === "video" ? "video" : "audio");
  if (it.kind === "image") { el.src = abs(it.large || it.view); el.alt = it.name; }
  else { el.src = abs(it.view); el.controls = true; el.autoplay = !!prefsNow().autoplay; if (it.kind === "video") el.playsInline = true; }
  body.append(el);
  $("#pv-name").textContent = it.name; $("#pv-count").textContent = pv.items.length > 1 ? `${pv.i + 1} / ${pv.items.length}` : "";
  const dl = $("#pv-download"); dl.href = abs(it.dl); dl.download = it.name;
  $("#pv-prev").hidden = pv.i === 0; $("#pv-next").hidden = pv.i === pv.items.length - 1;
}
function step(d) { const n = pv.i + d; if (n >= 0 && n < pv.items.length) { pv.i = n; showViewer(); } }
$("#pv-prev").onclick = () => step(-1); $("#pv-next").onclick = () => step(1); $("#pv-close").onclick = () => $("#preview").close();
$("#preview").addEventListener("close", () => $("#pv-body").replaceChildren());
$("#preview").addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); });
(() => { let x0 = null; const el = $("#preview");
  el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); });
})();

/* ---------- lixeira ---------- */
async function loadTrash() {
  try {
    const d = await api("/api/trash");
    $("#trash-note").textContent = `Os itens ficam aqui por ${d.days} dias e depois são apagados de vez. Eles contam no seu espaço.`;
    const ul = $("#trash-list"); ul.replaceChildren();
    $("#trash-empty").hidden = d.items.length > 0; ul.hidden = d.items.length === 0; $("#btn-empty").hidden = d.items.length === 0;
    for (const t of d.items) {
      const li = document.createElement("li"); li.className = "row";
      const info = document.createElement("div"); info.className = "open";
      const th = document.createElement("span"); th.className = "thumb"; th.append(icon(t.is_dir ? "folder" : "file"));
      const col = document.createElement("span"); col.className = "txt";
      const nm = document.createElement("b"); nm.textContent = t.name;
      const sub = document.createElement("span"); sub.className = "sub"; sub.textContent = `${fmtSize(t.size)} · apaga em ${t.days_left} dia(s)`;
      col.append(nm, sub); info.append(th, col);
      const more = document.createElement("button"); more.className = "more"; more.setAttribute("aria-label", `Ações para ${t.name}`); more.append(icon("dots"));
      more.onclick = () => openActions(more, t.name, [
        ["Restaurar", "back", async () => { try { const r = await api(`/api/trash/${t.id}/restore`, { method: "POST" }); toast(`Restaurado em /${r.path}`); loadTrash(); refreshMe(); } catch (e) { toast(e.message, true); loadTrash(); } }],
        ["Excluir de vez", "trash", async () => { if (!confirm(`Excluir “${t.name}” definitivamente?`)) return; try { await api(`/api/trash/${t.id}`, { method: "DELETE" }); loadTrash(); refreshMe(); } catch (e) { toast(e.message, true); } }, "danger"],
      ]);
      li.append(info, more); ul.append(li);
    }
  } catch (err) { toast(err.message, true); }
}
$("#btn-empty").onclick = async () => {
  if (!confirm("Esvaziar a lixeira? Isso apaga tudo dela de vez.")) return;
  try { await api("/api/trash", { method: "DELETE" }); loadTrash(); refreshMe(); } catch (e) { toast(e.message, true); }
};

/* ---------- perfil e configurações ---------- */
async function saveSetting(key, val) {
  try {
    setMe(await api("/api/auth/settings", { method: "PATCH", json: { [key]: val } }));
    if (state.view === "profile") renderProfile();
    if (state.view === "files") renderEntries();
  } catch (e) { toast(e.message, true); if (state.view === "profile") renderProfile(); }
}
function renderProfile() {
  const me = state.me; if (!me) return; const s = me.settings, shown = me.display_name || me.username;
  $("#avatar").textContent = shown.trim().charAt(0).toUpperCase();
  $("#p-name").value = me.display_name; $("#p-name").placeholder = me.username;
  $("#p-user").textContent = `@${me.username}${me.is_admin ? " · administrador" : ""}`;
  const box = $("#p-usage"); box.replaceChildren();
  const line = document.createElement("div"); line.className = "use-line";
  const big = document.createElement("b"); big.textContent = me.used_bytes == null ? "Offline" : `${fmtSize(me.used_bytes)} usados`;
  const of = document.createElement("span"); of.className = "muted";
  of.textContent = me.quota_bytes ? `de ${fmtSize(me.quota_bytes)} (${Math.min(100, Math.round(((me.used_bytes || 0) / me.quota_bytes) * 100))}%)` : "sem limite de espaço";
  line.append(big, of); box.append(line);
  if (me.quota_bytes) { const bar = document.createElement("div"); bar.className = "meter-bar"; bar.style.margin = "10px 0"; const sp = document.createElement("span"); sp.style.width = Math.min(100, ((me.used_bytes || 0) / me.quota_bytes) * 100) + "%"; bar.append(sp); box.append(bar); }
  const lim = document.createElement("div"); lim.className = "small muted";
  lim.textContent = `Tamanho máximo por arquivo: ${me.max_file_bytes ? fmtSize(me.max_file_bytes) : "sem limite"} · A lixeira conta no espaço.`; box.append(lim);
  $$("[data-setting]").forEach((g) => { const k = g.dataset.setting; g.querySelectorAll("button[data-val]").forEach((b) => b.setAttribute("aria-pressed", String(s[k] === b.dataset.val))); });
  $("#p-folder").value = s.photo_folder; $("#p-autoplay").checked = !!s.autoplay;
}
$("#view-profile").addEventListener("click", (e) => { const b = e.target.closest("[data-setting] button[data-val]"); if (b) saveSetting(b.closest("[data-setting]").dataset.setting, b.dataset.val); });
$("#p-autoplay").onchange = (e) => saveSetting("autoplay", e.target.checked);
$("#p-folder").onchange = (e) => saveSetting("photo_folder", e.target.value.trim());
$("#p-name").onchange = async (e) => {
  try { setMe(await api("/api/auth/settings", { method: "PATCH", json: { display_name: e.target.value } })); renderProfile(); toast("Nome salvo."); } catch (err) { toast(err.message, true); }
};
$("#btn-password").onclick = async () => {
  const current = await ask("Senha atual", "", "password"); if (!current) return;
  const nw = await ask("Nova senha (mínimo 8 caracteres)", "", "password"); if (!nw) return;
  try { await api("/api/auth/password", { json: { current, new: nw } }); toast("Senha alterada."); } catch (err) { toast(err.message, true); }
};
$("#btn-logout-others").onclick = async () => {
  try { const r = await api("/api/auth/logout-others", { method: "POST" }); toast(r.removed ? `${r.removed} aparelho(s) desconectado(s).` : "Não há outros aparelhos conectados."); } catch (e) { toast(e.message, true); }
};

/* ---------- administração ---------- */
const ACTION_LABEL = {
  login: "Entrou", login_falhou: "Tentativa de login falhou", login_bloqueado: "Login de conta bloqueada", senha_alterada: "Trocou a própria senha",
  senha_redefinida: "Senha redefinida", usuario_criado: "Usuário criado", usuario_bloqueado: "Usuário bloqueado", usuario_desbloqueado: "Usuário desbloqueado",
  usuario_removido: "Usuário removido", limite_alterado: "Espaço alterado", limite_removido: "Limite de espaço removido",
  limite_arquivo_alterado: "Limite por arquivo alterado", limite_arquivo_removido: "Limite por arquivo removido", upload: "Enviou arquivos",
  pasta_criada: "Criou pasta", renomeado: "Renomeou", enviado_para_lixeira: "Mandou para a lixeira", restaurado: "Restaurou da lixeira",
  excluido_definitivamente: "Excluiu de vez", lixeira_esvaziada: "Esvaziou a lixeira", sessoes_encerradas: "Saiu dos outros aparelhos",
  migracao_iniciada: "Migração iniciada", migracao_concluida: "Migração concluída", migracao_cancelada: "Migração cancelada", migracao_falhou: "Migração falhou",
};
async function loadAdmin() {
  let st, users, logs;
  try { [st, users, logs] = await Promise.all([api("/api/admin/storage"), api("/api/admin/users"), api("/api/admin/logs?limit=80")]); } catch (e) { return toast(e.message, true); }
  const card = $("#storage-card"); card.replaceChildren();
  const head = document.createElement("div");
  const pill = document.createElement("span"); pill.className = "pill" + (st.online ? "" : " off"); pill.textContent = st.online ? "Disponível" : "Offline";
  const path = document.createElement("code"); path.textContent = "  " + st.path; head.append(pill, path); card.append(head);
  if (st.online) {
    const stat = document.createElement("div"); stat.className = "stat";
    [["Total do disco", fmtSize(st.total)], ["Livre no disco", fmtSize(st.free)], ["Usado pela nuvem", fmtSize(st.used_by_cloud)], ["Usuários", st.users]].forEach(([k, v]) => {
      const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span"); b.textContent = v; s.className = "muted small"; s.textContent = k; d.append(b, s); stat.append(d);
    }); card.append(stat);
  } else { const p = document.createElement("p"); p.className = "muted"; p.textContent = "Os arquivos não foram perdidos. Reconecte o disco; novos envios ficam bloqueados até lá."; card.append(p); }
  renderUsers(users); renderLogs(logs); migPoll();
}
function renderUsers(users) {
  const box = $("#users"); box.replaceChildren();
  for (const u of users) {
    const c = document.createElement("div"); c.className = "ucard";
    const head = document.createElement("div"); head.className = "ucard-head";
    const nm = document.createElement("b"); nm.textContent = u.display_name ? `${u.display_name} (@${u.username})` : u.username; head.append(nm);
    const tags = document.createElement("span"); tags.className = "small muted";
    tags.textContent = [u.is_admin ? "admin" : "", u.is_blocked ? "bloqueado" : ""].filter(Boolean).join(" · "); head.append(tags); c.append(head);
    const use = document.createElement("div"); use.className = "small";
    use.textContent = `${u.used_bytes == null ? "—" : fmtSize(u.used_bytes)} de ${u.quota_bytes ? fmtSize(u.quota_bytes) : "espaço ilimitado"} · por arquivo: ${u.max_file_bytes ? fmtSize(u.max_file_bytes) : "sem limite"}`; c.append(use);
    if (u.quota_bytes && u.used_bytes != null) { const bar = document.createElement("div"); bar.className = "meter-bar"; const sp = document.createElement("span"); sp.style.width = Math.min(100, (u.used_bytes / u.quota_bytes) * 100) + "%"; bar.append(sp); c.append(bar); }
    const acts = document.createElement("div"); acts.className = "actions";
    const patch = (body) => api(`/api/admin/users/${u.id}`, { method: "PATCH", json: body }).then(loadAdmin).catch((e) => ($("#user-error").textContent = e.message));
    const mk = (label, fn, cls) => { const b = document.createElement("button"); b.textContent = label; b.onclick = fn; if (cls) b.className = cls; return b; };
    const gb = (v) => (v ? String(+(v / 1024 ** 3).toFixed(2)) : "");
    acts.append(
      mk("Senha", async () => { const p = await ask(`Nova senha para ${u.username}`, "", "password"); if (p) patch({ password: p }); }),
      mk("Espaço", async () => { const v = await ask("Espaço em GB (vazio ou 0 = sem limite)", gb(u.quota_bytes)); if (v === null) return; const n = parseFloat(v.replace(",", ".")); patch(!n ? { clear_quota: true } : { quota_gb: n }); }),
      mk("Por arquivo", async () => { const v = await ask("Tamanho máximo por arquivo em GB (vazio ou 0 = sem limite)", gb(u.max_file_bytes)); if (v === null) return; const n = parseFloat(v.replace(",", ".")); patch(!n ? { clear_max_file: true } : { max_file_gb: n }); }),
    );
    if (u.id !== state.me.id) acts.append(
      mk(u.is_blocked ? "Desbloquear" : "Bloquear", () => patch({ is_blocked: !u.is_blocked })),
      mk("Remover", () => { if (!confirm(`Remover ${u.username}? Os arquivos vão para a pasta .removidos do armazenamento, nada é apagado.`)) return; api(`/api/admin/users/${u.id}`, { method: "DELETE" }).then(loadAdmin).catch((e) => ($("#user-error").textContent = e.message)); }, "danger"),
    );
    c.append(acts); box.append(c);
  }
}
function renderLogs(logs) {
  const box = $("#logs"); box.replaceChildren();
  for (const l of logs) {
    const r = document.createElement("div"); r.className = "logrow";
    const a = document.createElement("span"); const b = document.createElement("b"); b.textContent = ACTION_LABEL[l.action] || l.action; a.append(b, document.createTextNode(l.detail ? ` · ${l.detail}` : ""));
    const m = document.createElement("span"); m.className = "small muted";
    m.textContent = [l.username || "—", new Date(l.ts.replace(" ", "T") + "Z").toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), l.ip].filter(Boolean).join(" · ");
    r.append(a, m); box.append(r);
  }
}
$("#user-form").onsubmit = async (e) => {
  e.preventDefault(); $("#user-error").textContent = "";
  const f = e.target, q = parseFloat(f.quota.value), m = parseFloat(f.maxfile.value);
  try {
    await api("/api/admin/users", { json: { username: f.username.value, password: f.password.value, quota_gb: isNaN(q) ? null : q, max_file_gb: isNaN(m) ? null : m, is_admin: f.is_admin.checked } });
    f.reset(); loadAdmin();
  } catch (err) { $("#user-error").textContent = err.message; }
};

/* ---------- migração de armazenamento (SSD -> HD) ---------- */
let migOk = false, migTimer = null, migWasActive = false;
function renderMig(st) {
  const active = st.state === "running" || st.state === "verifying";
  $("#mig-progress").hidden = st.state === "idle" || !st.state;
  const frac = st.bytes_total ? st.bytes_done / st.bytes_total : st.state === "done" ? 1 : 0;
  $("#mig-fill").style.width = Math.round(frac * 100) + "%";
  let t = st.message || "";
  if (active && st.files_total) t += ` ${st.files_done} de ${st.files_total} arquivos · ${fmtSize(st.bytes_done)} de ${fmtSize(st.bytes_total)}${st.current ? ` · ${st.current}` : ""}`;
  $("#mig-text").textContent = t;
  $("#mig-cancel").hidden = !active; $("#mig-check").disabled = active; $("#mig-start").disabled = active || !migOk;
  if (active) $("#migrate").open = true;
}
async function migPoll() {
  clearTimeout(migTimer);
  try {
    const st = await api("/api/admin/storage/migration"); renderMig(st);
    const active = st.state === "running" || st.state === "verifying";
    if (active) { migWasActive = true; migTimer = setTimeout(migPoll, 1500); }
    else if (migWasActive) { migWasActive = false; toast(st.state === "done" ? "Migração concluída." : st.message, st.state !== "done"); loadAdmin(); }
  } catch {}
}
$("#mig-path").oninput = () => { migOk = false; $("#mig-start").disabled = true; };
$("#mig-check").onclick = async () => {
  const ul = $("#mig-problems"); ul.replaceChildren(); migOk = false; $("#mig-start").disabled = true;
  try {
    const r = await api("/api/admin/storage/check", { json: { path: $("#mig-path").value.trim(), verify: $("#mig-verify").value } });
    if (r.ok) {
      const li = document.createElement("li"); li.className = "ok";
      li.textContent = `Tudo certo: ${r.files ?? 0} arquivo(s), ${fmtSize(r.needed)} a copiar, ${fmtSize(r.free)} livres no destino.${r.resume ? " Há uma cópia anterior, que será continuada." : ""}`;
      ul.append(li); migOk = true; $("#mig-start").disabled = false;
    } else r.problems.forEach((p) => { const li = document.createElement("li"); li.textContent = p; ul.append(li); });
  } catch (e) { toast(e.message, true); }
};
$("#mig-start").onclick = async () => {
  if (!confirm("Iniciar a transferência? Enquanto copia, ninguém consegue enviar ou apagar arquivos. Os arquivos do local antigo não serão apagados.")) return;
  try { renderMig(await api("/api/admin/storage/migrate", { json: { path: $("#mig-path").value.trim(), verify: $("#mig-verify").value } })); migWasActive = true; migPoll(); }
  catch (e) { toast(e.message, true); }
};
$("#mig-cancel").onclick = async () => { if (confirm("Cancelar a transferência? Nada será trocado; o local antigo continua em uso.")) await api("/api/admin/storage/migration/cancel", { method: "POST" }).catch(() => {}); };

/* ---------- app instalável (PWA) ---------- */
let deferredInstall = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; renderInstall(); });
window.addEventListener("appinstalled", () => { deferredInstall = null; renderInstall(); toast("CasaOS instalado na tela inicial."); });
function renderInstall() {
  const box = $("#p-install"); if (!box) return;
  if (isStandalone()) { box.hidden = true; return; }
  box.hidden = false; box.replaceChildren();
  const h = document.createElement("b"); h.textContent = "Instalar o CasaOS no celular"; box.append(h);
  const p = document.createElement("p"); p.className = "small muted"; box.append(p);
  if (deferredInstall) {
    p.textContent = "Abre em tela cheia, com ícone na tela inicial, e aparece no menu Compartilhar do Android.";
    const b = document.createElement("button"); b.className = "primary"; b.textContent = "Instalar agora";
    b.onclick = async () => { deferredInstall.prompt(); await deferredInstall.userChoice.catch(() => {}); deferredInstall = null; renderInstall(); };
    box.append(b);
  } else if (isIOS()) p.textContent = "No Safari: toque em Compartilhar (o quadrado com a seta) e depois em Adicionar à Tela de Início.";
  else p.textContent = "No menu do navegador (três pontinhos), escolha Instalar app ou Adicionar à tela inicial.";
}

/* ---------- receber arquivos do menu Compartilhar do Android ---------- */
async function handleShared() {
  if (!("caches" in window)) return;
  const cache = await caches.open("casaos-share"), keys = (await cache.keys()).sort((a, b) => a.url.localeCompare(b.url)), files = [];
  for (const req of keys) {
    const res = await cache.match(req); if (!res) continue;
    const blob = await res.blob();
    files.push(new File([blob], decodeURIComponent(res.headers.get("X-Name") || "arquivo"), { type: blob.type, lastModified: Number(res.headers.get("X-Mtime")) || Date.now() }));
  }
  await caches.delete("casaos-share");
  if (!files.length) return;
  openActions(document.body, `Recebi ${files.length} arquivo(s)`, [
    ["Enviar para Fotos", "photos", () => uploadToPhotos(files)],
    ["Enviar para Meus arquivos", "folder", () => uploadFiles(files, "", () => (state.view === "files" ? loadDir(state.path) : refreshMe()))],
    ["Descartar", "close", () => toast("Arquivos descartados.")],
  ]);
}

/* ---------- service worker: abre sem rede e atualiza sozinho ---------- */
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller; let reloading = false;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { // versão nova assumiu: recarrega, se não atrapalhar
    if (!hadController || reloading || up.active || $("#preview").open) return;
    reloading = true; location.reload();
  });
}

boot();
