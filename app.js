/* © 2026 Kauã Mazur dos Reis. Todos os direitos reservados. */
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
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  move: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 13h6m-2.5-2.5L15 13l-2.5 2.5"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>',
  finger: '<path d="M5 12a7 7 0 0 1 14 0c0 3-.5 5-1.5 7"/><path d="M8.5 12a3.5 3.5 0 0 1 7 0c0 2.5-.3 4.5-1 6.5"/><path d="M12 12v2c0 2-.4 3.5-1 5"/><path d="M3 8.5A10 10 0 0 1 21 8.5"/>',
  minus: '<path d="M5 12h14"/>',
  signal: '<path d="M4 19v-3M9 19v-7M14 19V9M19 19V5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
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
function toast(msg, bad = false, action = null) {
  const t = $("#toast"), b = $("#toast-act");
  $("#toast-msg").textContent = msg; t.className = "toast" + (bad ? " bad" : "");
  if (action) { b.hidden = false; b.textContent = action.label; b.onclick = () => { t.hidden = true; action.fn(); }; } else { b.hidden = true; b.onclick = null; }
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), action ? 9000 : 4500);
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
const THEME_IDS = ["auto", "claro", "escuro", "preto-neon", "azul-neon", "preto-ouro", "roxo-neon", "rosa-neon", "floresta"];
function resolveTheme(t) {
  t = { light: "claro", dark: "escuro" }[t] || t || "auto"; if (!THEME_IDS.includes(t)) t = "auto";
  return t === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro") : t;
}
function applyPrefs(p) {
  const r = document.documentElement, th = resolveTheme(p.theme);
  r.dataset.theme = th; r.dataset.mode = th === "claro" ? "light" : "dark"; r.dataset.accent = p.accent || "cobalto"; r.dataset.photo = p.photo_size || "medium";
  store.set("casaos_prefs", JSON.stringify(p));
  syncThemeColor();
}
function syncThemeColor() { // cor da barra de status do celular acompanha o tema
  const m = document.querySelector('meta[name="theme-color"]'); if (!m) return;
  const v = getComputedStyle(document.documentElement).getPropertyValue($("#app")?.hidden === false ? "--surface" : "--hero").trim();
  if (v) m.setAttribute("content", v);
}
const conn = () => navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const cellular = () => { const c = conn(); return !!c && (c.saveData === true || c.type === "cellular" || ["slow-2g", "2g", "3g"].includes(c.effectiveType)); };
const isEco = () => { const m = prefsNow().data_saver || "auto"; return m === "on" || (m === "auto" && cellular()); };
const thumbUrl = (it) => abs(isEco() && it.thumb_s ? it.thumb_s : it.thumb);
conn()?.addEventListener?.("change", () => { if (state.view === "profile") renderProfile(); });
const prefsNow = () => state.me?.settings || JSON.parse(store.get("casaos_prefs") || "{}");
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyPrefs(prefsNow()));

function setMe(me) {
  state.me = me; applyPrefs(me.settings);
  const shown = me.display_name || me.username;
  $("#me-name").textContent = shown;
  const { used_bytes: used, quota_bytes: quota } = me, fill = $("#meter-fill");
  let txt;
  if (used == null) { txt = me.usage_pending ? "Calculando o espaço usado…" : "Armazenamento offline"; fill.style.width = "0"; if (me.usage_pending) setTimeout(refreshMe, 3000); }
  else if (quota) { const pct = Math.min(100, (used / quota) * 100); fill.style.width = pct + "%"; fill.classList.toggle("full", pct >= 90); txt = `${fmtSize(used)} de ${fmtSize(quota)}`; }
  else { fill.style.width = "0"; txt = `${fmtSize(used)} usados · sem limite`; }
  $("#meter-text").textContent = txt;
  $("#chip-text").textContent = used == null ? (me.usage_pending ? "…" : "offline") : quota ? `${fmtSize(used)} / ${fmtSize(quota)}` : fmtSize(used);
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
    $("#ver").textContent = h.version ? `CasaOS v${h.version}` : "";
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
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeMenu(); if (sel.on && !document.querySelector("dialog[open]")) exitSel(); } });

/* ---------- navegação ---------- */
function setView(v) {
  state.view = v; closeMenu(); exitSel();
  $$("main > section").forEach((s) => (s.hidden = s.id !== "view-" + v));
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  syncFab();
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
const MEDIA = ["image", "video", "audio", "pdf", "text"];
const sel = { on: false, items: new Map() }; // caminho -> item selecionado
let searchSeq = 0, qTimer = null;
const syncFab = () => { $("#fab").hidden = sel.on || !(state.view === "files" || state.view === "photos"); };
function sortEntries(list) {
  const k = prefsNow().files_sort || "name";
  const cmp = { name: (a, b) => a.name.localeCompare(b.name, "pt", { numeric: true, sensitivity: "base" }), date: (a, b) => b.modified - a.modified, size: (a, b) => (b.size || 0) - (a.size || 0) }[k];
  return [...list].sort((a, b) => (a.is_dir !== b.is_dir ? (a.is_dir ? -1 : 1) : cmp(a, b)));
}
async function loadDir(path) {
  try {
    const d = await api(`/api/files?path=${enc(path)}`);
    d.entries.forEach((e) => { e.path = join(d.path, e.name); });
    state.path = d.path; state.entries = d.entries; state.query = ""; state.results = []; $("#q").value = ""; $("#search-note").hidden = true;
    renderCrumbs(); renderEntries();
  } catch (err) { if (err.status === 404 && path) return loadDir(""); toast(err.message, true); }
  refreshMe();
}
function reloadView() { if (state.view === "photos") resetPhotos(); else if (state.query) runSearch(); else loadDir(state.path); }
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
const KIND_ICON = { folder: "folder", video: "play", audio: "music", pdf: "file", text: "file" };
function tick() { const t = document.createElement("span"); t.className = "tick"; t.append(icon("check")); return t; }
function thumbFor(e) {
  const t = document.createElement("span"); t.className = "thumb";
  if (e.thumb) {
    const img = document.createElement("img"); img.loading = "lazy"; img.alt = ""; img.src = thumbUrl(e);
    img.onerror = () => img.replaceWith(icon(KIND_ICON[e.kind] || "file"));
    t.append(img);
    if (e.kind === "video") { const bd = document.createElement("span"); bd.className = "badge"; bd.append(icon("play")); t.append(bd); }
  } else t.append(icon(KIND_ICON[e.kind] || "file"));
  t.append(tick());
  return t;
}

/* seleção múltipla: segurar um item (celular) ou botão Selecionar */
function applySel() {
  document.body.classList.toggle("selecting", sel.on);
  $$("[data-path]").forEach((el) => { const on = sel.items.has(el.dataset.path); el.classList.toggle("selected", on); el.setAttribute("aria-selected", String(on)); });
  const n = sel.items.size;
  $("#selbar").hidden = !sel.on;
  $("#sel-count").textContent = n ? `${n} selecionado${n > 1 ? "s" : ""}` : "Toque nos itens";
  $("#sel-share").hidden = n !== 1;
  for (const id of ["sel-move", "sel-download", "sel-trash"]) $("#" + id).disabled = n === 0;
  syncFab();
}
function startSel(item) { sel.on = true; if (item) sel.items.set(item.path, item); applySel(); }
function toggleSel(item) { if (sel.items.has(item.path)) sel.items.delete(item.path); else sel.items.set(item.path, item); applySel(); }
function exitSel() { if (!sel.on && !sel.items.size) return; sel.on = false; sel.items.clear(); applySel(); }
function bindLongPress(el, item) {
  let t = null, x0 = 0, y0 = 0;
  const cancel = () => { clearTimeout(t); t = null; };
  el.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "mouse" || sel.on) return;
    x0 = ev.clientX; y0 = ev.clientY;
    t = setTimeout(() => { t = null; el._lp = Date.now(); navigator.vibrate?.(25); startSel(item); }, 450);
  });
  el.addEventListener("pointermove", (ev) => { if (t && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) cancel(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((n) => el.addEventListener(n, cancel));
  el.addEventListener("contextmenu", (ev) => { if (ev.pointerType !== "mouse") ev.preventDefault(); }); // Android: segurar abriria "salvar imagem"
  el.addEventListener("click", (ev) => { if (el._lp && Date.now() - el._lp < 800) { ev.stopImmediatePropagation(); ev.preventDefault(); el._lp = 0; } }, true);
}
const pool = () => (state.view === "photos" ? state.photos : state.query ? state.results : state.entries);
$("#btn-select").onclick = () => (sel.on ? exitSel() : startSel());
$("#btn-select-photos").onclick = () => (sel.on ? exitSel() : startSel());
$("#sel-close").onclick = exitSel;
$("#sel-all").onclick = () => { pool().forEach((i) => sel.items.set(i.path, i)); sel.on = true; applySel(); };
$("#sel-move").onclick = () => moveItems([...sel.items.values()]);
$("#sel-download").onclick = () => downloadItems([...sel.items.values()]);
$("#sel-trash").onclick = () => trashItems([...sel.items.values()]);
$("#sel-share").onclick = () => { const it = [...sel.items.values()][0]; if (it) shareItem(it); };

/* lista e grade (também mostra os resultados da busca) */
function renderEntries() {
  const searching = !!state.query;
  renderItems(searching ? state.results : sortEntries(state.entries), searching);
}
function renderItems(list, searching) {
  const p = prefsNow(), mode = p.files_view === "tiles" ? "tiles" : "list";
  const ul = $("#list"); ul.replaceChildren(); ul.className = "list " + (mode === "tiles" ? "tiles" : "rows");
  $("#mode-list").setAttribute("aria-pressed", mode === "list"); $("#mode-tiles").setAttribute("aria-pressed", mode === "tiles");
  $("#sort").value = p.files_sort || "name";
  $("#empty").textContent = searching ? "Nada encontrado com esse nome." : "Esta pasta está vazia. Toque no + para enviar arquivos ou criar uma pasta.";
  $("#empty").hidden = list.length > 0; ul.hidden = list.length === 0;
  const media = list.filter((e) => MEDIA.includes(e.kind));
  for (const e of list) {
    const li = document.createElement("li"); li.className = mode === "tiles" ? "tile" : "row"; li.dataset.path = e.path;
    const open = document.createElement("button"); open.className = "open";
    const txt = document.createElement("span"); txt.className = "txt";
    const name = document.createElement("b"); name.textContent = e.name; txt.append(name);
    if (mode === "list" || searching) {
      const sub = document.createElement("span"); sub.className = "sub";
      sub.textContent = searching ? [e.folder ? e.folder : "Meus arquivos", e.is_dir ? "" : fmtSize(e.size)].filter(Boolean).join(" · ") : e.is_dir ? fmtDate(e.modified) : [fmtSize(e.size), fmtDate(e.modified)].join(" · ");
      txt.append(sub);
    }
    open.append(thumbFor(e), txt);
    open.onclick = () => {
      if (sel.on) return toggleSel(e);
      if (e.is_dir) { state.query = ""; $("#q").value = ""; loadDir(e.path); }
      else if (MEDIA.includes(e.kind)) openViewer(media, media.indexOf(e));
      else download(e);
    };
    bindLongPress(li, e);
    const more = document.createElement("button"); more.className = "more"; more.setAttribute("aria-label", `Ações para ${e.name}`); more.append(icon("dots"));
    more.onclick = () => openActions(more, e.name, [
      ...(e.is_dir ? [["Baixar pasta (.zip)", "download", () => downloadItems([e])]] : [["Baixar", "download", () => download(e)]]),
      ["Mover", "move", () => moveItems([e])],
      ["Compartilhar", "share", () => shareItem(e)],
      ["Selecionar", "check", () => startSel(e)],
      ["Renomear", "edit", () => renameEntry(e, e.path)],
      ["Mover para a lixeira", "trash", () => removeEntry(e, e.path), "danger"],
    ]);
    li.append(open, more); ul.append(li);
  }
  applySel();
}
function triggerDownload(url, name) { const a = document.createElement("a"); a.href = abs(url); if (name) a.download = name; document.body.append(a); a.click(); a.remove(); }
function download(e) { triggerDownload(e.dl, e.name); }
async function downloadItems(items) {
  if (!items.length) return;
  if (items.length === 1 && !items[0].is_dir) { exitSel(); return download(items[0]); }
  try { const r = await api("/api/files/zip-link", { json: { paths: items.map((i) => i.path) } }); toast("Preparando o .zip: o download começa já."); triggerDownload(r.url); exitSel(); }
  catch (e) { toast(e.message, true); }
}
async function trashItems(items) {
  if (!items.length) return;
  if (items.length > 1 && !confirm(`Mover ${items.length} itens para a lixeira? Dá para restaurar por 30 dias.`)) return;
  try {
    const r = await api("/api/files/trash", { json: { paths: items.map((i) => i.path) } }); exitSel(); reloadView();
    toast(`${r.trashed} item(ns) na lixeira.`, false, { label: "Desfazer", fn: async () => {
      try { await api("/api/trash/restore-many", { json: { ids: r.ids } }); toast("Desfeito."); reloadView(); refreshMe(); } catch (e) { toast(e.message, true); } } });
  } catch (e) { toast(e.message, true); }
}
async function moveItems(items) {
  if (!items.length) return;
  const dest = await pickFolder(items.filter((i) => i.is_dir).map((i) => i.path));
  if (dest == null) return;
  try { const r = await api("/api/files/move", { json: { paths: items.map((i) => i.path), dest } }); toast(r.moved ? `${r.moved} item(ns) movido(s).` : "Já estavam nessa pasta."); exitSel(); reloadView(); }
  catch (e) { toast(e.message, true); }
}
function pickFolder(excluded) { // escolher a pasta de destino, entrando nas subpastas
  return new Promise((resolve) => {
    const dlg = $("#picker"); let path = "";
    const blocked = (p) => excluded.some((x) => p === x || p.startsWith(x + "/"));
    const load = async () => {
      let d; try { d = await api(`/api/files?path=${enc(path)}`); } catch (e) { return toast(e.message, true); }
      $("#pk-title").textContent = path ? path.split("/").pop() : "Meus arquivos"; $("#pk-back").hidden = !path;
      const ul = $("#pk-list"); ul.replaceChildren();
      const dirs = d.entries.filter((e) => e.is_dir && !blocked(join(d.path, e.name)));
      for (const e of dirs) {
        const li = document.createElement("li"); li.className = "row";
        const b = document.createElement("button"); b.className = "open"; const th = document.createElement("span"); th.className = "thumb"; th.append(icon("folder"));
        const nm = document.createElement("b"); nm.textContent = e.name; b.append(th, nm); b.onclick = () => { path = join(d.path, e.name); load(); };
        li.append(b); ul.append(li);
      }
      if (!dirs.length) { const p = document.createElement("p"); p.className = "pk-empty"; p.textContent = "Sem subpastas aqui. Você pode mover para esta pasta ou criar uma nova."; ul.append(p); }
    };
    const done = (v) => { dlg.close(); resolve(v); };
    $("#pk-back").onclick = () => { path = path.split("/").slice(0, -1).join("/"); load(); };
    $("#pk-new").onclick = async () => { const name = await ask("Nome da nova pasta"); if (!name) return; try { await api("/api/files/folder", { json: { path, name } }); load(); } catch (e) { toast(e.message, true); } };
    $("#pk-ok").onclick = () => done(path); $("#pk-cancel").onclick = () => done(null); dlg.oncancel = () => done(null);
    dlg.showModal(); load();
  });
}
async function renameEntry(e, path) {
  const name = await ask("Novo nome", e.name); if (!name || name === e.name) return;
  try { await api("/api/files/rename", { json: { path, new_name: name } }); reloadView(); } catch (err) { toast(err.message, true); }
}
async function removeEntry(e) { return trashItems([e]); }
async function newFolder() {
  const name = await ask("Nome da nova pasta"); if (!name) return;
  try { await api("/api/files/folder", { json: { path: state.path, name } }); loadDir(state.path); } catch (err) { toast(err.message, true); }
}
$("#btn-folder").onclick = newFolder;
$("#mode-list").onclick = () => saveSetting("files_view", "list");
$("#mode-tiles").onclick = () => saveSetting("files_view", "tiles");
$("#sort").onchange = (e) => saveSetting("files_sort", e.target.value);

/* busca por nome */
async function runSearch() {
  const q = $("#q").value.trim(), seq = ++searchSeq, note = $("#search-note");
  if (q.length < 2) { if (state.query) { state.query = ""; state.results = []; note.hidden = true; renderEntries(); } return; }
  try {
    const d = await api(`/api/files/search?q=${enc(q)}`); if (seq !== searchSeq) return;
    state.query = q; state.results = d.items; note.textContent = `${d.total} resultado${d.total === 1 ? "" : "s"} para “${q}”${d.total > d.items.length ? ` (mostrando ${d.items.length})` : ""}`; note.hidden = false; renderEntries();
  } catch (e) { toast(e.message, true); }
}
$("#q").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(runSearch, 300); });

/* links temporários de compartilhamento */
const shareUrl = (s) => (API || location.origin) + s.url_path;
const fmtWhen = (utc) => new Date(utc.replace(" ", "T") + "Z").toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
async function copyText(text, input) {
  try { await navigator.clipboard.writeText(text); toast("Link copiado."); }
  catch { if (input) { input.select(); document.execCommand("copy"); toast("Link copiado."); } else toast(text); }
}
function shareItem(item) {
  openActions(document.body, `Compartilhar “${item.name}”`, [["1 hora", 1], ["1 dia", 24], ["7 dias", 168], ["30 dias", 720]].map(([label, h]) => [`Link válido por ${label}`, "link", () => createShare(item, h)]));
}
async function createShare(item, hours) {
  try { showShareLink(await api("/api/shares", { json: { path: item.path, hours } }), item.name); exitSel(); if (state.view === "profile") loadShares(); }
  catch (e) { toast(e.message, true); }
}
function showShareLink(s, name) {
  $("#sheet-title").textContent = `Link para “${name}”`;
  const body = $("#sheet-body"); body.replaceChildren();
  const input = document.createElement("input"); input.className = "linkbox"; input.readOnly = true; input.value = shareUrl(s); input.onfocus = () => input.select();
  const note = document.createElement("p"); note.className = "sheet-note"; note.textContent = `Quem tiver o link abre sem conta, até ${fmtWhen(s.expires_at)}. Para cancelar antes: Perfil → Links compartilhados.`;
  const mk = (label, ic, fn) => { const b = document.createElement("button"); b.className = "sheet-btn"; b.append(icon(ic), document.createTextNode(label)); b.onclick = fn; return b; };
  body.append(input, note, mk("Copiar link", "link", () => copyText(input.value, input)));
  if (navigator.share) body.append(mk("Compartilhar…", "share", () => navigator.share({ title: name, url: input.value }).catch(() => {})));
  body.append(mk("Pronto", "check", () => $("#sheet").close()));
  if (!$("#sheet").open) $("#sheet").showModal();
}
async function loadShares() {
  const box = $("#p-shares"); let list;
  try { list = await api("/api/shares"); } catch { return; }
  box.replaceChildren();
  if (!list.length) { const p = document.createElement("p"); p.className = "pk-empty"; p.textContent = "Nenhum link ativo. Use Compartilhar no menu de um arquivo ou pasta."; box.append(p); return; }
  for (const s of list) {
    const r = document.createElement("div"); r.className = "share-row";
    const nm = document.createElement("b"); nm.textContent = (s.is_dir ? "📁 " : "") + s.name;
    const sub = document.createElement("span"); sub.className = "small muted"; sub.textContent = `Até ${fmtWhen(s.expires_at)} · ${s.views} visita(s) · ${s.downloads} download(s)`;
    const acts = document.createElement("div"); acts.className = "actions";
    const c = document.createElement("button"); c.textContent = "Copiar link"; c.onclick = () => copyText(shareUrl(s));
    const x = document.createElement("button"); x.className = "danger"; x.textContent = "Cancelar link";
    x.onclick = async () => { try { await api(`/api/shares/${s.id}`, { method: "DELETE" }); toast("Link cancelado."); loadShares(); } catch (e) { toast(e.message, true); } };
    acts.append(c, x); r.append(nm, sub, acts); box.append(r);
  }
}

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
  const key = ["casaos_up", state.me.username, path, f._dir || "", f.name, f.size, f.lastModified].join("|");
  let id = store.get(key), offset = 0, chunk = BIG;
  if (id) { try { const st = await api(`/api/uploads/${id}`); offset = st.offset; chunk = st.chunk_size || chunk; } catch { id = null; store.del(key); } } // retoma de onde parou
  if (!id) { const r = await api("/api/uploads", { json: { path, name: f.name, size: f.size, mtime: f.lastModified || null, dir: f._dir || "" } }); id = r.id; chunk = r.chunk_size; store.set(key, id); }
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
  const total = files.reduce((s, f) => s + f.size, 0) || 1, t0 = Date.now();
  if (isEco() && total > 100 * 1024 * 1024 && !confirm(`Economia de dados ligada: enviar ${fmtSize(total)} pode gastar bastante do seu pacote de internet. Continuar?`)) return;
  up.active = true; up.cancel = false;
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
      fd.append("relpaths", JSON.stringify(batch.map((f) => f._dir || "")));
      batch.forEach((f) => fd.append("files", f, f.name));
      const base = done, size = bytes;
      await xhrSend("POST", `/api/files/upload?path=${enc(path)}`, fd, { onProgress: (l) => report(Math.min(l, size)) });
      done = base + size; count += batch.length; batch = []; bytes = 0; report();
    };
    for (const f of files.filter((f) => f.size < BIG)) { batch.push(f); bytes += f.size; if (bytes >= 24 * 1024 * 1024 || batch.length >= 20) await flush(); }
    await flush();
    for (const f of files.filter((f) => f.size >= BIG)) { const base = done; await sendChunked(f, path, (l) => report(l)); done = base + f.size; count++; report(); }
    const nd = new Set(files.map((f) => (f._dir || "").split("/")[0]).filter(Boolean)).size;
    toast(`${files.length} arquivo(s) enviado(s)${nd ? ` em ${nd} pasta(s)` : ""}.`);
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
$("#btn-upload-folder").onclick = () => pick("folder-input", "folder");
$("#folder-input").onchange = (e) => {
  const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
  let rel = 0;
  for (const f of files) { const wp = f.webkitRelativePath || ""; if (wp.includes("/")) { f._dir = wp.slice(0, wp.lastIndexOf("/")); rel++; } }
  if (!rel) toast("Este navegador não informou as pastas: os arquivos serão enviados soltos.", true);
  uploadFiles(files, state.path, () => loadDir(state.path));
};
$("#btn-photo-upload").onclick = () => pick("photo-input", "photos");
$("#fab").onclick = () => {
  if (state.view === "photos") openActions($("#fab"), "Adicionar", [
    ["Enviar fotos e vídeos", "photos", () => pick("photo-input", "photos")], ["Tirar foto", "camera", () => pick("camera-input", "photos")]]);
  else openActions($("#fab"), "Adicionar", [
    ["Enviar arquivos", "upload", () => pick("file-input", "folder")], ["Enviar pasta inteira", "folder", () => pick("folder-input", "folder")], ["Enviar fotos e vídeos", "photos", () => pick("photo-input", "folder")],
    ["Tirar foto", "camera", () => pick("camera-input", "folder")], ["Nova pasta", "plus", newFolder]]);
};
const dz = $("#dropzone");
["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
async function filesFromEntries(entries) { // arrastar uma pasta: lê todas as subpastas
  const out = [];
  const walk = async (entry, dir) => {
    if (entry.isFile) { const f = await new Promise((res, rej) => entry.file(res, rej)); f._dir = dir; out.push(f); }
    else if (entry.isDirectory) {
      const rd = entry.createReader(), sub = dir ? `${dir}/${entry.name}` : entry.name; let batch;
      do { batch = await new Promise((res, rej) => rd.readEntries(res, rej)); for (const e of batch) await walk(e, sub); } while (batch.length);
    }
  };
  for (const e of entries) await walk(e, "");
  return out;
}
dz.addEventListener("drop", async (e) => {
  const items = [...(e.dataTransfer.items || [])], entries = items.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean); // precisa ser lido já, antes de qualquer await
  const files = entries.length ? await filesFromEntries(entries) : [...e.dataTransfer.files];
  uploadFiles(files, state.path, () => loadDir(state.path));
});

/* ---------- fotos ---------- */
const photoIO = new IntersectionObserver((en) => { if (en[0].isIntersecting) loadPhotos(); }, { rootMargin: "800px" });
function resetPhotos() { state.photos = []; state.photosTotal = 0; state.lastMonth = ""; state.grid = null; $("#mosaic").replaceChildren(); $("#photos-empty").hidden = true; loadPhotos(true); }
async function loadPhotos(first = false) {
  if (state.photosBusy || (!first && state.photos.length >= state.photosTotal)) return;
  state.photosBusy = true; $("#sentinel").hidden = false;
  try {
    const d = await api(`/api/files/photos?offset=${state.photos.length}&limit=${isEco() ? 60 : 120}&refresh=${first ? 1 : 0}`);
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
  const b = document.createElement("button"); b.className = "shot"; b.dataset.path = it.path; b.setAttribute("aria-label", it.name);
  if (it.thumb || it.kind === "image") {
    const img = document.createElement("img"); img.loading = "lazy"; img.alt = ""; img.src = it.thumb ? thumbUrl(it) : abs(it.view); img.onerror = () => img.remove(); b.append(img);
  } else if (isEco()) { const ph = document.createElement("span"); ph.className = "thumb"; ph.style.cssText = "width:100%;height:100%;border-radius:0"; ph.append(icon("play")); b.append(ph); // 4G: não baixa vídeo só para mostrar a capa
  } else { const v = document.createElement("video"); v.muted = true; v.preload = "metadata"; v.playsInline = true; v.src = abs(it.view) + "#t=0.1"; b.append(v); } // sem ffmpeg: primeiro quadro do vídeo
  if (it.kind === "video") { const badge = document.createElement("span"); badge.className = "badge"; badge.append(icon("play")); b.append(badge); }
  b.append(tick());
  b.onclick = () => (sel.on ? toggleSel(it) : openViewer(state.photos, idx));
  bindLongPress(b, it);
  state.grid.append(b);
  if (sel.items.has(it.path)) b.classList.add("selected");
}

/* ---------- visualizador (HEIC aparece convertido) ---------- */
let pv = { items: [], i: 0 }, pvQuality = null, pvToken = 0;
const Q_LABEL = { orig: "Original", 720: "Leve 720p", 480: "Economia 480p" };
function openViewer(items, i) { pv = { items, i: Math.max(0, i) }; showViewer(); $("#preview").showModal(); }
function pvDefaultQuality(it) { return it.lite && isEco() ? "480" : "orig"; }
function showViewer(keepTime = 0) {
  const it = pv.items[pv.i], body = $("#pv-body"); body.replaceChildren(); $("#pv-prep").hidden = true; const tok = ++pvToken;
  closePdf();
  const isDoc = it.kind === "pdf" || it.kind === "text";
  if (isDoc) {
    const box = document.createElement("div"); body.append(box);
    (it.kind === "pdf" ? renderPdf : renderText)(it, box, tok).catch((e) => { if (tok === pvToken) docMessage(box, `Não consegui abrir este arquivo (${e.message}).`, it); });
  } else {
    const el = document.createElement(it.kind === "image" ? "img" : it.kind === "video" ? "video" : "audio");
    if (it.kind === "image") { el.src = abs(isEco() && it.medium ? it.medium : it.large || it.view); el.alt = it.name; }
    else {
      el.controls = true; el.preload = isEco() ? "none" : "metadata"; if (it.kind === "video") el.playsInline = true;
      if (it.thumb) el.poster = thumbUrl(it);
      const q = it.kind === "video" && it.lite ? (pvQuality || pvDefaultQuality(it)) : "orig";
      const play = () => { if (keepTime) el.currentTime = keepTime; if (prefsNow().autoplay && !isEco() || keepTime) el.play().catch(() => {}); };
      if (q === "orig") { el.src = abs(it.view); el.addEventListener("loadedmetadata", play, { once: true }); }
      else prepareLite(it, +q, el, tok, play);
    }
    body.append(el);
  }
  $("#pv-name").textContent = it.name; $("#pv-count").textContent = pv.items.length > 1 ? `${pv.i + 1} / ${pv.items.length}` : "";
  const dl = $("#pv-download"); dl.href = abs(it.dl); dl.download = it.name;
  const qb = $("#pv-quality"); qb.hidden = !(it.kind === "video" && it.lite);
  if (!qb.hidden) $("#pv-q-label").textContent = Q_LABEL[pvQuality || pvDefaultQuality(it)];
  $("#pv-zoom-in").hidden = $("#pv-zoom-out").hidden = it.kind !== "pdf";
  $("#pv-prev").hidden = pv.i === 0; $("#pv-next").hidden = pv.i === pv.items.length - 1;
}

/* PDF (leitor pdf.js, carregado só quando abre um PDF) e texto simples */
let pdfjsLib = null, pdfState = null, pdfZoom = 1;
const docMessage = (box, msg, it) => {
  box.className = "pv-doc"; box.replaceChildren(); const m = document.createElement("div"); m.className = "doc-msg"; m.textContent = msg;
  if (it) { const a = document.createElement("a"); a.className = "btn"; a.href = abs(it.dl); a.download = it.name; a.textContent = "Baixar o arquivo"; m.append(a); }
  box.append(m);
};
async function loadPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("./vendor/pdfjs/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("vendor/pdfjs/pdf.worker.min.mjs", document.baseURI).href;
  }
  return pdfjsLib;
}
function closePdf() { if (pdfState) { try { pdfState.io.disconnect(); pdfState.doc.destroy(); } catch {} pdfState = null; } }
async function renderPdf(it, box, tok) {
  pdfZoom = 1; docMessage(box, "Carregando o PDF…");
  if (it.size > 80 * 1024 * 1024) return docMessage(box, "Este PDF é muito grande para abrir aqui. Baixe para ler.", it);
  const [res, lib] = await Promise.all([fetch(abs(it.dl)), loadPdfjs()]);
  if (!res.ok) throw new Error(`erro ${res.status}`);
  const data = new Uint8Array(await res.arrayBuffer()); if (tok !== pvToken) return;
  const doc = await lib.getDocument({ data, isEvalSupported: false }).promise; if (tok !== pvToken) { doc.destroy(); return; }
  const first = await doc.getPage(1), v1 = first.getViewport({ scale: 1 }), ratio = v1.height / v1.width;
  box.className = "pv-doc"; box.replaceChildren();
  let gen = 0;
  const cssWidth = () => Math.max(260, Math.min(box.clientWidth - 16, 920) * pdfZoom); // em tela grande a página não passa de ~920 px
  const io = new IntersectionObserver((en) => en.forEach((x) => x.isIntersecting && draw(x.target)), { root: box, rootMargin: "700px 0px" });
  pdfState = { doc, io, redraw: () => { gen++; $$(".pdf-page", box).forEach((c) => { c.style.width = cssWidth() + "px"; c.style.height = cssWidth() * ratio + "px"; io.unobserve(c); io.observe(c); }); } };
  async function draw(c) {
    if (c._gen === gen) return; c._gen = gen; const my = gen;
    const page = await doc.getPage(+c.dataset.page); if (my !== gen || tok !== pvToken) return;
    const w = cssWidth(), vp0 = page.getViewport({ scale: 1 }), dpr = Math.min(window.devicePixelRatio || 1, isEco() ? 1.5 : 2.5), vp = page.getViewport({ scale: (w / vp0.width) * dpr });
    c.width = vp.width; c.height = vp.height; c.style.width = w + "px"; c.style.height = vp.height / dpr + "px";
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise.catch(() => {});
  }
  for (let i = 1; i <= doc.numPages; i++) {
    const c = document.createElement("canvas"); c.className = "pdf-page"; c.dataset.page = i; c.style.width = cssWidth() + "px"; c.style.height = cssWidth() * ratio + "px"; box.append(c); io.observe(c);
  }
  const count = $("#pv-count"), pages = $$(".pdf-page", box);
  const upd = () => { const mid = box.getBoundingClientRect().top + box.clientHeight / 3; let cur = 1; for (const c of pages) { if (c.getBoundingClientRect().top <= mid) cur = +c.dataset.page; else break; } count.textContent = `Página ${cur} de ${doc.numPages}`; };
  let raf = 0; box.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(upd); }, { passive: true }); upd();
}
function zoomPdf(f) { if (!pdfState) return; pdfZoom = Math.min(4, Math.max(0.5, pdfZoom * f)); pdfState.redraw(); }
$("#pv-zoom-in").onclick = () => zoomPdf(1.25);
$("#pv-zoom-out").onclick = () => zoomPdf(0.8);
async function renderText(it, box, tok) {
  box.className = "pv-doc"; box.replaceChildren(); const pre = document.createElement("pre"); pre.className = "pv-text"; pre.textContent = "Carregando…"; box.append(pre);
  const res = await fetch(abs(it.dl)); if (!res.ok) throw new Error(`erro ${res.status}`);
  const MAX = 1_000_000; let text, cut = false;
  if (res.body && res.body.getReader) {
    const rd = res.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (got >= MAX) { cut = true; rd.cancel(); break; } }
    const all = new Uint8Array(got); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
    text = new TextDecoder("utf-8").decode(all);
  } else { text = await res.text(); if (text.length > MAX) { text = text.slice(0, MAX); cut = true; } }
  if (tok !== pvToken) return;
  pre.textContent = text + (cut ? "\n\n… (mostrando só o começo; baixe o arquivo para ver tudo)" : "");
}
async function prepareLite(it, height, el, tok, onReady) { // pede a versão leve e espera ficar pronta (mostra o andamento)
  const prep = $("#pv-prep");
  const fail = (msg) => { if (tok !== pvToken) return; prep.hidden = true; toast(msg, true); el.src = abs(it.view); el.addEventListener("loadedmetadata", onReady, { once: true }); };
  for (;;) {
    let st; try { st = await api("/api/files/lite", { json: { path: it.path, height } }); } catch (e) { return fail(`${e.message} Tocando o original.`); }
    if (tok !== pvToken) return; // trocou de vídeo ou fechou
    if (st.state === "ready") { prep.hidden = true; el.src = abs(st.url); el.addEventListener("loadedmetadata", onReady, { once: true }); return; }
    if (st.state === "error") return fail(`Não deu para preparar a versão leve (${st.error || "erro"}). Tocando o original.`);
    prep.hidden = false; prep.replaceChildren();
    const t = document.createElement("div"); t.textContent = st.state === "queued" ? "Na fila para preparar a versão leve…" : `Preparando a versão leve… ${st.pct || 0}%`;
    const bar = document.createElement("div"); bar.className = "meter-bar"; const sp = document.createElement("span"); sp.style.width = (st.pct || 0) + "%"; bar.append(sp);
    const sk = document.createElement("button"); sk.textContent = "Tocar o original agora"; sk.onclick = () => { pvToken++; prep.hidden = true; el.src = abs(it.view); el.addEventListener("loadedmetadata", onReady, { once: true }); };
    prep.append(t, bar, sk);
    await sleep(1500);
  }
}
$("#pv-quality").onclick = () => {
  const it = pv.items[pv.i], cur = pvQuality || pvDefaultQuality(it), v = $("#pv-body video"), t = v ? v.currentTime : 0;
  openActions(document.body, "Qualidade do vídeo", [["orig", "Original (melhor no Wi-Fi)"], ["720", "Leve 720p (gasta menos dados)"], ["480", "Economia 480p (gasta pouquíssimo)"]]
    .map(([k, label]) => [(cur === k ? "✓ " : "") + label, "signal", () => { pvQuality = k; showViewer(t); }]));
};
$("#pv-share").onclick = () => { const it = pv.items[pv.i]; if (it) shareItem(it); };
function step(d) { const n = pv.i + d; if (n >= 0 && n < pv.items.length) { pv.i = n; showViewer(); } }
$("#pv-prev").onclick = () => step(-1); $("#pv-next").onclick = () => step(1); $("#pv-close").onclick = () => $("#preview").close();
$("#preview").addEventListener("close", () => { pvToken++; closePdf(); $("#pv-prep").hidden = true; $("#pv-body").replaceChildren(); });
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
  const big = document.createElement("b"); big.textContent = me.used_bytes == null ? (me.usage_pending ? "Calculando…" : "Offline") : `${fmtSize(me.used_bytes)} usados`;
  const of = document.createElement("span"); of.className = "muted";
  of.textContent = me.quota_bytes ? `de ${fmtSize(me.quota_bytes)} (${Math.min(100, Math.round(((me.used_bytes || 0) / me.quota_bytes) * 100))}%)` : "sem limite de espaço";
  line.append(big, of); box.append(line);
  if (me.quota_bytes) { const bar = document.createElement("div"); bar.className = "meter-bar"; bar.style.margin = "10px 0"; const sp = document.createElement("span"); sp.style.width = Math.min(100, ((me.used_bytes || 0) / me.quota_bytes) * 100) + "%"; bar.append(sp); box.append(bar); }
  const lim = document.createElement("div"); lim.className = "small muted";
  lim.textContent = `Tamanho máximo por arquivo: ${me.max_file_bytes ? fmtSize(me.max_file_bytes) : "sem limite"} · A lixeira conta no espaço.`; box.append(lim);
  $$("[data-setting]").forEach((g) => { const k = g.dataset.setting; g.querySelectorAll("button[data-val]").forEach((b) => b.setAttribute("aria-pressed", String(s[k] === b.dataset.val))); });
  $("#p-folder").value = s.photo_folder; $("#p-autoplay").checked = !!s.autoplay;
  const eco = isEco(), mode = s.data_saver || "auto";
  $("#data-status").textContent = mode === "auto" && !conn() ? "Seu navegador não informa o tipo de conexão (comum no iPhone). Use Sempre ligada quando estiver no 4G."
    : `Agora: economia ${eco ? "LIGADA" : "desligada"}${mode === "auto" ? (eco ? " (conexão de celular detectada)" : " (Wi-Fi ou conexão rápida)") : ""}.`;
  renderThemes(); loadShares(); renderPasskeys(); renderNotif();
  fetch(API + "/api/health").then((r) => r.json()).then((h) => { $("#about-ver").textContent = h.version ? `v${h.version}` : ""; }).catch(() => {});
}
const THEMES = [
  { id: "auto", label: "Automático", c: null },
  { id: "claro", label: "Claro", c: ["#e8edf3", "#ffffff", "#2748e8", "#0e1a2b"] },
  { id: "escuro", label: "Escuro", c: ["#0b1220", "#131c2e", "#8ea2ff", "#e9eef8"] },
  { id: "preto-neon", label: "Preto neon", c: ["#040405", "#0c0d0f", "#39ff88", "#e9fff2"] },
  { id: "azul-neon", label: "Azul neon", c: ["#030818", "#081231", "#2ec4ff", "#e5f0ff"] },
  { id: "preto-ouro", label: "Preto e dourado", c: ["#080706", "#12100b", "#e9b949", "#f7edd2"] },
  { id: "roxo-neon", label: "Roxo neon", c: ["#07040f", "#110a22", "#c35bff", "#f1e8ff"] },
  { id: "rosa-neon", label: "Rosa neon", c: ["#0b0407", "#170810", "#ff3d9a", "#ffe9f3"] },
  { id: "floresta", label: "Floresta", c: ["#060f0a", "#0d1a12", "#8be04e", "#e8f6ea"] },
];
function renderThemes() {
  const box = $("#themes"); box.replaceChildren(); const cur = resolveSaved(prefsNow().theme);
  for (const t of THEMES) {
    const b = document.createElement("button"); b.className = "theme-card"; b.setAttribute("aria-pressed", String(cur === t.id)); b.setAttribute("aria-label", `Tema ${t.label}`);
    const tc = document.createElement("span"); tc.className = "tc";
    const mkI = (cls, bg, op) => { const i = document.createElement("i"); i.className = cls; i.style.background = bg; if (op) i.style.opacity = op; tc.append(i); };
    if (t.c) { tc.style.background = t.c[0]; mkI("bar", t.c[1]); mkI("dot", t.c[2]); mkI("line", t.c[3], ".55"); }
    else { tc.style.background = "linear-gradient(135deg, #e8edf3 50%, #0b1220 50%)"; mkI("dot", "#2748e8"); }
    const n = document.createElement("span"); n.className = "n"; n.textContent = t.label;
    b.append(tc, n);
    b.onclick = () => { applyPrefs({ ...prefsNow(), theme: t.id }); saveSetting("theme", t.id); }; // muda na hora e salva
    box.append(b);
  }
  $("#accent-row").hidden = !["auto", "claro", "escuro"].includes(cur);
}
const resolveSaved = (t) => { t = { light: "claro", dark: "escuro" }[t] || t || "auto"; return THEME_IDS.includes(t) ? t : "auto"; };
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
  movido: "Moveu arquivos", link_criado: "Criou um link", link_removido: "Cancelou um link", link_aberto: "Abriram um link",
  link_baixado: "Baixaram por um link", datas_corrigidas: "Corrigiu as datas das fotos",
  passkey_criada: "Cadastrou biometria", passkey_removida: "Removeu biometria", login_biometria: "Entrou com biometria",
  video_leve_auto: "Vídeo leve automático", indice_reconstruido: "Reconstruiu o índice", cache_limpo: "Limpou o cache",
  migracao_iniciada: "Migração iniciada", migracao_concluida: "Migração concluída", migracao_cancelada: "Migração cancelada", migracao_falhou: "Migração falhou",
};
async function loadAdmin() {
  let st, users, logs, perf;
  try { [st, users, logs, perf] = await Promise.all([api("/api/admin/storage"), api("/api/admin/users"), api("/api/admin/logs?limit=80"), api("/api/admin/perf")]); } catch (e) { return toast(e.message, true); }
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
  const ff = document.createElement("p"); ff.className = "small muted";
  ff.textContent = st.ffmpeg ? "Miniaturas de vídeo: ligadas." : "Miniaturas de vídeo: desligadas. Instale o ffmpeg para ligar (veja o COMECE-AQUI.txt).";
  card.append(ff);
  renderUsers(users); renderLogs(logs); renderPerf(perf); migPoll(); dfPoll();
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

/* ---------- entrar com biometria (passkey) ---------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (t) => { t = t.replace(/-/g, "+").replace(/_/g, "/"); t += "=".repeat((4 - (t.length % 4)) % 4); return Uint8Array.from(atob(t), (c) => c.charCodeAt(0)).buffer; };
const hasPasskeys = () => !!(window.PublicKeyCredential && navigator.credentials);
const deviceName = () => { const u = navigator.userAgent; return /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Celular Android" : /Windows/.test(u) ? "Computador Windows" : /Mac/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "Este aparelho"; };
$("#btn-passkey").hidden = !hasPasskeys();
$("#btn-passkey").onclick = async () => {
  $("#login-error").textContent = ""; const btn = $("#btn-passkey"); btn.disabled = true;
  try {
    const { challenge_id, options } = await api("/api/auth/passkeys/login/options", { method: "POST" });
    options.challenge = unb64u(options.challenge);
    if (options.allowCredentials) options.allowCredentials = options.allowCredentials.map((c) => ({ ...c, id: unb64u(c.id) }));
    let cred;
    try { cred = await navigator.credentials.get({ publicKey: options }); }
    catch (e) { throw new Error(e.name === "NotAllowedError" ? "Cancelado, ou ainda não há biometria cadastrada neste aparelho. Entre com a senha e ative em Perfil." : e.message); }
    const r = cred.response, credential = { id: cred.id, rawId: b64u(cred.rawId), type: cred.type, clientExtensionResults: cred.getClientExtensionResults(),
      response: { authenticatorData: b64u(r.authenticatorData), clientDataJSON: b64u(r.clientDataJSON), signature: b64u(r.signature) } };
    if (r.userHandle) credential.response.userHandle = b64u(r.userHandle);
    if (cred.authenticatorAttachment) credential.authenticatorAttachment = cred.authenticatorAttachment;
    const out = await api("/api/auth/passkeys/login/verify", { json: { challenge_id, credential } });
    store.set("casaos_token", out.token); setMe(out.user); enterApp();
  } catch (e) { $("#login-error").textContent = e.message; }
  btn.disabled = false;
};
async function renderPasskeys() {
  const box = $("#p-passkeys"), note = $("#pk-note"), add = $("#btn-add-passkey");
  add.hidden = !hasPasskeys();
  note.textContent = hasPasskeys() ? "Entre só com a digital, o rosto ou o PIN do aparelho, sem digitar a senha. Nada biométrico sai do seu aparelho. Cada aparelho e cada endereço do site precisam do próprio cadastro." : "Este navegador não suporta entrar com biometria.";
  let list = []; try { list = await api("/api/auth/passkeys"); } catch { return; }
  box.replaceChildren();
  for (const k of list) {
    const row = document.createElement("div"); row.className = "pk-item";
    const t = document.createElement("span"); t.className = "txt"; const nm = document.createElement("b"); nm.textContent = k.name;
    const sub = document.createElement("span"); sub.className = "sub"; sub.textContent = `${k.rp_id} · criada em ${fmtWhen(k.created_at)}${k.last_used ? ` · usada em ${fmtWhen(k.last_used)}` : ""}`; t.append(nm, sub);
    const del = document.createElement("button"); del.className = "danger"; del.textContent = "Remover";
    del.onclick = async () => { if (!confirm(`Remover a biometria “${k.name}”?`)) return; try { await api(`/api/auth/passkeys/${k.id}`, { method: "DELETE" }); renderPasskeys(); } catch (e) { toast(e.message, true); } };
    row.append(t, del); box.append(row);
  }
}
$("#btn-add-passkey").onclick = async () => {
  const name = await ask("Nome deste aparelho", deviceName()); if (!name) return;
  try {
    const { challenge_id, options } = await api("/api/auth/passkeys/register/options", { method: "POST" });
    options.challenge = unb64u(options.challenge); options.user.id = unb64u(options.user.id);
    if (options.excludeCredentials) options.excludeCredentials = options.excludeCredentials.map((c) => ({ ...c, id: unb64u(c.id) }));
    let cred;
    try { cred = await navigator.credentials.create({ publicKey: options }); }
    catch (e) { if (e.name === "NotAllowedError") return toast("Cancelado.", true); if (e.name === "InvalidStateError") return toast("Este aparelho já está cadastrado.", true); throw e; }
    const r = cred.response, credential = { id: cred.id, rawId: b64u(cred.rawId), type: cred.type, clientExtensionResults: cred.getClientExtensionResults(),
      response: { attestationObject: b64u(r.attestationObject), clientDataJSON: b64u(r.clientDataJSON), transports: r.getTransports ? r.getTransports() : [] } };
    if (cred.authenticatorAttachment) credential.authenticatorAttachment = cred.authenticatorAttachment;
    await api(`/api/auth/passkeys/register/verify?challenge_id=${enc(challenge_id)}`, { json: { credential, name } });
    toast("Biometria cadastrada. Da próxima vez, é só tocar em Entrar com biometria."); renderPasskeys();
  } catch (e) { toast(e.message, true); }
};

/* ---------- notificações no celular (Web Push) ---------- */
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
async function currentSub() { try { return await (await navigator.serviceWorker.ready).pushManager.getSubscription(); } catch { return null; } }
async function renderNotif() {
  const st = $("#notif-status"), tg = $("#notif-toggle"), ts = $("#notif-test"), s = state.me?.settings || {};
  $("#n-links").checked = s.notify_links !== false; $("#n-video").checked = s.notify_video !== false; $("#n-login").checked = s.notify_login !== false; $("#n-admin").checked = s.notify_admin !== false;
  $("#n-admin-row").hidden = !state.me?.is_admin;
  if (!pushSupported()) {
    tg.hidden = ts.hidden = true;
    st.textContent = isIOS() && !isStandalone() ? "No iPhone, primeiro instale o app: Safari → Compartilhar → Adicionar à Tela de Início. Depois abra o CasaOS por lá e ative aqui (precisa do iOS 16.4 ou mais novo)." : "Este navegador não suporta notificações.";
    return;
  }
  const sub = await currentSub();
  tg.hidden = false; ts.hidden = !sub; tg.disabled = false;
  if (Notification.permission === "denied") { st.textContent = "As notificações estão bloqueadas para este site no navegador. Libere nas configurações do site e volte aqui."; tg.hidden = true; ts.hidden = true; return; }
  st.textContent = sub ? "Ativadas neste aparelho." : "Desativadas neste aparelho. Você pode escolher abaixo o que quer receber.";
  tg.textContent = sub ? "Desativar neste aparelho" : "Ativar neste aparelho"; tg.className = sub ? "" : "primary";
}
$("#notif-toggle").onclick = async () => {
  const tg = $("#notif-toggle"); tg.disabled = true;
  try {
    const sub = await currentSub();
    if (sub) { await api("/api/push/unsubscribe", { json: { endpoint: sub.endpoint } }); await sub.unsubscribe(); toast("Notificações desativadas neste aparelho."); }
    else {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Sem permissão para notificar. Libere nas configurações do navegador.");
      const reg = await navigator.serviceWorker.ready, k = await api("/api/push/key");
      if (!k.available) throw new Error("O servidor ainda não tem a biblioteca de notificações. Rode instalar.bat no PC.");
      const ns = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(k.public_key) }), j = ns.toJSON();
      await api("/api/push/subscribe", { json: { endpoint: j.endpoint, keys: j.keys, device: deviceName() } });
      toast("Notificações ativadas neste aparelho.");
    }
  } catch (e) { toast(e.message, true); }
  renderNotif();
};
$("#notif-test").onclick = async () => { try { const r = await api("/api/push/test", { method: "POST" }); toast(r.sent ? "Teste enviado. A notificação deve chegar em instantes." : "Nenhum aparelho recebeu. Desative e ative de novo.", !r.sent); } catch (e) { toast(e.message, true); } };
for (const [id, key] of [["n-links", "notify_links"], ["n-video", "notify_video"], ["n-login", "notify_login"], ["n-admin", "notify_admin"]]) $("#" + id).onchange = (e) => saveSetting(key, e.target.checked);

/* ---------- desempenho, vídeos leves e cache ---------- */
function renderPerf(p) {
  $("#perf-info").textContent = `Índice de arquivos: ${p.index_rows.toLocaleString("pt-BR")} itens · miniaturas em cache: ${fmtSize(p.cache.thumbs)} · versões leves de vídeo: ${fmtSize(p.cache.lite)} (limite ${fmtSize(p.cache.limit)}) · ffmpeg: ${p.ffmpeg ? "instalado" : "NÃO instalado"}.`;
  const a = $("#perf-auto"); a.checked = p.auto_lite; a.disabled = !p.ffmpeg;
}
$("#perf-auto").onchange = async (e) => { try { renderPerf(await api("/api/admin/perf", { json: { auto_lite: e.target.checked } })); toast(e.target.checked ? "Versões leves automáticas ligadas." : "Desligado."); } catch (err) { toast(err.message, true); } };
$("#perf-clear").onclick = async () => { if (!confirm("Limpar o cache? As miniaturas e versões leves serão refeitas quando alguém pedir.")) return; try { const r = await api("/api/admin/cache/clear", { method: "POST" }); toast(`${fmtSize(r.freed)} liberados.`); renderPerf(await api("/api/admin/perf")); } catch (e) { toast(e.message, true); } };
$("#perf-reindex").onclick = async () => {
  try { await api("/api/admin/reindex", { method: "POST" }); } catch (e) { return toast(e.message, true); }
  $("#perf-reindex").disabled = true; $("#perf-text").textContent = "Lendo o disco…";
  for (let i = 0; i < 600; i++) { await sleep(1000); const p = await api("/api/admin/perf").catch(() => null); if (p && p.index.state !== "running") { renderPerf(p); break; } }
  $("#perf-reindex").disabled = false; $("#perf-text").textContent = "Índice atualizado."; toast("Índice atualizado.");
};

/* ---------- corrigir datas das fotos (EXIF) ---------- */
let dfTimer = null, dfWas = false;
async function dfPoll() {
  clearTimeout(dfTimer);
  try {
    const st = await api("/api/admin/fix-dates"), run = st.state === "running";
    $("#df-text").textContent = run ? `${st.message} ${st.done} de ${st.total} · ${st.changed} corrigida(s)` : st.message || "";
    $("#df-start").disabled = run;
    if (run) { dfWas = true; dfTimer = setTimeout(dfPoll, 1200); } else if (dfWas) { dfWas = false; toast(st.message, st.state === "error"); }
  } catch {}
}
$("#df-start").onclick = async () => { try { await api("/api/admin/fix-dates", { method: "POST" }); dfWas = true; dfPoll(); } catch (e) { toast(e.message, true); } };

boot();
