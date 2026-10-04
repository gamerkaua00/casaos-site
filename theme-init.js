// Roda antes de desenhar a página: aplica tema, cor e tamanho das fotos já salvos, sem "piscar".
(function () {
  var r = document.documentElement;
  try {
    var p = JSON.parse(localStorage.getItem("casaos_prefs") || "{}");
    var t = p.theme || "auto";
    var dark = t === "dark" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    r.dataset.mode = dark ? "dark" : "light";
    r.dataset.accent = p.accent || "cobalto";
    r.dataset.photo = p.photo_size || "medium";
  } catch (e) { r.dataset.mode = "light"; r.dataset.accent = "cobalto"; r.dataset.photo = "medium"; }
})();
