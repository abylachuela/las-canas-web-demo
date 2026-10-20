/* =========================================================================
   Hotel Las Cañas — efecto 3D de inclinación (tilt) para las fotos.
   - Se aplica a los elementos con la clase .tilt3d (tarjetas de atracciones
     cercanas y elementos de la galería).
   - Al mover el puntero sobre el elemento se calcula una rotación proporcional
     (rotateX / rotateY, máx. ~9°) más un leve translateZ/scale para dar relieve;
     al salir se restablece con suavidad.
   - Brillo (glare) sutil que sigue al cursor mediante variables CSS.
   - Suavizado con requestAnimationFrame.
   - Respeta prefers-reduced-motion y se desactiva en pantallas táctiles.
   - Sin <script> inline ni atributos on*: compatible con CSP estricta.
   ========================================================================= */
(function () {
  'use strict';

  // Solo con puntero fino, con hover real y sin preferencia de menos movimiento.
  var apto = window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!apto) return;

  var MAX_DEG = 9;     // inclinación máxima (grados)
  var LIFT = 14;       // relieve (translateZ en px)
  var SCALE = 1.03;    // leve acercamiento

  function activar(el) {
    var rafId = null;
    var pend = null; // { x, y } relativos al elemento

    function pintar() {
      rafId = null;
      if (!pend) return;
      var rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Posición relativa normalizada a [-1, 1] desde el centro.
      var px = (pend.x / rect.width) * 2 - 1;
      var py = (pend.y / rect.height) * 2 - 1;
      px = Math.max(-1, Math.min(1, px));
      py = Math.max(-1, Math.min(1, py));
      var rotY = px * MAX_DEG;
      var rotX = -py * MAX_DEG;
      el.style.transform =
        'perspective(900px) rotateX(' + rotX.toFixed(2) + 'deg) rotateY(' +
        rotY.toFixed(2) + 'deg) translateZ(' + LIFT + 'px) scale(' + SCALE + ')';
      // Brillo que sigue al cursor.
      el.style.setProperty('--gx', ((pend.x / rect.width) * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', ((pend.y / rect.height) * 100).toFixed(1) + '%');
    }

    function programar(e) {
      var rect = el.getBoundingClientRect();
      pend = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (rafId === null) rafId = window.requestAnimationFrame(pintar);
    }

    el.addEventListener('mouseenter', function () {
      el.classList.add('is-tilting');
      el.style.setProperty('--tilt-glare', '0.35');
    });
    el.addEventListener('mousemove', programar);
    el.addEventListener('mouseleave', function () {
      if (rafId !== null) { window.cancelAnimationFrame(rafId); rafId = null; }
      pend = null;
      el.classList.remove('is-tilting');
      el.style.transform = '';
      el.style.setProperty('--tilt-glare', '0');
    });
  }

  function iniciar() {
    var els = document.querySelectorAll('.tilt3d');
    for (var i = 0; i < els.length; i++) activar(els[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
