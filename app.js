"use strict";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const API = (window.CASAOS_API || "").replace(/\/$/, "");
const abs = (u) => (u && u.startsWith("/") ? API + u : u);
const enc = encodeURIComponent;
const join = (a, b) => (a ? `${a}/${b}` : b);
const state = { me: null, view: "files", path: "", entries: [], mode: "list", photos: [], photosTotal: 0, photosBusy: false, lastMonth: "", grid: null };

/* ---------- ícones ---------- */
const ICONS = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  photos: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  list: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  play: '<path class="fill" d="M8 5v14l11-7z"/>',
  dots: '<circle class="fill" cx="12" cy="5" r="1.7"/><circle class="fill" cx="12" cy="12" r="1.7"/><circle class="fill" cx="12" cy="19" r="1.7"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
};
function icon(name) {
  const i = document.createElement("i"); i.className = "ico";
  i.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`; return i;
}
$$("[data-icon]").forEach((el) => el.append(icon(el.dataset.icon)));

/* ---------- utilidades ---------- */
function fmtSize(n) {
  if (n == null) return "";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
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

async function api(url, opts = {}) {
  const init = { ...opts, headers: { ...(opts.headers || {}) } };
  const token = store.get("casaos_token");
  if (token) init.headers.Authorization = "Bearer " + token;
  if (opts.json !== undefined) {
    init.method = init.method || "POST";
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.json);
  }
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

/* ---------- entrada (com status do servidor de casa) ---------- */
let healthTimer;
async function checkHealth() {
  const dot = $("#dot"), title = $("#hero-title"), detail = $("#hero-detail");
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000);
    const h = await (await fetch(API + "/api/health", { signal: ctl.signal })).json(); clearTimeout(t);
    if (h.storage_online) {
      dot.className = "dot on"; title.textContent = "Servidor de casa online.";
      detail.textContent = "Seus arquivos ficam no disco de casa, não no de ninguém.";
    } else {
      dot.className = "dot disk"; title.textContent = "O disco de casa está desconectado.";
      detail.textContent = "O servidor está ligado, mas o armazenamento não. Você consegue entrar, só não vai ver os arquivos até reconectar.";
    }
  } catch {
    dot.className = "dot"; title.textContent = "Servidor de casa desligado.";
    detail.textContent = "O notebook está desligado ou sem internet. Tentando de novo a cada poucos segundos.";
  }
}
function showLogin() {
  state.me = null; store.del("casaos_token");
  $("#app").hidden = true; $("#login").hidden = false;
  $("#login-form").password.value = "";
  checkHealth(); clearInterval(healthTimer); healthTimer = setInterval(checkHealth, 15000);
}
async function boot() {
  if (!store.get("casaos_token")) return showLogin();
  try { state.me = await api("/api/auth/me"); enterApp(); }
  catch (e) { if (e.offline) { showLogin(); } }
}
function enterApp() {
  clearInterval(healthTimer);
  $("#login").hidden = true; $("#app").hidden = false;
  $("#me-name").textContent = state.me.username;
  $("#nav-admin").hidden = !state.me.is_admin;
  renderMeter();
  setView("files");
}
$("#login-form").onsubmit = async (e) => {
  e.preventDefault(); $("#login-error").textContent = "";
  const f = e.target, btn = f.querySelector("button"); btn.disabled = true;
  try {
    const r = await api("/api/auth/login", { json: { username: f.username.value, password: f.password.value } });
    store.set("casaos_token", r.token); state.me = r.user; enterApp();
  } catch (err) { $("#login-error").textContent = err.message; }
  btn.disabled = false;
};
$("#btn-logout").onclick = async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); showLogin(); };
$("#btn-password").onclick = async () => {
  const current = await ask("Senha atual", "", "password"); if (!current) return;
  const nw = await ask("Nova senha (mínimo 8 caracteres)", "", "password"); if (!nw) return;
  try { await api("/api/auth/password", { json: { current, new: nw } }); toast("Senha alterada."); } catch (err) { toast(err.message, true); }
};

/* ---------- navegação ---------- */
function setView(v) {
  state.view = v; closeMenu();
  $$("main > section").forEach((s) => (s.hidden = s.id !== "view-" + v));
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  if (v === "files") loadDir(state.path);
  if (v === "photos") resetPhotos();
  if (v === "trash") loadTrash();
  if (v === "admin") loadAdmin();
}
$$(".nav-btn").forEach((b) => (b.onclick = () => setView(b.dataset.view)));

async function renderMeter() {
  try { state.me = await api("/api/auth/me"); } catch { return; }
  const { used_bytes: used, quota_bytes: quota } = state.me, fill = $("#meter-fill");
  if (used == null) { $("#meter-text").textContent = "Armazenamento offline"; fill.style.width = "0"; return; }
  if (quota) {
    const pct = Math.min(100, (used / quota) * 100);
    fill.style.width = pct + "%"; fill.classList.toggle("full", pct >= 90);
    $("#meter-text").textContent = `${fmtSize(used)} de ${fmtSize(quota)}`;
  } else { fill.style.width = "0"; $("#meter-text").textContent = `${fmtSize(used)} usados · sem limite`; }
}

/* ---------- menu de contexto (⋮) ---------- */
let openMenuEl = null;
function closeMenu() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; } }
function showMenu(anchor, actions) {
  closeMenu();
  const m = document.createElement("div"); m.className = "menu"; m.setAttribute("role", "menu");
  for (const [label, fn, cls] of actions) {
    const b = document.createElement("button"); b.textContent = label; b.setAttribute("role", "menuitem");
    if (cls) b.className = cls; b.onclick = () => { closeMenu(); fn(); }; m.append(b);
  }
  document.body.append(m); openMenuEl = m;
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8)) + "px";
  m.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + "px";
  m.querySelector("button").focus();
}
document.addEventListener("click", (e) => { if (openMenuEl && !openMenuEl.contains(e.target) && !e.target.closest(".more")) closeMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

/* ---------- arquivos ---------- */
async function loadDir(path) {
  try {
    const d = await api(`/api/files?path=${enc(path)}`);
    state.path = d.path; state.entries = d.entries; renderCrumbs(); renderEntries();
  } catch (err) {
    if (err.status === 404 && path) return loadDir("");
    toast(err.message, true);
  }
  renderMeter();
}
function renderCrumbs() {
  const nav = $("#crumbs"); nav.replaceChildren();
  const parts = state.path ? state.path.split("/") : [];
  const add = (label, path, last) => {
    const b = document.createElement("button"); b.textContent = label;
    if (last) b.setAttribute("aria-current", "page"); else b.onclick = () => loadDir(path);
    nav.append(b);
  };
  add("Meus arquivos", "", parts.length === 0);
  let acc = "";
  parts.forEach((p, i) => {
    const s = document.createElement("span"); s.className = "sep"; s.textContent = "/"; nav.append(s);
    acc = join(acc, p); add(p, acc, i === parts.length - 1);
  });
}
function thumbFor(e) {
  const t = document.createElement("span"); t.className = "thumb";
  if (e.thumb) { const img = document.createElement("img"); img.loading = "lazy"; img.alt = ""; img.src = abs(e.thumb); t.append(img); }
  else t.append(icon({ folder: "folder", video: "play", audio: "music" }[e.kind] || "file"));
  return t;
}
const MEDIA = ["image", "video", "audio"];
function renderEntries() {
  const ul = $("#list"); ul.replaceChildren();
  ul.className = "list " + (state.mode === "tiles" ? "tiles" : "rows");
  $("#mode-list").setAttribute("aria-pressed", state.mode === "list");
  $("#mode-tiles").setAttribute("aria-pressed", state.mode === "tiles");
  $("#empty").hidden = state.entries.length > 0;
  ul.hidden = state.entries.length === 0;
  const media = state.entries.filter((e) => MEDIA.includes(e.kind));
  for (const e of state.entries) {
    const path = join(state.path, e.name);
    const li = document.createElement("li"); li.className = state.mode === "tiles" ? "tile" : "row";
    const open = document.createElement("button"); open.className = "open";
    const label = document.createElement("b"); label.textContent = e.name;
    open.append(thumbFor(e), label);
    open.onclick = () => (e.is_dir ? loadDir(path) : MEDIA.includes(e.kind) ? openViewer(media, media.indexOf(e)) : download(e));
    li.append(open);
    if (state.mode === "list") {
      const meta = document.createElement("span"); meta.className = "meta";
      meta.textContent = [fmtSize(e.size), fmtDate(e.modified)].filter(Boolean).join(" · "); li.append(meta);
    }
    const more = document.createElement("button"); more.className = "more"; more.setAttribute("aria-label", `Ações para ${e.name}`);
    more.append(icon("dots"));
    more.onclick = () => showMenu(more, [
      ...(e.is_dir ? [] : [["Baixar", () => download(e)]]),
      ["Renomear", () => renameEntry(e, path)],
      ["Mover para a lixeira", () => removeEntry(e, path), "danger"],
    ]);
    li.append(more); ul.append(li);
  }
}
function download(e) {
  const a = document.createElement("a"); a.href = abs(e.dl); a.download = e.name; document.body.append(a); a.click(); a.remove();
}
async function renameEntry(e, path) {
  const name = await ask("Novo nome", e.name); if (!name || name === e.name) return;
  try { await api("/api/files/rename", { json: { path, new_name: name } }); loadDir(state.path); } catch (err) { toast(err.message, true); }
}
async function removeEntry(e, path) {
  try { await api(`/api/files?path=${enc(path)}`, { method: "DELETE" }); toast(`“${e.name}” foi para a lixeira.`); loadDir(state.path); }
  catch (err) { toast(err.message, true); }
}
$("#btn-folder").onclick = async () => {
  const name = await ask("Nome da nova pasta"); if (!name) return;
  try { await api("/api/files/folder", { json: { path: state.path, name } }); loadDir(state.path); } catch (err) { toast(err.message, true); }
};
function setMode(m) { state.mode = m; store.set("casaos_mode", m); renderEntries(); }
$("#mode-list").onclick = () => setMode("list");
$("#mode-tiles").onclick = () => setMode("tiles");
state.mode = store.get("casaos_mode") === "tiles" ? "tiles" : "list";

/* ---------- upload (progresso + data original das fotos) ---------- */
function sendFiles(files, path, ui, done) {
  files = [...files]; if (!files.length) return;
  const fd = new FormData();
  fd.append("mtimes", JSON.stringify(files.map((f) => f.lastModified || 0)));
  files.forEach((f) => fd.append("files", f, f.name));
  const total = files.reduce((s, f) => s + f.size, 0);
  ui.box.hidden = false; ui.fill.style.width = "0"; ui.text.textContent = `Enviando ${files.length} arquivo(s)…`;
  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API}/api/files/upload?path=${enc(path)}`);
  xhr.setRequestHeader("Authorization", "Bearer " + (store.get("casaos_token") || ""));
  xhr.upload.onprogress = (ev) => {
    if (!ev.lengthComputable) return;
    ui.fill.style.width = (ev.loaded / ev.total) * 100 + "%";
    ui.text.textContent = `Enviando… ${fmtSize(ev.loaded)} de ${fmtSize(total)}`;
  };
  xhr.onload = () => {
    ui.box.hidden = true;
    if (xhr.status === 401) return showLogin();
    if (xhr.status >= 300) {
      let msg = `Falha no envio (${xhr.status}).`;
      try { msg = JSON.parse(xhr.responseText).detail || msg; } catch {}
      toast(msg, true);
    } else toast(`${files.length} arquivo(s) enviado(s).`);
    done();
  };
  xhr.onerror = () => { ui.box.hidden = true; toast("Falha de conexão durante o envio.", true); };
  xhr.send(fd);
}
const filesUI = { box: $("#upload-status"), fill: $("#upload-fill"), text: $("#upload-text") };
$("#file-input").onchange = (e) => { sendFiles(e.target.files, state.path, filesUI, () => loadDir(state.path)); e.target.value = ""; };
const dz = $("#dropzone");
["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", (e) => sendFiles(e.dataTransfer.files, state.path, filesUI, () => loadDir(state.path)));

/* ---------- fotos ---------- */
const photoIO = new IntersectionObserver((en) => { if (en[0].isIntersecting) loadPhotos(); }, { rootMargin: "800px" });
function resetPhotos() {
  state.photos = []; state.photosTotal = 0; state.lastMonth = ""; state.grid = null;
  $("#mosaic").replaceChildren(); $("#photos-empty").hidden = true; loadPhotos(true);
}
async function loadPhotos(first = false) {
  if (state.photosBusy || (!first && state.photos.length >= state.photosTotal)) return;
  state.photosBusy = true; $("#sentinel").hidden = false;
  try {
    const d = await api(`/api/files/photos?offset=${state.photos.length}&limit=120`);
    state.photosTotal = d.total;
    for (const it of d.items) { state.photos.push(it); addShot(it, state.photos.length - 1); }
    $("#photos-empty").hidden = state.photosTotal > 0;
  } catch (err) { toast(err.message, true); }
  state.photosBusy = false;
  $("#sentinel").hidden = state.photos.length >= state.photosTotal;
  if (state.photos.length < state.photosTotal) photoIO.observe($("#sentinel")); else photoIO.unobserve($("#sentinel"));
  renderMeter();
}
function addShot(it, idx) {
  let month = new Date(it.modified * 1000).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  month = month.charAt(0).toUpperCase() + month.slice(1);
  if (month !== state.lastMonth) {
    const h = document.createElement("h3"); h.className = "month"; h.textContent = month;
    state.grid = document.createElement("div"); state.grid.className = "mosaic-grid";
    $("#mosaic").append(h, state.grid); state.lastMonth = month;
  }
  const b = document.createElement("button"); b.className = "shot"; b.setAttribute("aria-label", it.name);
  if (it.kind === "image") {
    const img = document.createElement("img"); img.loading = "lazy"; img.alt = ""; img.src = abs(it.thumb || it.view); b.append(img);
  } else {
    const v = document.createElement("video"); v.muted = true; v.preload = "metadata"; v.playsInline = true; v.src = abs(it.view) + "#t=0.1"; b.append(v);
    const badge = document.createElement("span"); badge.className = "badge"; badge.append(icon("play")); b.append(badge);
  }
  b.onclick = () => openViewer(state.photos, idx);
  state.grid.append(b);
}
$("#photo-input").onchange = async (e) => {
  const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
  try { await api("/api/files/folder", { json: { path: "", name: "Fotos" } }); } catch (err) { if (err.status !== 409) return toast(err.message, true); }
  sendFiles(files, "Fotos", { box: $("#photo-upload"), fill: $("#photo-fill"), text: $("#photo-text") }, resetPhotos);
};

/* ---------- visualizador ---------- */
let pv = { items: [], i: 0 };
function openViewer(items, i) { pv = { items, i: Math.max(0, i) }; showViewer(); $("#preview").showModal(); }
function showViewer() {
  const it = pv.items[pv.i], body = $("#pv-body"); body.replaceChildren();
  const el = document.createElement(it.kind === "image" ? "img" : it.kind === "video" ? "video" : "audio");
  if (it.kind === "image") { el.src = abs(it.large || it.view); el.alt = it.name; }
  else { el.src = abs(it.view); el.controls = true; el.autoplay = true; if (it.kind === "video") el.playsInline = true; }
  body.append(el);
  $("#pv-name").textContent = it.name;
  const dl = $("#pv-download"); dl.href = abs(it.dl); dl.download = it.name;
  $("#pv-prev").hidden = pv.i === 0; $("#pv-next").hidden = pv.i === pv.items.length - 1;
}
function step(d) { const n = pv.i + d; if (n >= 0 && n < pv.items.length) { pv.i = n; showViewer(); } }
$("#pv-prev").onclick = () => step(-1);
$("#pv-next").onclick = () => step(1);
$("#pv-close").onclick = () => $("#preview").close();
$("#preview").addEventListener("close", () => $("#pv-body").replaceChildren());
$("#preview").addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); });
(() => { // deslizar no celular
  let x0 = null; const pvEl = $("#preview");
  pvEl.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  pvEl.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); });
})();

/* ---------- lixeira ---------- */
async function loadTrash() {
  try {
    const d = await api("/api/trash");
    $("#trash-note").textContent = `Itens ficam aqui por ${d.days} dias e depois são apagados de vez. Eles contam no seu espaço.`;
    const ul = $("#trash-list"); ul.replaceChildren();
    $("#trash-empty").hidden = d.items.length > 0; ul.hidden = d.items.length === 0; $("#btn-empty").hidden = d.items.length === 0;
    ul.className = "list rows"; ul.style.margin = "0"; ul.style.border = "0";
    for (const t of d.items) {
      const li = document.createElement("li"); li.className = "row";
      const info = document.createElement("div"); info.className = "open";
      const th = document.createElement("span"); th.className = "thumb"; th.append(icon(t.is_dir ? "folder" : "file"));
      const col = document.createElement("div"); col.style.minWidth = "0";
      const nm = document.createElement("b"); nm.textContent = t.name; nm.style.display = "block";
      const sub = document.createElement("span"); sub.className = "small muted";
      sub.textContent = `${t.orig_path} · ${fmtSize(t.size)} · apaga em ${t.days_left} dia(s)`;
      col.append(nm, sub); info.append(th, col);
      const acts = document.createElement("div"); acts.className = "actions";
      const rb = document.createElement("button"); rb.textContent = "Restaurar";
      rb.onclick = async () => { try { const r = await api(`/api/trash/${t.id}/restore`, { method: "POST" }); toast(`Restaurado em /${r.path}`); loadTrash(); renderMeter(); } catch (e) { toast(e.message, true); loadTrash(); } };
      const xb = document.createElement("button"); xb.className = "danger"; xb.textContent = "Excluir de vez";
      xb.onclick = async () => { if (!confirm(`Excluir “${t.name}” definitivamente?`)) return; try { await api(`/api/trash/${t.id}`, { method: "DELETE" }); loadTrash(); renderMeter(); } catch (e) { toast(e.message, true); } };
      acts.append(rb, xb); li.append(info, document.createElement("span"), acts); ul.append(li);
    }
  } catch (err) { toast(err.message, true); }
}
$("#btn-empty").onclick = async () => {
  if (!confirm("Esvaziar a lixeira? Isso apaga tudo dela de vez.")) return;
  try { await api("/api/trash", { method: "DELETE" }); loadTrash(); renderMeter(); } catch (e) { toast(e.message, true); }
};

/* ---------- administração ---------- */
const ACTION_LABEL = {
  login: "Entrou", login_falhou: "Tentativa de login falhou", login_bloqueado: "Login de conta bloqueada",
  senha_alterada: "Trocou a própria senha", senha_redefinida: "Senha redefinida", usuario_criado: "Usuário criado",
  usuario_bloqueado: "Usuário bloqueado", usuario_desbloqueado: "Usuário desbloqueado", usuario_removido: "Usuário removido",
  limite_alterado: "Limite alterado", limite_removido: "Limite removido", upload: "Enviou arquivos", pasta_criada: "Criou pasta",
  renomeado: "Renomeou", enviado_para_lixeira: "Mandou para a lixeira", restaurado: "Restaurou da lixeira",
  excluido_definitivamente: "Excluiu de vez", lixeira_esvaziada: "Esvaziou a lixeira",
};
function cell(row, text) { const c = row.insertCell(); c.textContent = text; return c; }
async function loadAdmin() {
  let st, users, logs;
  try { [st, users, logs] = await Promise.all([api("/api/admin/storage"), api("/api/admin/users"), api("/api/admin/logs?limit=80")]); }
  catch (e) { return toast(e.message, true); }
  const card = $("#storage-card"); card.replaceChildren();
  const head = document.createElement("div");
  const pill = document.createElement("span"); pill.className = "pill" + (st.online ? "" : " off"); pill.textContent = st.online ? "Disponível" : "Offline";
  const path = document.createElement("code"); path.textContent = "  " + st.path; head.append(pill, path); card.append(head);
  if (st.online) {
    const stat = document.createElement("div"); stat.className = "stat";
    [["Total do disco", fmtSize(st.total)], ["Livre no disco", fmtSize(st.free)], ["Usado pela nuvem", fmtSize(st.used_by_cloud)], ["Usuários", st.users]].forEach(([k, v]) => {
      const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
      b.textContent = v; s.className = "muted small"; s.textContent = k; d.append(b, s); stat.append(d);
    });
    card.append(stat);
  } else {
    const p = document.createElement("p"); p.className = "muted"; p.textContent = "Os arquivos não foram perdidos. Reconecte o disco; novos envios ficam bloqueados até lá."; card.append(p);
  }
  renderUsers(users); renderLogs(logs);
}
function renderUsers(users) {
  const t = $("#users"); t.replaceChildren();
  const head = t.insertRow(); ["Usuário", "Espaço usado", "Limite", "Situação", ""].forEach((h) => { const th = document.createElement("th"); th.textContent = h; head.append(th); });
  for (const u of users) {
    const r = t.insertRow();
    cell(r, u.username + (u.is_admin ? " (admin)" : ""));
    cell(r, u.used_bytes == null ? "—" : fmtSize(u.used_bytes));
    cell(r, u.quota_bytes ? fmtSize(u.quota_bytes) : "Sem limite");
    cell(r, u.is_blocked ? "Bloqueado" : "Ativo");
    const acts = document.createElement("div"); acts.className = "actions";
    const patch = (body) => api(`/api/admin/users/${u.id}`, { method: "PATCH", json: body }).then(loadAdmin).catch((e) => ($("#user-error").textContent = e.message));
    const mk = (label, fn, cls) => { const b = document.createElement("button"); b.textContent = label; b.onclick = fn; if (cls) b.className = cls; return b; };
    acts.append(
      mk("Senha", async () => { const p = await ask(`Nova senha para ${u.username}`, "", "password"); if (p) patch({ password: p }); }),
      mk("Limite", async () => {
        const v = await ask("Limite em GB (0 ou vazio = sem limite)", u.quota_bytes ? String(+(u.quota_bytes / 1024 ** 3).toFixed(2)) : "");
        if (v === null) return; const n = parseFloat(v.replace(",", ".")); patch(!n ? { clear_quota: true } : { quota_gb: n });
      }),
    );
    if (u.id !== state.me.id) acts.append(
      mk(u.is_blocked ? "Desbloquear" : "Bloquear", () => patch({ is_blocked: !u.is_blocked })),
      mk("Remover", () => {
        if (!confirm(`Remover ${u.username}? Os arquivos vão para a pasta .removidos do armazenamento, nada é apagado.`)) return;
        api(`/api/admin/users/${u.id}`, { method: "DELETE" }).then(loadAdmin).catch((e) => ($("#user-error").textContent = e.message));
      }, "danger"),
    );
    r.insertCell().append(acts);
  }
}
function renderLogs(logs) {
  const t = $("#logs"); t.replaceChildren();
  const head = t.insertRow(); ["Quando", "Quem", "O que", "Detalhe", "IP"].forEach((h) => { const th = document.createElement("th"); th.textContent = h; head.append(th); });
  for (const l of logs) {
    const r = t.insertRow();
    cell(r, new Date(l.ts.replace(" ", "T") + "Z").toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }));
    cell(r, l.username || "—"); cell(r, ACTION_LABEL[l.action] || l.action); cell(r, l.detail || ""); cell(r, l.ip || "");
  }
}
$("#user-form").onsubmit = async (e) => {
  e.preventDefault(); $("#user-error").textContent = "";
  const f = e.target, q = parseFloat(f.quota.value);
  try {
    await api("/api/admin/users", { json: { username: f.username.value, password: f.password.value, quota_gb: isNaN(q) ? null : q, is_admin: f.is_admin.checked } });
    f.reset(); loadAdmin();
  } catch (err) { $("#user-error").textContent = err.message; }
};

boot();
