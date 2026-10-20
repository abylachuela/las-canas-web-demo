/* Aplica el tema antes de pintar (evita parpadeo). Externo para cumplir la CSP
   estricta de producción (script-src 'self', sin scripts inline).
   Orden: localStorage('tema') -> <html data-tema-defecto> -> 'esmeralda'. */
(function () {
  var validos = ['esmeralda', 'costa-azul', 'carbon-oro', 'editorial-blanco'];
  var tema;
  try { var s = localStorage.getItem('tema'); if (validos.indexOf(s) >= 0) tema = s; } catch (e) { /* sin acceso */ }
  if (!tema) {
    var def = document.documentElement.getAttribute('data-tema-defecto');
    if (validos.indexOf(def) >= 0) tema = def;
  }
  document.documentElement.setAttribute('data-theme', tema || 'esmeralda');
})();
