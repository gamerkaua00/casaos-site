// Roda antes de desenhar a página: aplica tema, cor e tamanho das fotos já salvos, sem "piscar".
(function () {
  var r = document.documentElement;
  var ok = ["auto", "claro", "escuro", "preto-neon", "azul-neon", "preto-ouro", "roxo-neon", "rosa-neon", "floresta"];
  try {
    var p = JSON.parse(localStorage.getItem("casaos_prefs") || "{}");
    var t = { light: "claro", dark: "escuro" }[p.theme] || p.theme || "auto";
    if (ok.indexOf(t) < 0) t = "auto";
    if (t === "auto") t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
    r.dataset.theme = t; r.dataset.mode = t === "claro" ? "light" : "dark";
    r.dataset.accent = p.accent || "cobalto"; r.dataset.photo = p.photo_size || "medium";
  } catch (e) { r.dataset.theme = "claro"; r.dataset.mode = "light"; r.dataset.accent = "cobalto"; r.dataset.photo = "medium"; }
})();
