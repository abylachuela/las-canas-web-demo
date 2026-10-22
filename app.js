/* =========================================================================
   Hotel Las Cañas — lógica del frontend (JS vanilla, sin dependencias)
   - Reserva en 2 pasos: Paso 1 crear cuenta / iniciar sesión; Paso 2 elegir
     habitación y confirmar. La disponibilidad y la reserva requieren sesión
     (401 sin cuenta), por eso solo se muestran DESPUÉS de autenticarse.
   - Clientes que regresan: "Ingresar" en el header (POST /api/login).
   - Modales accesibles (focus trap, Escape, backdrop, foco devuelto).
   ========================================================================= */
'use strict';

/* ----------------------------- Utilidades ----------------------------- */
const $ = (id) => document.getElementById(id);
const DIA_MS = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Estado de sesión en memoria (reflejo de GET /api/yo).
let usuario = null;
// Acción a reanudar automáticamente tras autenticarse (p. ej. seguir reservando).
let accionPendiente = null;

/**
 * Envoltorio de fetch que siempre devuelve { ok, status, data }.
 * Las cookies de sesión viajan solas (mismo origen).
 * Lanza solo ante errores de red; los errores HTTP vienen en el objeto.
 */
// Backend por defecto (el túnel). Así el demo funciona con solo abrir
// .../las-canas-web-demo/ SIN tener que pasar ?api=. Se puede cambiar con
// ?api=<otra-URL> y volver al modo estático con ?api=off.
const API_DEFECTO = 'https://jamie-loan-mesh-roses.trycloudflare.com';
async function pedir(url, opciones = {}) {
  let base = API_DEFECTO;
  try { base = localStorage.getItem('apiBase') || API_DEFECTO; } catch (e) { /* storage bloqueado */ }
  const opts = { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opciones };
  const destino = (b) => (b && typeof url === 'string' && url.indexOf('/api') === 0) ? b + url : url;
  // Códigos que indican que el backend no está ahí (túnel caído, página de error de Cloudflare), no un error de la app.
  const infraCaida = (s) => s === 0 || s === 404 || s === 405 || s >= 500;
  const intentar = async (b) => {
    const res = await fetch(destino(b), opts);
    let data = {};
    try { data = await res.json(); } catch { /* respuesta sin cuerpo JSON */ }
    return { ok: res.ok, status: res.status, data };
  };
  try {
    const r = await intentar(base);
    // Si el destino guardado (p. ej. un túnel viejo de un ?api= anterior) ya no sirve,
    // reintenta con el backend por defecto y lo adopta para no volver a fallar.
    if (!r.ok && infraCaida(r.status) && base !== API_DEFECTO && API_DEFECTO) {
      const r2 = await intentar(API_DEFECTO);
      try { localStorage.setItem('apiBase', API_DEFECTO); } catch (e) {}
      return r2;
    }
    return r;
  } catch (err) {
    // Error de red (DNS/conexión/CORS): el destino guardado no responde.
    if (base !== API_DEFECTO && API_DEFECTO) {
      const r2 = await intentar(API_DEFECTO);
      try { localStorage.setItem('apiBase', API_DEFECTO); } catch (e) {}
      return r2;
    }
    throw err;
  }
}

// Activa/desactiva el estado de carga de un botón (spinner + bloqueo).
function cargando(btn, activo) {
  if (!btn) return;
  if (activo) { btn.dataset.loading = 'true'; btn.disabled = true; }
  else { delete btn.dataset.loading; btn.disabled = false; }
}

/* ------------------------ Validación de campos ------------------------ */
function marcarError(input, errEl, msg) {
  input.setAttribute('aria-invalid', 'true');
  if (errEl) errEl.textContent = msg;
  return false;
}
function limpiarError(input, errEl) {
  input.removeAttribute('aria-invalid');
  if (errEl) errEl.textContent = '';
}
function autolimpiar(input, errEl) {
  input.addEventListener('input', () => limpiarError(input, errEl));
}
const telValido = (v) => v.replace(/\D/g, '').length >= 7;

/* ============================ Multi-idioma (ES / EN) ============================
   Sin dependencias y compatible con CSP estricta (todo el JS vive aquí).
   - Los textos estáticos del HTML llevan data-i18n (texto), data-i18n-html
     (contenido con marcado), data-i18n-ph (placeholder), data-i18n-alt (alt) y
     data-i18n-aria (aria-label).
   - Los textos que genera el JS usan t(clave, params).
   - La elección se guarda en localStorage ("idioma") y se aplica en vivo.
   ============================================================================= */
const IDIOMAS = ['es', 'en'];
const IDIOMA_KEY = 'idioma';
let idiomaActual = 'es';
const LOCALE_FECHA = { es: 'es-DO', en: 'en-US' };

const I18N = {
  es: {
    /* Navegación */
    'nav.skip': 'Saltar al contenido',
    'nav.brandAria': 'Hotel Las Cañas, inicio',
    'nav.sectionsAria': 'Secciones del sitio',
    'nav.inicio': 'Inicio',
    'nav.experiencia': 'Experiencia',
    'nav.habitaciones': 'Habitaciones',
    'nav.galeria': 'Galería',
    'nav.resenas': 'Reseñas',
    'nav.ubicacion': 'Ubicación',
    'nav.cancelar': 'Cancelar reserva',
    'nav.burger': 'Abrir menú',
    'theme.btn': 'Tema',
    'theme.menuAria': 'Elegir tema',
    'theme.title': 'Tema',
    /* Hero */
    'hero.eyebrow': 'La Romana · República Dominicana',
    'hero.title': 'Tu descanso<br /><em>en La Romana</em>',
    'hero.lede': 'Nos sentimos en familia',
    'hero.scrollAria': 'Desplázate para ver más',
    /* Buscador de reserva */
    'booking.srTitle': 'Buscar disponibilidad',
    'booking.cardtitle': 'Reserva tu estadía',
    'booking.llegada': 'Llegada',
    'booking.salida': 'Salida',
    'booking.huespedes': 'Huéspedes',
    'booking.g1': '1 adulto · 1 habitación',
    'booking.g2': '2 adultos · 1 habitación',
    'booking.g3': '3 adultos · 1 habitación',
    'booking.g4': '4 adultos · 2 habitaciones',
    'booking.go': 'Reservar',
    /* Intro / experiencia */
    'intro.eyebrow': 'La experiencia',
    'intro.title': 'Una pausa serena en la costa sureste.',
    'intro.lede': 'Habitaciones cuidadas, piscina al aire libre y la calma de La Romana para descansar de verdad, lejos del ruido.',
    'intro.stat1': 'La Romana', 'intro.lbl1': 'costa sureste de RD',
    'intro.stat2': 'Playa Dominicus', 'intro.lbl2': 'en Bayahíbe',
    'intro.stat3': 'Piscina', 'intro.lbl3': 'al aire libre',
    'intro.stat4': '3 tipos', 'intro.lbl4': 'Sencilla · Doble · Aparta Hotel',
    /* Comodidades */
    'am.eyebrow': 'Comodidades',
    'am.title': 'Pensado para tu descanso.',
    'am.wifi': 'Wi-Fi',
    'am.piscina': 'Piscina',
    'am.restaurante': 'Restaurante',
    'am.aire': 'Aire acondicionado',
    'am.tv': 'Smart TV',
    'am.agua': 'Agua caliente',
    /* Habitaciones */
    'rooms.eyebrow': 'Habitaciones',
    'rooms.title': 'Elige tu habitación.',
    'rooms.lede': 'Espacios cuidados para una estadía tranquila, con todo lo esencial.',
    'rooms.loading': 'Cargando habitaciones…',
    /* Piscina y restaurante */
    'feat.srTitle': 'Piscina y restaurante',
    'feat.p.alt': 'Piscina grande del Hotel Las Cañas rodeada de palmeras',
    'feat.p.eyebrow': 'Al aire libre',
    'feat.p.title': 'Piscina',
    'feat.p.text': 'Un espacio tranquilo para refrescarte y soltar el viaje bajo el sol del Caribe.',
    'feat.r.alt': 'Mesa servida en el restaurante (imagen de muestra)',
    'feat.r.eyebrow': 'Para comenzar el día',
    'feat.r.title': 'Restaurante',
    'feat.r.text': 'Desayuna sin prisa o disfruta de un plato tranquilo durante tu estadía.',
    /* Galería (alt) */
    'gal.eyebrow': 'Galería',
    'gal.title': 'Un vistazo al hotel.',
    'gal.recepcion': 'Recepción y lobby del hotel',
    'gal.piscinaMain': 'Piscina principal del hotel rodeada de palmeras',
    'gal.jacuzzi': 'Piscina con jacuzzi del hotel',
    'gal.restaurante': 'Restaurante y terraza del hotel',
    'gal.aparta': 'Sala del Aparta Hotel',
    'gal.sencilla': 'Habitación sencilla',
    'gal.doble': 'Habitación doble',
    'gal.fachada': 'Fachada y exterior del hotel',
    'gal.bano': 'Baño de la habitación',
    /* Ubicación */
    'place.eyebrow': 'Dónde estamos',
    'place.title': 'La Romana.',
    'place.lede': 'En la costa sureste de la República Dominicana, cerca de Playa Dominicus. Ideal para unos días de descanso con el mar a la mano.',
    'place.map': 'Ver en el mapa',
    /* Cerca del hotel */
    'nearby.eyebrow': 'Cerca del hotel',
    'nearby.title': 'Qué visitar en La Romana y alrededores',
    'nearby.c1': 'Aldea mediterránea de piedra con talleres de arte, un anfiteatro y vistas al río Chavón.',
    'nearby.c2': 'Arte rupestre taíno y formaciones de estalactitas, sobre la misma carretera hacia San Pedro.',
    'nearby.c3': 'Playas de arena blanca y arrecifes de coral para bucear y hacer snorkel, frente a la costa.',
    'nearby.c4': 'Pueblo de pescadores y punto de salida en catamarán hacia la paradisíaca Isla Saona.',
    'nearby.c5': 'Puerto de lujo con restaurantes, boutiques y yates, a pocos minutos del hotel.',
    'nearby.c6': 'Arena blanca y aguas turquesa en Bayahíbe, una de las mejores playas del sureste para un día de sol.',
    'nearby.map': 'Ver en el mapa →',
    'nearby.note': 'Distancias y tiempos son aproximados; conviene confirmarlos antes de salir.',
    'nearby.img1': 'Altos de Chavón, aldea mediterránea de piedra sobre el río Chavón',
    'nearby.img2': 'Cueva de las Maravillas con arte rupestre taíno y estalactitas',
    'nearby.img3': 'Isla Catalina, playa de arena blanca y arrecifes de coral',
    'nearby.img4': 'Bayahíbe e Isla Saona, playas paradisíacas del Caribe',
    'nearby.img5': 'Marina Casa de Campo con yates y restaurantes de lujo',
    'nearby.img6': 'Playa Dominicus, arena blanca y aguas turquesa en Bayahíbe',
    /* Reseñas de huéspedes */
    'rev.eyebrow': 'Reseñas',
    'rev.title': 'Reseñas de huéspedes',
    'rev.lede': 'Lo que cuentan quienes ya se hospedaron con nosotros.',
    'rev.loading': 'Cargando reseñas…',
    'rev.empty': 'Aún no hay reseñas. ¡Sé el primero en compartir tu experiencia!',
    'rev.error': 'No se pudieron cargar las reseñas.',
    'rev.needLogin': 'Inicia sesión para dejar tu reseña.',
    'rev.loginBtn': 'Ingresar',
    'rev.formHint': 'Cuéntanos cómo fue tu estadía.',
    'rev.yourRating': 'Tu calificación',
    'rev.comment': 'Tu comentario',
    'rev.commentPh': 'Qué te gustó de tu estadía…',
    'rev.send': 'Enviar reseña',
    'rev.thanks': '¡Gracias por tu reseña!',
    'rev.sendFail': 'No se pudo enviar tu reseña.',
    'rev.pickRating': 'Elige una calificación.',
    'rev.needComment': 'Escribe un comentario.',
    'rev.session': 'Tu sesión expiró. Vuelve a iniciar sesión para dejar tu reseña.',
    'rev.ratingLabel': 'Calificación: {n} de 5',
    'rev.stars1': '1 estrella',
    'rev.stars2': '2 estrellas',
    'rev.stars3': '3 estrellas',
    'rev.stars4': '4 estrellas',
    'rev.stars5': '5 estrellas',
    /* Pie */
    'foot.motto': 'Nos sentimos en familia.',
    'foot.socialAria': 'Redes sociales',
    'foot.contacto': 'Contacto',
    'foot.ubicacion': 'Ubicación',
    'foot.copy': 'Hotel Las Cañas',
    'foot.copy2': 'La Romana, República Dominicana',
    'foot.legalAria': 'Documentos legales',
    'foot.priv': 'Privacidad',
    'foot.cookies': 'Cookies',
    'foot.terms': 'Términos',
    /* Modales: comunes */
    'modal.close': 'Cerrar',
    /* Campos comunes */
    'field.email': 'Correo',
    'field.pass': 'Contraseña',
    'field.nombre': 'Nombre completo',
    'field.tel': 'Teléfono',
    'field.cedula': 'Cédula',
    'field.direccion': 'Dirección',
    'field.comentario': 'Comentario',
    'field.opcional': '(opcional)',
    /* Placeholders */
    'ph.email': 'tu@correo.com',
    'ph.pass': 'Tu contraseña',
    'ph.pass6': 'Mínimo 6 caracteres',
    'ph.nombre': 'Tu nombre',
    'ph.tel': '809-000-0000',
    'ph.cedula': '000-0000000-0',
    'ph.direccion': 'Tu dirección',
    'ph.comentario': 'Hora de llegada, preferencias…',
    'ph.ccName': 'Nombre en la tarjeta',
    'ph.ccExp': 'MM/AA',
    'ph.numEj': 'Ej. 92552',
    /* Modal autenticación */
    'auth.title': 'Ingresar',
    'auth.sub': 'Entra con tu cuenta para continuar. ¿Primera vez? Crea tu cuenta al reservar.',
    'auth.submit': 'Ingresar',
    'auth.olvidaste': '¿Olvidaste tu contraseña?',
    'recuperar.enviado': 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.',
    'reset.title': 'Nueva contraseña',
    'reset.sub': 'Escribe tu nueva contraseña.',
    'reset.nueva': 'Nueva contraseña',
    'reset.confirmar': 'Repite la contraseña',
    'reset.submit': 'Guardar contraseña',
    'reset.noCoincide': 'Las contraseñas no coinciden.',
    'reset.ok': 'Contraseña actualizada. Ya puedes iniciar sesión.',
    'reset.fail': 'No se pudo restablecer. El enlace pudo expirar.',
    /* Modal reserva */
    'resv.title': 'Reservar',
    'resv.stepsAria': 'Pasos de la reserva',
    'resv.step1': 'Cuenta',
    'resv.step2': 'Habitación',
    'resv.step3': 'Pago',
    'resv.regHint': 'Crea tu cuenta para continuar con la reserva.',
    'resv.promos': 'Quiero recibir ofertas y promociones por correo',
    'resv.btnReg': 'Crear cuenta y continuar',
    'resv.yaCuenta': '¿Ya tienes cuenta?',
    'resv.iniciaSesion': 'Inicia sesión',
    'resv.loginHint': 'Inicia sesión para continuar con la reserva.',
    'resv.btnLoginP1': 'Iniciar sesión y continuar',
    'resv.primeraVez': '¿Primera vez?',
    'resv.creaCuenta': 'Crea tu cuenta',
    'resv.aNombre': 'A nombre de',
    'resv.elegirTipo': 'Elige el tipo de habitación',
    'resv.total': 'Total',
    'resv.continuarPago': 'Continuar al pago',
    'resv.completarReserva': 'Completar reserva',
    'resv.reservarOficina': 'Reservar (pago en oficina)',
    'pago.comoPagar': '¿Cómo deseas pagar?',
    'pago.enLinea': 'Pagar en línea',
    'pago.enLineaDesc': 'Con tarjeta ahora. La reserva se confirma al completar el pago.',
    'pago.enOficina': 'Pagar en la oficina',
    'pago.enOficinaDesc': 'Reservas ahora y pagas al llegar al hotel.',
    'resv.pickType': 'Elige un tipo de habitación para continuar.',
    'resv.saveFail': 'No se pudo registrar la reserva.',
    /* Pago */
    'pay.total': 'Total a pagar',
    'pay.note': 'Pago en modo prueba — no se realiza un cobro real.',
    'pay.titular': 'Titular de la tarjeta',
    'pay.numero': 'Número de tarjeta',
    'pay.venc': 'Vencimiento',
    'pay.cvv': 'CVV',
    'pay.submit': 'Pagar y confirmar',
    'pay.volver': 'Volver',
    'pay.accept': 'Aceptamos: {lista}.',
    'pay.titularReq': 'Indica el titular.',
    'pay.cardInvalid': 'Número de tarjeta no válido.',
    'pay.notAccepted': 'No aceptamos {marca}. Tarjetas aceptadas: {lista}.',
    'pay.useExp': 'Usa MM/AA.',
    'pay.expired': 'Tarjeta vencida.',
    'pay.cvvInvalid': 'CVV no válido.',
    'pay.payFail': 'No se pudo completar el pago.',
    /* Éxito */
    'ok.leadPaid': '¡Reserva confirmada y pagada!',
    'ok.lead': '¡Reserva confirmada!',
    'ok.num': 'Reserva N.º',
    'ok.keep': 'Guarda tu número para cancelar si lo necesitas.',
    'ok.done': 'Listo',
    'ok.room': 'Habitación {codigo}',
    'ok.paidWith': 'Pagado con <strong>{marca} ****{u4}</strong>{sim}.',
    'ok.testMode': ' (modo prueba)',
    /* Cancelación */
    'cancel.title': 'Cancelar reserva',
    'cancel.sub': 'Escribe tu número de reserva y el teléfono con el que reservaste.',
    'cancel.numero': 'Número de reserva',
    'cancel.submit': 'Cancelar mi reserva',
    'cancel.numReq': 'Indica tu número de reserva.',
    'cancel.done': 'Reserva #{numero} cancelada.',
    'cancel.fail': 'No se pudo cancelar la reserva.',
    /* Mis reservas */
    'mis.title': 'Mis reservas',
    'mis.sub': 'Consulta, cancela o cambia las fechas de tus reservas.',
    'mis.loading': 'Cargando tus reservas…',
    'mis.connError': 'Error de conexión al cargar tus reservas.',
    'mis.loadFail': 'No se pudieron cargar tus reservas.',
    'mis.empty': 'Aún no tienes reservas.',
    'mis.arrival': 'Llegada {fecha}',
    'mis.modificar': 'Modificar fechas',
    'mis.cancelar': 'Cancelar',
    'mis.nuevaLlegada': 'Nueva llegada',
    'mis.nuevaSalida': 'Nueva salida',
    'mis.guardar': 'Guardar fechas',
    'mis.descartar': 'Descartar',
    'mis.pickBoth': 'Elige las dos fechas.',
    'mis.pastArrival': 'La llegada no puede ser pasada.',
    'mis.afterArrival': 'La salida debe ser posterior a la llegada.',
    'mis.changeFail': 'No se pudieron cambiar las fechas.',
    'badge.activa': 'Activa',
    'badge.hospedada': 'Hospedada',
    'badge.cancelada': 'Cancelada',
    /* Lightbox / volver arriba */
    'lb.aria': 'Imagen ampliada',
    'toTop.aria': 'Volver arriba',
    /* Cuenta (header) */
    'account.hi': 'Hola, {nombre}',
    'account.mis': 'Mis reservas',
    'account.salir': 'Salir',
    'account.ingresar': 'Ingresar',
    'account.cambiar': 'Cambiar contraseña',
    'cpass.title': 'Cambiar contraseña',
    'cpass.sub': 'Actualiza tu contraseña. Te enviaremos un correo de confirmación.',
    'cpass.actual': 'Contraseña actual',
    'cpass.nueva': 'Nueva contraseña',
    'cpass.confirmar': 'Repite la nueva contraseña',
    'cpass.submit': 'Guardar contraseña',
    'cpass.ok': 'Contraseña actualizada. Te enviamos un correo de confirmación.',
    /* Catálogo */
    'catalogo.error': 'No se pudo cargar el catálogo.',
    'card.sample': '(imagen de muestra)',
    'card.perNight': '/ noche',
    /* Disponibilidad */
    'disp.checking': 'Consultando disponibilidad…',
    'disp.none': 'No hay habitaciones disponibles para esas fechas. Prueba con otras.',
    'disp.one': '1 habitación disponible para esas fechas.',
    'disp.many': '{n} habitaciones disponibles para esas fechas.',
    /* Validación / sesión / red */
    'err.email': 'Correo no válido.',
    'err.min6': 'Mínimo 6 caracteres.',
    'err.nombre': 'Indica tu nombre.',
    'err.tel': 'Teléfono no válido.',
    'booking.pickDates': 'Elige las fechas de llegada y salida.',
    'booking.pastArrival': 'La llegada no puede ser una fecha pasada.',
    'booking.afterArrival': 'La salida debe ser posterior a la llegada.',
    'login.fail': 'No se pudo iniciar sesión.',
    'login.wrong': 'Correo o contraseña incorrectos.',
    'reg.fail': 'No se pudo crear la cuenta.',
    'net.error': 'Error de conexión. Intenta de nuevo.',
    'net.serverError': 'Error de conexión con el servidor.',
    'session.expired': 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.',
    'holder.tel': 'Tel. {tel}',
    /* Plurales */
    'night_one': 'noche',
    'night_other': 'noches',
  },
  en: {
    /* Navigation */
    'nav.skip': 'Skip to content',
    'nav.brandAria': 'Hotel Las Cañas, home',
    'nav.sectionsAria': 'Site sections',
    'nav.inicio': 'Home',
    'nav.experiencia': 'Experience',
    'nav.habitaciones': 'Rooms',
    'nav.galeria': 'Gallery',
    'nav.resenas': 'Reviews',
    'nav.ubicacion': 'Location',
    'nav.cancelar': 'Cancel booking',
    'nav.burger': 'Open menu',
    'theme.btn': 'Theme',
    'theme.menuAria': 'Choose theme',
    'theme.title': 'Theme',
    /* Hero */
    'hero.eyebrow': 'La Romana · Dominican Republic',
    'hero.title': 'Your getaway<br /><em>in La Romana</em>',
    'hero.lede': 'We feel like family',
    'hero.scrollAria': 'Scroll to see more',
    /* Booking search */
    'booking.srTitle': 'Check availability',
    'booking.cardtitle': 'Book your stay',
    'booking.llegada': 'Check-in',
    'booking.salida': 'Check-out',
    'booking.huespedes': 'Guests',
    'booking.g1': '1 adult · 1 room',
    'booking.g2': '2 adults · 1 room',
    'booking.g3': '3 adults · 1 room',
    'booking.g4': '4 adults · 2 rooms',
    'booking.go': 'Book now',
    /* Intro / experience */
    'intro.eyebrow': 'The experience',
    'intro.title': 'A serene pause on the southeast coast.',
    'intro.lede': 'Well-kept rooms, an outdoor pool and the calm of La Romana for real rest, far from the noise.',
    'intro.stat1': 'La Romana', 'intro.lbl1': 'southeast coast of the DR',
    'intro.stat2': 'Playa Dominicus', 'intro.lbl2': 'in Bayahíbe',
    'intro.stat3': 'Pool', 'intro.lbl3': 'outdoors',
    'intro.stat4': '3 types', 'intro.lbl4': 'Single · Double · Apart-Hotel',
    /* Amenities */
    'am.eyebrow': 'Amenities',
    'am.title': 'Made for your rest.',
    'am.wifi': 'Wi-Fi',
    'am.piscina': 'Pool',
    'am.restaurante': 'Restaurant',
    'am.aire': 'Air conditioning',
    'am.tv': 'Smart TV',
    'am.agua': 'Hot water',
    /* Rooms */
    'rooms.eyebrow': 'Rooms',
    'rooms.title': 'Choose your room.',
    'rooms.lede': 'Thoughtfully kept spaces for a peaceful stay, with all the essentials.',
    'rooms.loading': 'Loading rooms…',
    /* Pool & restaurant */
    'feat.srTitle': 'Pool and restaurant',
    'feat.p.alt': 'Large pool at Hotel Las Cañas surrounded by palm trees',
    'feat.p.eyebrow': 'Outdoors',
    'feat.p.title': 'Pool',
    'feat.p.text': 'A quiet spot to cool off and leave the journey behind under the Caribbean sun.',
    'feat.r.alt': 'Table set at the restaurant (sample image)',
    'feat.r.eyebrow': 'To start the day',
    'feat.r.title': 'Restaurant',
    'feat.r.text': 'Enjoy an unhurried breakfast or a relaxed meal during your stay.',
    /* Gallery (alt) */
    'gal.eyebrow': 'Gallery',
    'gal.title': 'A glimpse of the hotel.',
    'gal.recepcion': 'Hotel reception and lobby',
    'gal.piscinaMain': 'Main hotel pool surrounded by palm trees',
    'gal.jacuzzi': 'Hotel pool with jacuzzi',
    'gal.restaurante': 'Hotel restaurant and terrace',
    'gal.aparta': 'Apart-Hotel living room',
    'gal.sencilla': 'Single room',
    'gal.doble': 'Double room',
    'gal.fachada': 'Hotel façade and exterior',
    'gal.bano': 'Room bathroom',
    /* Location */
    'place.eyebrow': 'Where we are',
    'place.title': 'La Romana.',
    'place.lede': 'On the southeast coast of the Dominican Republic, near Playa Dominicus. Perfect for a few restful days with the sea close by.',
    'place.map': 'View on the map',
    /* Nearby */
    'nearby.eyebrow': 'Near the hotel',
    'nearby.title': 'What to see in La Romana and around',
    'nearby.c1': 'A Mediterranean stone village with art workshops, an amphitheater and views over the Chavón River.',
    'nearby.c2': 'Taíno cave art and stalactite formations, right along the road toward San Pedro.',
    'nearby.c3': 'White-sand beaches and coral reefs for diving and snorkeling, just off the coast.',
    'nearby.c4': 'A fishing village and the departure point by catamaran to the idyllic Saona Island.',
    'nearby.c5': 'A luxury marina with restaurants, boutiques and yachts, minutes from the hotel.',
    'nearby.c6': 'White sand and turquoise water in Bayahíbe, one of the southeast’s finest beaches for a day in the sun.',
    'nearby.map': 'View on the map →',
    'nearby.note': 'Distances and times are approximate; it is best to confirm them before setting out.',
    'nearby.img1': 'Altos de Chavón, a Mediterranean stone village above the Chavón River',
    'nearby.img2': 'Cueva de las Maravillas with Taíno cave art and stalactites',
    'nearby.img3': 'Isla Catalina, white-sand beach and coral reefs',
    'nearby.img4': 'Bayahíbe and Saona Island, idyllic Caribbean beaches',
    'nearby.img5': 'Marina Casa de Campo with yachts and luxury restaurants',
    'nearby.img6': 'Playa Dominicus, white sand and turquoise water in Bayahíbe',
    /* Guest reviews */
    'rev.eyebrow': 'Reviews',
    'rev.title': 'Guest reviews',
    'rev.lede': 'What guests who have already stayed with us have to say.',
    'rev.loading': 'Loading reviews…',
    'rev.empty': 'No reviews yet. Be the first to share your experience!',
    'rev.error': 'The reviews could not be loaded.',
    'rev.needLogin': 'Sign in to leave your review.',
    'rev.loginBtn': 'Sign in',
    'rev.formHint': 'Tell us how your stay was.',
    'rev.yourRating': 'Your rating',
    'rev.comment': 'Your comment',
    'rev.commentPh': 'What you liked about your stay…',
    'rev.send': 'Submit review',
    'rev.thanks': 'Thanks for your review!',
    'rev.sendFail': 'Your review could not be submitted.',
    'rev.pickRating': 'Choose a rating.',
    'rev.needComment': 'Write a comment.',
    'rev.session': 'Your session expired. Sign in again to leave your review.',
    'rev.ratingLabel': 'Rating: {n} of 5',
    'rev.stars1': '1 star',
    'rev.stars2': '2 stars',
    'rev.stars3': '3 stars',
    'rev.stars4': '4 stars',
    'rev.stars5': '5 stars',
    /* Footer */
    'foot.motto': 'We feel like family.',
    'foot.socialAria': 'Social media',
    'foot.contacto': 'Contact',
    'foot.ubicacion': 'Location',
    'foot.copy': 'Hotel Las Cañas',
    'foot.copy2': 'La Romana, Dominican Republic',
    'foot.legalAria': 'Legal documents',
    'foot.priv': 'Privacy',
    'foot.cookies': 'Cookies',
    'foot.terms': 'Terms',
    /* Modals: common */
    'modal.close': 'Close',
    /* Common fields */
    'field.email': 'Email',
    'field.pass': 'Password',
    'field.nombre': 'Full name',
    'field.tel': 'Phone',
    'field.cedula': 'ID (cédula)',
    'field.direccion': 'Address',
    'field.comentario': 'Comment',
    'field.opcional': '(optional)',
    /* Placeholders */
    'ph.email': 'you@email.com',
    'ph.pass': 'Your password',
    'ph.pass6': 'At least 6 characters',
    'ph.nombre': 'Your name',
    'ph.tel': '809-000-0000',
    'ph.cedula': '000-0000000-0',
    'ph.direccion': 'Your address',
    'ph.comentario': 'Arrival time, preferences…',
    'ph.ccName': 'Name on the card',
    'ph.ccExp': 'MM/YY',
    'ph.numEj': 'e.g. 92552',
    /* Auth modal */
    'auth.title': 'Sign in',
    'auth.sub': 'Sign in with your account to continue. First time? Create your account when you book.',
    'auth.submit': 'Sign in',
    'auth.olvidaste': 'Forgot your password?',
    'recuperar.enviado': 'If the email is registered, we sent you a link to reset your password.',
    'reset.title': 'New password',
    'reset.sub': 'Enter your new password.',
    'reset.nueva': 'New password',
    'reset.confirmar': 'Repeat password',
    'reset.submit': 'Save password',
    'reset.noCoincide': 'Passwords do not match.',
    'reset.ok': 'Password updated. You can sign in now.',
    'reset.fail': 'Could not reset. The link may have expired.',
    /* Booking modal */
    'resv.title': 'Book now',
    'resv.stepsAria': 'Booking steps',
    'resv.step1': 'Account',
    'resv.step2': 'Room',
    'resv.step3': 'Payment',
    'resv.regHint': 'Create your account to continue with the booking.',
    'resv.promos': 'I want to receive offers and promotions by email',
    'resv.btnReg': 'Create account and continue',
    'resv.yaCuenta': 'Already have an account?',
    'resv.iniciaSesion': 'Sign in',
    'resv.loginHint': 'Sign in to continue with the booking.',
    'resv.btnLoginP1': 'Sign in and continue',
    'resv.primeraVez': 'First time?',
    'resv.creaCuenta': 'Create your account',
    'resv.aNombre': 'In the name of',
    'resv.elegirTipo': 'Choose the room type',
    'resv.total': 'Total',
    'resv.continuarPago': 'Continue to payment',
    'resv.completarReserva': 'Complete booking',
    'resv.reservarOficina': 'Book (pay at the office)',
    'pago.comoPagar': 'How would you like to pay?',
    'pago.enLinea': 'Pay online',
    'pago.enLineaDesc': 'By card now. The booking is confirmed once payment completes.',
    'pago.enOficina': 'Pay at the office',
    'pago.enOficinaDesc': 'Book now and pay when you arrive at the hotel.',
    'resv.pickType': 'Choose a room type to continue.',
    'resv.saveFail': 'We could not register the booking.',
    /* Payment */
    'pay.total': 'Total to pay',
    'pay.note': 'Test-mode payment — no real charge is made.',
    'pay.titular': 'Cardholder',
    'pay.numero': 'Card number',
    'pay.venc': 'Expiry',
    'pay.cvv': 'CVV',
    'pay.submit': 'Pay and confirm',
    'pay.volver': 'Back',
    'pay.accept': 'We accept: {lista}.',
    'pay.titularReq': 'Enter the cardholder.',
    'pay.cardInvalid': 'Invalid card number.',
    'pay.notAccepted': 'We do not accept {marca}. Accepted cards: {lista}.',
    'pay.useExp': 'Use MM/YY.',
    'pay.expired': 'Card expired.',
    'pay.cvvInvalid': 'Invalid CVV.',
    'pay.payFail': 'We could not complete the payment.',
    /* Success */
    'ok.leadPaid': 'Booking confirmed and paid!',
    'ok.lead': 'Booking confirmed!',
    'ok.num': 'Booking No.',
    'ok.keep': 'Keep your number in case you need to cancel.',
    'ok.done': 'Done',
    'ok.room': 'Room {codigo}',
    'ok.paidWith': 'Paid with <strong>{marca} ****{u4}</strong>{sim}.',
    'ok.testMode': ' (test mode)',
    /* Cancellation */
    'cancel.title': 'Cancel booking',
    'cancel.sub': 'Enter your booking number and the phone you booked with.',
    'cancel.numero': 'Booking number',
    'cancel.submit': 'Cancel my booking',
    'cancel.numReq': 'Enter your booking number.',
    'cancel.done': 'Booking #{numero} cancelled.',
    'cancel.fail': 'We could not cancel the booking.',
    /* My bookings */
    'mis.title': 'My bookings',
    'mis.sub': 'Review, cancel or change the dates of your bookings.',
    'mis.loading': 'Loading your bookings…',
    'mis.connError': 'Connection error while loading your bookings.',
    'mis.loadFail': 'We could not load your bookings.',
    'mis.empty': 'You have no bookings yet.',
    'mis.arrival': 'Check-in {fecha}',
    'mis.modificar': 'Change dates',
    'mis.cancelar': 'Cancel',
    'mis.nuevaLlegada': 'New check-in',
    'mis.nuevaSalida': 'New check-out',
    'mis.guardar': 'Save dates',
    'mis.descartar': 'Discard',
    'mis.pickBoth': 'Pick both dates.',
    'mis.pastArrival': 'Check-in cannot be in the past.',
    'mis.afterArrival': 'Check-out must be after check-in.',
    'mis.changeFail': 'We could not change the dates.',
    'badge.activa': 'Active',
    'badge.hospedada': 'Checked in',
    'badge.cancelada': 'Cancelled',
    /* Lightbox / back to top */
    'lb.aria': 'Enlarged image',
    'toTop.aria': 'Back to top',
    /* Account (header) */
    'account.hi': 'Hi, {nombre}',
    'account.mis': 'My bookings',
    'account.salir': 'Sign out',
    'account.ingresar': 'Sign in',
    'account.cambiar': 'Change password',
    'cpass.title': 'Change password',
    'cpass.sub': 'Update your password. We will email you a confirmation.',
    'cpass.actual': 'Current password',
    'cpass.nueva': 'New password',
    'cpass.confirmar': 'Repeat the new password',
    'cpass.submit': 'Save password',
    'cpass.ok': 'Password updated. We sent you a confirmation email.',
    /* Catalog */
    'catalogo.error': 'The catalog could not be loaded.',
    'card.sample': '(sample image)',
    'card.perNight': '/ night',
    /* Availability */
    'disp.checking': 'Checking availability…',
    'disp.none': 'No rooms available for those dates. Try different ones.',
    'disp.one': '1 room available for those dates.',
    'disp.many': '{n} rooms available for those dates.',
    /* Validation / session / network */
    'err.email': 'Invalid email.',
    'err.min6': 'At least 6 characters.',
    'err.nombre': 'Enter your name.',
    'err.tel': 'Invalid phone number.',
    'booking.pickDates': 'Choose the check-in and check-out dates.',
    'booking.pastArrival': 'Check-in cannot be a past date.',
    'booking.afterArrival': 'Check-out must be after check-in.',
    'login.fail': 'Could not sign in.',
    'login.wrong': 'Incorrect email or password.',
    'reg.fail': 'Could not create the account.',
    'net.error': 'Connection error. Please try again.',
    'net.serverError': 'Connection error with the server.',
    'session.expired': 'Your session expired. Sign in again to continue.',
    'holder.tel': 'Tel. {tel}',
    /* Plurals */
    'night_one': 'night',
    'night_other': 'nights',
  },
};

// Devuelve el texto traducido; sustituye {params} si se pasan.
function t(clave, params) {
  const tabla = I18N[idiomaActual] || I18N.es;
  let s = (tabla[clave] != null) ? tabla[clave] : (I18N.es[clave] != null ? I18N.es[clave] : clave);
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
  return s;
}
// "N noche(s)" / "N night(s)".
function nochesTxt(n) { return `${n} ${t(n === 1 ? 'night_one' : 'night_other')}`; }

function resolverIdioma() {
  try { const s = localStorage.getItem(IDIOMA_KEY); if (IDIOMAS.includes(s)) return s; } catch { /* sin acceso */ }
  return 'es';
}
function guardarIdioma(l) { try { localStorage.setItem(IDIOMA_KEY, l); } catch { /* sin persistencia */ } }

// Aplica el idioma en vivo: recorre los data-i18n* y re-renderiza lo dinámico.
function aplicarIdioma(lang) {
  if (!IDIOMAS.includes(lang)) lang = 'es';
  idiomaActual = lang;
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.dataset.i18nPh)); });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.setAttribute('alt', t(el.dataset.i18nAlt)); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });

  // Estado del selector
  document.querySelectorAll('#lang .lang__opt').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));

  // Re-render de textos generados por JS (con guardas por si aún no hay datos)
  renderCuenta();
  if (config) pintarPayMethods();
  renderCatalogo();
  if (tarifas.length) construirTipos();
  const irPagoBtn = $('irPago');
  if (irPagoBtn) irPagoBtn.textContent = esPagoActivo() ? t('resv.continuarPago') : t('resv.completarReserva');
  resumenFechas();
  actualizarReservaResumen();
  if (modalReserva && !modalReserva.hidden && !$('paso2').hidden) actualizarTotal();
  dispoLive();
  if (modalMisReservas && !modalMisReservas.hidden) cargarMisReservas();
  if ($('reservaOk') && !$('reservaOk').hidden && estadoExito) renderExito(estadoExito);
  if (typeof renderResenas === 'function') renderResenas();
}

// Cableado del selector ES / EN (CSP-safe, sin on* inline).
document.querySelectorAll('#lang .lang__opt').forEach((b) => {
  b.addEventListener('click', () => {
    const l = b.dataset.lang;
    if (l === idiomaActual) return;
    aplicarIdioma(l);
    guardarIdioma(l);
  });
});

/* ------------------- Animación de aparición (scroll) ------------------- */
const io = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 })
  : null;
if (io) document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
else document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));

/* ============================ Gestor de modales ============================
   Solo hay un modal activo a la vez. Guarda el foco previo para devolverlo al
   cerrar, atrapa el Tab dentro del diálogo, cierra con Escape y con clic en el
   backdrop, y marca el resto de la página como inerte.
   ========================================================================= */
let modalActivo = null;
let disparador = null;

const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function fondoInerte(activar) {
  ['top', 'contenido'].forEach((id) => { const el = $(id); if (el) el.inert = activar; });
  const pie = document.querySelector('.foot');
  if (pie) pie.inert = activar;
}

function abrirModal(modal, { foco } = {}) {
  if (typeof cerrarTemaMenu === 'function') cerrarTemaMenu();
  if (modalActivo && modalActivo !== modal) cerrarModal({ devolverFoco: false });
  disparador = document.activeElement;
  modal.hidden = false;
  modalActivo = modal;
  document.body.style.overflow = 'hidden';
  fondoInerte(true);
  const caja = modal.querySelector('.modal__box');
  const objetivo = foco
    || caja.querySelector('input:not([type=hidden]):not([disabled]), select, textarea')
    || caja.querySelector(FOCUSABLES);
  if (objetivo) objetivo.focus();
}

function cerrarModal({ devolverFoco = true } = {}) {
  if (!modalActivo) return;
  modalActivo.hidden = true;
  modalActivo = null;
  document.body.style.overflow = '';
  fondoInerte(false);
  if (devolverFoco && disparador && typeof disparador.focus === 'function') disparador.focus();
  disparador = null;
}

// Focus trap + Escape (global, solo si hay modal abierto).
document.addEventListener('keydown', (e) => {
  if (!modalActivo) return;
  if (e.key === 'Escape') { e.preventDefault(); cerrarModal(); return; }
  if (e.key !== 'Tab') return;
  const caja = modalActivo.querySelector('.modal__box');
  const items = Array.from(caja.querySelectorAll(FOCUSABLES)).filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const primero = items[0];
  const ultimo = items[items.length - 1];
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
});

// Cerrar con backdrop o botones [data-close].
document.querySelectorAll('.modal').forEach((modal) => {
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => cerrarModal()));
});

/* ======================= Estado de la cuenta (header) ======================= */
function plantillaCuenta() {
  if (usuario) {
    const hola = t('account.hi', { nombre: `<strong>${escapar(primerNombre(usuario.nombre || 'cliente'))}</strong>` });
    return `
      <span class="account__hi">${hola}</span>
      <button type="button" class="btn btn--ghost btn--sm" data-misreservas>${escapar(t('account.mis'))}</button>
      <button type="button" class="btn btn--ghost btn--sm" data-cambiarpass>${escapar(t('account.cambiar'))}</button>
      <button type="button" class="btn btn--ghost btn--sm" data-logout>${escapar(t('account.salir'))}</button>`;
  }
  // Clientes que regresan: solo "Ingresar" (el registro ocurre al reservar).
  return `<button type="button" class="btn btn--solid btn--sm" data-auth="login">${escapar(t('account.ingresar'))}</button>`;
}

function renderCuenta() {
  const html = plantillaCuenta();
  ['account', 'accountMobile'].forEach((id) => {
    const cont = $(id);
    if (!cont) return;
    cont.innerHTML = html;
    cont.querySelectorAll('[data-auth]').forEach((b) =>
      b.addEventListener('click', () => { cerrarMenuMovil(); abrirAuth(); }));
    cont.querySelectorAll('[data-logout]').forEach((b) =>
      b.addEventListener('click', () => { cerrarMenuMovil(); salir(); }));
    cont.querySelectorAll('[data-misreservas]').forEach((b) =>
      b.addEventListener('click', () => { cerrarMenuMovil(); abrirMisReservas(); }));
    cont.querySelectorAll('[data-cambiarpass]').forEach((b) =>
      b.addEventListener('click', () => { cerrarMenuMovil(); abrirCambiarPass(); }));
  });
  // "Cancelar reserva" solo tiene sentido con sesión iniciada: ocultarlo sin ella.
  ['openCancel', 'openCancelMobile'].forEach((id) => {
    const b = $(id);
    if (b) b.hidden = !usuario;
  });
  // El formulario de reseñas depende de la sesión: refréscalo con la cuenta.
  if (typeof renderResenasForm === 'function') renderResenasForm();
}

function primerNombre(n) { return String(n).trim().split(/\s+/)[0]; }
function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function cargarSesion() {
  try {
    const { data } = await pedir('/api/yo');
    usuario = (data && data.ok) ? data.usuario : null;
  } catch { usuario = null; }
  renderCuenta();
}

async function salir() {
  try { await pedir('/api/logout', { method: 'POST' }); } catch { /* ignora */ }
  usuario = null;
  renderCuenta();
}

/* ======================= Modal de inicio de sesión ======================= */
const modalAuth = $('modalAuth');
const panelLogin = $('panelLogin');

function abrirAuth() {
  $('loginMsg').textContent = ''; $('loginMsg').className = 'modal__msg';
  abrirModal(modalAuth, { foco: $('loginEmail') });
}

// Tras autenticarse con éxito: refrescar cuenta, cerrar y reanudar lo pendiente.
function trasAutenticar() {
  renderCuenta();
  cerrarModal({ devolverFoco: false });
  const seguir = accionPendiente;
  accionPendiente = null;
  if (typeof seguir === 'function') seguir();
}

panelLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('loginEmail'); const pass = $('loginPass');
  const msg = $('loginMsg'); msg.textContent = ''; msg.className = 'modal__msg';
  let ok = true;
  if (!EMAIL_RE.test(email.value.trim())) ok = marcarError(email, $('loginEmailErr'), t('err.email'));
  else limpiarError(email, $('loginEmailErr'));
  if (pass.value.length < 6) ok = marcarError(pass, $('loginPassErr'), t('err.min6'));
  else limpiarError(pass, $('loginPassErr'));
  if (!ok) return;

  const btn = $('btnLogin');
  cargando(btn, true);
  try {
    const { data } = await pedir('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.value.trim(), password: pass.value }),
    });
    if (data.ok) { usuario = data.usuario; pass.value = ''; trasAutenticar(); }
    else { msg.textContent = data.error || t('login.fail'); msg.className = 'modal__msg err'; }
  } catch {
    msg.textContent = t('net.error'); msg.className = 'modal__msg err';
  } finally { cargando(btn, false); }
});

// --- Recuperar contraseña: envía un enlace al correo ---
if ($('irRecuperar')) $('irRecuperar').addEventListener('click', async () => {
  const email = $('loginEmail'); const msg = $('loginMsg');
  const v = email.value.trim();
  if (!EMAIL_RE.test(v)) { marcarError(email, $('loginEmailErr'), t('err.email')); email.focus(); return; }
  const btn = $('irRecuperar'); cargando(btn, true);
  try {
    const { data } = await pedir('/api/recuperar', { method: 'POST', body: JSON.stringify({ email: v }) });
    msg.textContent = (data && data.mensaje) || t('recuperar.enviado'); msg.className = 'modal__msg ok';
  } catch { msg.textContent = t('net.error'); msg.className = 'modal__msg err'; }
  finally { cargando(btn, false); }
});

// --- Cambiar contraseña (con sesión iniciada) ---
let modalCpass = null;
function abrirCambiarPass() {
  if (!usuario) { abrirAuth(); return; }
  if (!modalCpass) {
    const wrap = document.createElement('div');
    wrap.className = 'modal'; wrap.id = 'modalCpass'; wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop" data-close></div>' +
      '<div class="modal__box" role="dialog" aria-modal="true" aria-labelledby="cpassTitle">' +
        '<h2 class="modal__title" id="cpassTitle">' + escapar(t('cpass.title')) + '</h2>' +
        '<p class="modal__sub">' + escapar(t('cpass.sub')) + '</p>' +
        '<form class="mform" id="formCpass" novalidate>' +
          '<div class="field"><label for="cpassActual">' + escapar(t('cpass.actual')) + '</label>' +
            '<input type="password" id="cpassActual" autocomplete="current-password" required></div>' +
          '<div class="field"><label for="cpassNueva">' + escapar(t('cpass.nueva')) + '</label>' +
            '<input type="password" id="cpassNueva" autocomplete="new-password" required minlength="6"></div>' +
          '<div class="field"><label for="cpassNueva2">' + escapar(t('cpass.confirmar')) + '</label>' +
            '<input type="password" id="cpassNueva2" autocomplete="new-password" required minlength="6"></div>' +
          '<button class="btn btn--solid modal__submit" type="submit" id="btnCpass">' + escapar(t('cpass.submit')) + '</button>' +
          '<p class="modal__msg" id="cpassMsg" role="alert"></p>' +
        '</form>' +
      '</div>';
    document.body.appendChild(wrap);
    modalCpass = wrap;
    wrap.querySelector('[data-close]').addEventListener('click', () => cerrarModal({ devolverFoco: false }));
    $('formCpass').addEventListener('submit', async (e) => {
      e.preventDefault();
      const a = $('cpassActual'), n1 = $('cpassNueva'), n2 = $('cpassNueva2'), msg = $('cpassMsg');
      msg.textContent = ''; msg.className = 'modal__msg';
      if (n1.value.length < 6) { msg.textContent = t('err.min6'); msg.className = 'modal__msg err'; return; }
      if (n1.value !== n2.value) { msg.textContent = t('reset.noCoincide'); msg.className = 'modal__msg err'; return; }
      const btn = $('btnCpass'); cargando(btn, true);
      try {
        const { status, data } = await pedir('/api/cambiar-password', { method: 'POST', body: JSON.stringify({ actual: a.value, nueva: n1.value }) });
        if (status === 401) { cerrarModal({ devolverFoco: false }); usuario = null; renderCuenta(); abrirAuth(); return; }
        if (data && data.ok) {
          msg.textContent = data.mensaje || t('cpass.ok'); msg.className = 'modal__msg ok';
          a.value = n1.value = n2.value = '';
          setTimeout(() => cerrarModal({ devolverFoco: false }), 1800);
        } else { msg.textContent = (data && data.error) || t('net.error'); msg.className = 'modal__msg err'; }
      } catch { msg.textContent = t('net.error'); msg.className = 'modal__msg err'; }
      finally { cargando(btn, false); }
    });
  } else {
    ['cpassActual', 'cpassNueva', 'cpassNueva2'].forEach((id) => { const el = $(id); if (el) el.value = ''; });
    const m = $('cpassMsg'); if (m) { m.textContent = ''; m.className = 'modal__msg'; }
  }
  abrirModal(modalCpass, { foco: $('cpassActual') });
}

// --- Restablecer contraseña: se abre si la URL trae ?reset=TOKEN ---
(function () {
  let token = null;
  try { token = new URLSearchParams(location.search).get('reset'); } catch (e) { /* sin query */ }
  if (!token) return;
  const wrap = document.createElement('div');
  wrap.className = 'modal'; wrap.id = 'modalReset'; wrap.hidden = true;
  wrap.innerHTML =
    '<div class="modal__backdrop" data-close></div>' +
    '<div class="modal__box" role="dialog" aria-modal="true" aria-labelledby="resetTitle">' +
      '<h2 class="modal__title" id="resetTitle">' + escapar(t('reset.title')) + '</h2>' +
      '<p class="modal__sub">' + escapar(t('reset.sub')) + '</p>' +
      '<form class="mform" id="formReset" novalidate>' +
        '<div class="field"><label for="resetPass">' + escapar(t('reset.nueva')) + '</label>' +
          '<input type="password" id="resetPass" autocomplete="new-password" required minlength="6"></div>' +
        '<div class="field"><label for="resetPass2">' + escapar(t('reset.confirmar')) + '</label>' +
          '<input type="password" id="resetPass2" autocomplete="new-password" required minlength="6"></div>' +
        '<button class="btn btn--solid modal__submit" type="submit" id="btnReset">' + escapar(t('reset.submit')) + '</button>' +
        '<p class="modal__msg" id="resetMsg" role="alert"></p>' +
      '</form>' +
    '</div>';
  const arranque = () => {
    document.body.appendChild(wrap);
    abrirModal(wrap, { foco: $('resetPass') });
    wrap.querySelector('[data-close]').addEventListener('click', () => cerrarModal({ devolverFoco: false }));
    $('formReset').addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = $('resetPass'), p2 = $('resetPass2'), msg = $('resetMsg');
      msg.textContent = ''; msg.className = 'modal__msg';
      if (p1.value.length < 6) { msg.textContent = t('err.min6'); msg.className = 'modal__msg err'; return; }
      if (p1.value !== p2.value) { msg.textContent = t('reset.noCoincide'); msg.className = 'modal__msg err'; return; }
      const btn = $('btnReset'); cargando(btn, true);
      try {
        const { data } = await pedir('/api/restablecer', { method: 'POST', body: JSON.stringify({ token, password: p1.value }) });
        if (data.ok) {
          msg.textContent = data.mensaje || t('reset.ok'); msg.className = 'modal__msg ok';
          setTimeout(() => {
            cerrarModal({ devolverFoco: false });
            try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
            abrirAuth();
          }, 1600);
        } else { msg.textContent = data.error || t('reset.fail'); msg.className = 'modal__msg err'; }
      } catch { msg.textContent = t('net.error'); msg.className = 'modal__msg err'; }
      finally { cargando(btn, false); }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arranque);
  else arranque();
})();

// Autolimpieza de errores al escribir.
[['loginEmail', 'loginEmailErr'], ['loginPass', 'loginPassErr'],
 ['rvNombre', 'rvNombreErr'], ['rvTel', 'rvTelErr'], ['rvEmail', 'rvEmailErr'], ['rvPass', 'rvPassErr'],
 ['lpEmail', 'lpEmailErr'], ['lpPass', 'lpPassErr'],
 ['cNumero', 'cNumeroErr'], ['cTelefono', 'cTelefonoErr']]
  .forEach(([i, e]) => { const inp = $(i), err = $(e); if (inp) autolimpiar(inp, err); });

/* ============================ Fechas del buscador ============================ */
const llegada = $('llegada');
const salida = $('salida');
const hoy = new Date();
const maniana = new Date(Date.now() + DIA_MS);
llegada.value = iso(hoy); llegada.min = iso(hoy);
salida.value = iso(maniana); salida.min = iso(maniana);

// Mantiene salida > llegada (ajustándola sola si hace falta).
function ajustarSalida() {
  if (!llegada.value) return;
  const minSalida = new Date(new Date(llegada.value).getTime() + DIA_MS);
  salida.min = iso(minSalida);
  if (!salida.value || new Date(salida.value) <= new Date(llegada.value)) salida.value = iso(minSalida);
}

// Devuelve el número de noches entre las fechas elegidas (mínimo 1).
function nochesSeleccionadas() {
  return Math.max(1, Math.round((new Date(salida.value) - new Date(llegada.value)) / DIA_MS));
}

// Muestra de forma visible la selección de fechas: "19 oct 2026 → 20 oct 2026 · 1 noche".
function resumenFechas() {
  const cont = $('fechasResumen');
  const hoyStr = iso(new Date());
  const valido = llegada.value && salida.value
    && llegada.value >= hoyStr && new Date(salida.value) > new Date(llegada.value);
  if (!valido) { cont.hidden = true; return; }
  const n = nochesSeleccionadas();
  $('fechasResumenText').textContent =
    `${formatoFecha(llegada.value)} → ${formatoFecha(salida.value)} · ${nochesTxt(n)}`;
  cont.hidden = false;
}

// Pequeño "debounce" para no consultar en cada tecla.
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Consulta la disponibilidad en vivo y muestra cuántas habitaciones hay.
// Requiere sesión (la API devuelve 401 sin cuenta): sin sesión no se consulta.
const dispoLive = debounce(async () => {
  const hint = $('bookingHint');
  if (!usuario) { hint.textContent = ''; hint.className = 'booking__hint'; return; }
  const hoyStr = iso(new Date());
  if (!llegada.value || !salida.value
      || llegada.value < hoyStr || new Date(salida.value) <= new Date(llegada.value)) {
    return; // fechas inválidas: validarFechas() ya avisa al enviar
  }
  hint.textContent = t('disp.checking'); hint.className = 'booking__hint loading';
  try {
    const { ok, data } = await pedir(
      `/api/disponibilidad?llegada=${encodeURIComponent(llegada.value)}&salida=${encodeURIComponent(salida.value)}`);
    if (!ok || !data.ok) throw new Error();
    if (data.total === 0) {
      hint.textContent = t('disp.none');
      hint.className = 'booking__hint err';
    } else {
      hint.textContent = data.total === 1 ? t('disp.one') : t('disp.many', { n: data.total });
      hint.className = 'booking__hint ok';
    }
  } catch {
    hint.textContent = ''; hint.className = 'booking__hint';
  }
}, 350);

// Reacciona a cualquier cambio de fechas: ajusta, muestra la selección y recarga disponibilidad.
function alCambiarFechas() {
  ajustarSalida();
  resumenFechas();
  dispoLive();
}
llegada.addEventListener('change', alCambiarFechas);
salida.addEventListener('change', alCambiarFechas);

// Valida las fechas del buscador y escribe la pista bajo el formulario.
function validarFechas() {
  const hint = $('bookingHint');
  hint.textContent = ''; hint.className = 'booking__hint';
  const hoyStr = iso(new Date());
  if (!llegada.value || !salida.value) {
    hint.textContent = t('booking.pickDates'); hint.className = 'booking__hint err'; return false;
  }
  if (llegada.value < hoyStr) {
    hint.textContent = t('booking.pastArrival'); hint.className = 'booking__hint err'; return false;
  }
  if (new Date(salida.value) <= new Date(llegada.value)) {
    hint.textContent = t('booking.afterArrival'); hint.className = 'booking__hint err'; return false;
  }
  return true;
}

/* ===================== Flujo de reserva en 3 pasos =====================
   Paso 1: cuenta (crear cuenta o iniciar sesión).
   Paso 2: tipo de habitación + total (precio por noche × noches).
   Paso 3: pago (simulado) -> POST /api/reservas con tipo + pago.
   Cotización y reserva exigen sesión: ante un 401 se vuelve al Paso 1.
   ====================================================================== */
const modalReserva = $('modalReserva');

/* --- Configuración del sitio (pago, tarifas, contacto, tema) --- */
let config = null;
let tarifas = [];
let moneda = 'RD$';
let tipoSeleccionado = null;

const ETIQUETA_MARCA = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex' };

function fmtMoneda(n) { return `${moneda}${Number(n).toLocaleString('es-DO')}`; }
function esPagoActivo() { return config ? config.pagoActivo !== false : true; }
function metodosPago() { return (config && Array.isArray(config.metodosPago)) ? config.metodosPago : ['visa', 'mastercard', 'amex']; }

// Carga /api/config y aplica pago, tarifas, contacto y tema por defecto.
async function cargarConfig() {
  try {
    const { data } = await pedir('/api/config');
    if (data && data.ok) config = data.config;
  } catch { config = null; }

  if (config && Array.isArray(config.tarifas)) tarifas = config.tarifas;
  // Respaldo: si /api/config falló, intenta /api/tarifas.
  if (!tarifas.length) {
    try {
      const { data } = await pedir('/api/tarifas');
      if (data && data.ok) { tarifas = data.tarifas || []; moneda = data.moneda || 'RD$'; }
    } catch { /* sin tarifas */ }
  }

  if (config && config.contacto) aplicarContacto(config.contacto);
  aplicarTemaDefecto();
  // Indicador de pasos: sin pago activo, el sitio queda en 2 pasos.
  $('stepDot3').hidden = !esPagoActivo();
  construirTipos();
  pintarPayMethods();
}

// Tema por defecto desde /api/config: solo si el usuario no eligió uno (local)
// ni lo inyectó el servidor por puerto (<html data-tema-defecto>).
function aplicarTemaDefecto() {
  let local = null;
  try { local = localStorage.getItem('tema'); } catch { /* sin acceso */ }
  const hayLocal = TEMAS.includes(local);
  const haySrv = !!temaDefectoServidor();
  if (!hayLocal && !haySrv && config && TEMAS.includes(config.temaDefecto)) aplicarTema(config.temaDefecto);
}

// Refleja el contacto editable (teléfono, WhatsApp, dirección, correo, redes).
function aplicarContacto(c) {
  if (!c) return;
  const digits = (c.telefono || '').replace(/\D/g, '');
  document.querySelectorAll('[data-c="wa"]').forEach((a) => { if (c.whatsapp) a.href = `https://wa.me/${c.whatsapp}`; });
  document.querySelectorAll('[data-c="tel"]').forEach((a) => { if (digits) a.href = `tel:${digits}`; });
  document.querySelectorAll('[data-c="mail"]').forEach((a) => { if (c.email) a.href = `mailto:${c.email}`; });
  document.querySelectorAll('[data-c="ig"]').forEach((a) => { if (c.instagram) a.href = c.instagram; });
  document.querySelectorAll('[data-c="fb"]').forEach((a) => { if (c.facebook) a.href = c.facebook; });
  document.querySelectorAll('[data-c-text="tel"]').forEach((e) => { if (c.telefono) e.textContent = c.telefono; });
  document.querySelectorAll('[data-c-text="mail"]').forEach((e) => { if (c.email) e.textContent = c.email; });
  document.querySelectorAll('[data-c-text="addr"]').forEach((e) => { if (c.direccion) e.textContent = c.direccion; });
}

// Métodos de pago aceptados mostrados en el Paso 3.
function pintarPayMethods() {
  const nombres = metodosPago().map((m) => ETIQUETA_MARCA[m]).filter(Boolean);
  $('payMethods').textContent = nombres.length ? t('pay.accept', { lista: nombres.join(', ') }) : '';
}

/* --- Catálogo público de habitaciones (/api/catalogo) --- */
// Esqueletos "shimmer" mientras llega el catálogo (evita saltos bruscos).
function pintarSkeletonCatalogo(n = 3) {
  const cont = $('habitaciones');
  if (!cont) return;
  let html = '';
  for (let i = 0; i < n; i++) {
    html +=
      '<div class="card skeleton-card" aria-hidden="true">' +
        '<div class="skel skeleton-card__photo"></div>' +
        '<div class="skeleton-card__body">' +
          '<div class="skel skeleton-card__chip"></div>' +
          '<div class="skel skeleton-card__title"></div>' +
          '<div class="skel skeleton-card__line"></div>' +
          '<div class="skel skeleton-card__line skeleton-card__line--short"></div>' +
          '<div class="skel skeleton-card__price"></div>' +
        '</div>' +
      '</div>';
  }
  cont.innerHTML = html;
}

// Último catálogo recibido (para re-pintar al cambiar de idioma sin re-consultar).
// undefined = aún sin cargar; null = error; array = habitaciones.
let catalogoData;

async function cargarCatalogo() {
  const cont = $('habitaciones');
  if (!cont) return;
  pintarSkeletonCatalogo(3);
  try {
    const { data } = await pedir('/api/catalogo');
    if (data && data.ok) { catalogoData = data.habitaciones || []; renderCatalogo(); return; }
    throw new Error('sin backend');
  } catch {
    // Demo estático (sin backend): usa el catálogo horneado en catalogo.json.
    try {
      const r = await fetch('catalogo.json', { cache: 'no-cache' });
      catalogoData = r.ok ? await r.json() : null;
    } catch { catalogoData = null; }
    renderCatalogo();
  }
}

// Pinta el catálogo desde la caché (o el mensaje de error / carga).
function renderCatalogo() {
  const cont = $('habitaciones');
  if (!cont) return;
  if (catalogoData === undefined) return; // aún cargando: conserva el placeholder
  if (catalogoData === null) {
    cont.innerHTML = `<p class="stay__loading" id="catalogoMsg">${escapar(t('catalogo.error'))}</p>`;
    return;
  }
  cont.innerHTML = '';
  catalogoData.forEach((h) => cont.appendChild(tarjetaCatalogo(h)));
  if (window.Tilt3D) window.Tilt3D.scan(); // enlaza el efecto 3D a las tarjetas nuevas
}

function tarjetaCatalogo(h) {
  const art = document.createElement('article');
  art.className = 'card reveal in tilt3d';
  const precio = esPagoActivo() ? precioDeTipo(h.tipo) : null;
  art.innerHTML =
    `<img class="card__photo" src="${escapar(h.foto)}" alt="${escapar(h.nombre)}" loading="lazy">` +
    `<div class="card__body">` +
      (h.tipo && h.tipo !== h.nombre ? `<span class="card__tipo">${escapar(h.tipo)}</span>` : '') +
      `<h3>${escapar(h.nombre)}</h3>` +
      `<p>${escapar(h.descripcion || '')}</p>` +
      (precio != null ? `<p class="card__price">${fmtMoneda(precio)} <span class="card__pricenote">${escapar(t('card.perNight'))}</span></p>` : '') +
    `</div>`;
  return art;
}

// Construye las opciones de tipo (radios con tarjeta) del Paso 2.
function construirTipos() {
  const cont = $('tipos');
  const previo = tipoActual(); // conserva la selección al re-construir (p. ej. cambio de idioma)
  cont.querySelectorAll('.tipo').forEach((n) => n.remove());
  tarifas.forEach((tf, i) => {
    const label = document.createElement('label');
    label.className = 'tipo';
    label.innerHTML =
      `<input type="radio" name="tipo" id="tipo-${i}" value="${escapar(tf.tipo)}"${tf.tipo === previo ? ' checked' : ''}>` +
      `<span class="tipo__name">${escapar(tf.tipo)}</span>` +
      `<span class="tipo__desc">${escapar(tf.descripcion || '')}</span>` +
      `<span class="tipo__price">${fmtMoneda(tf.precioNoche)}<small>${escapar(t('card.perNight'))}</small></span>`;
    cont.appendChild(label);
  });
  cont.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener('change', actualizarTotal));
}

function tipoActual() {
  const r = $('tipos').querySelector('input[name="tipo"]:checked');
  return r ? r.value : null;
}
function precioDeTipo(tipo) {
  const t = tarifas.find((x) => x.tipo === tipo);
  return t ? t.precioNoche : null;
}

// Recalcula y muestra el total (precio × noches) del tipo elegido.
function actualizarTotal() {
  const tipo = tipoActual();
  const total = $('totalPaso2');
  const n = nochesSeleccionadas();
  if (!tipo) { total.hidden = true; return; }
  const precio = precioDeTipo(tipo);
  $('totalPaso2Noches').textContent = `(${fmtMoneda(precio)} × ${nochesTxt(n)})`;
  $('totalPaso2Val').textContent = fmtMoneda(precio * n);
  total.hidden = false;
  $('tipoNota').textContent = ''; $('tipoNota').className = 'disp-nota';
}

// El buscador del hero abre el modal de reserva.
$('reservaForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validarFechas()) return;
  iniciarReserva();
});

// Resumen de la reserva (subtítulo del modal): fechas · noches · huéspedes.
// Usa el texto traducido de la opción de huéspedes, no su "value" (ese va al backend).
function actualizarReservaResumen() {
  const el = $('reservaResumen');
  if (!el) return;
  const noches = nochesSeleccionadas();
  const sel = $('huespedes');
  const huesp = (sel && sel.selectedIndex >= 0) ? sel.options[sel.selectedIndex].textContent.trim() : '';
  el.textContent = `${formatoFecha(llegada.value)} → ${formatoFecha(salida.value)} · ${nochesTxt(noches)} · ${huesp}`;
}

// Abre el modal: Paso 2 directo si ya hay sesión; si no, Paso 1 (cuenta).
function iniciarReserva() {
  actualizarReservaResumen();

  $('reservaOk').hidden = true;
  ['regMsg', 'lpMsg', 'reservaMsg', 'pagoMsg'].forEach((id) => { const m = $(id); m.textContent = ''; m.className = 'modal__msg'; });

  if (usuario) {
    abrirModal(modalReserva);
    mostrarPaso2();
  } else {
    verRegistro();
    abrirModal(modalReserva, { foco: $('rvNombre') });
  }
}

// --- Indicador visual de 3 pasos ---
function marcarPaso(n) {
  for (let i = 1; i <= 3; i++) {
    $('stepDot' + i).className = 'steps__item' + (i === n ? ' is-current' : (i < n ? ' is-done' : ''));
  }
}

// --- Paso 1: alternar entre crear cuenta e iniciar sesión ---
function verRegistro() {
  $('paso1').hidden = false; $('paso2').hidden = true; $('paso3').hidden = true; $('reservaOk').hidden = true;
  $('regForm').hidden = false; $('loginPaso1').hidden = true;
  marcarPaso(1);
  $('rvNombre').focus();
}
function verLogin(prefill) {
  $('paso1').hidden = false; $('paso2').hidden = true; $('paso3').hidden = true; $('reservaOk').hidden = true;
  $('regForm').hidden = true; $('loginPaso1').hidden = false;
  if (prefill) $('lpEmail').value = prefill;
  marcarPaso(1);
  ($('lpEmail').value ? $('lpPass') : $('lpEmail')).focus();
}
$('irLogin').addEventListener('click', () => verLogin($('rvEmail').value.trim()));
$('irReg').addEventListener('click', () => verRegistro());

// --- Paso 2: tipo de habitación + total (o confirmación si el pago está apagado) ---
async function mostrarPaso2() {
  $('paso1').hidden = true; $('paso3').hidden = true; $('paso2').hidden = false; $('reservaOk').hidden = true;
  const holder = $('holder');
  if (usuario) {
    $('holderName').textContent = usuario.nombre || '';
    $('holderTel').textContent = usuario.telefono ? t('holder.tel', { tel: usuario.telefono }) : '';
    holder.hidden = false;
  } else { holder.hidden = true; }
  marcarPaso(2);
  $('reservaMsg').textContent = ''; $('reservaMsg').className = 'modal__msg';

  if (config === null) await cargarConfig();
  const activo = esPagoActivo();
  $('tipos').hidden = !activo;
  if ($('formaPagoBox')) $('formaPagoBox').hidden = !activo;

  if (activo) {
    // Elegir tipo + ver total, luego continuar al pago.
    if (!$('tipos').querySelector('.tipo')) construirTipos();
    const radios = $('tipos').querySelectorAll('input[name="tipo"]');
    if (radios.length && !tipoActual()) radios[0].checked = true; // preselecciona el primero
    actualizarTotal();
    actualizarBotonPago();
    if (radios.length && modalActivo === modalReserva) radios[0].focus();
  } else {
    // Pago desactivado: sin tipos ni precios; reserva directa.
    $('totalPaso2').hidden = true;
    $('tipoNota').textContent = ''; $('tipoNota').className = 'disp-nota';
    $('irPago').textContent = t('resv.completarReserva');
    if (modalActivo === modalReserva) $('observacion').focus();
  }
}

// Forma de pago elegida (en línea / en oficina) y etiqueta del botón del paso 2.
function formaPagoActual() {
  const r = document.querySelector('input[name="formaPago"]:checked');
  return r ? r.value : 'linea';
}
function actualizarBotonPago() {
  $('irPago').textContent = formaPagoActual() === 'oficina'
    ? t('resv.reservarOficina') : t('resv.continuarPago');
}
document.querySelectorAll('input[name="formaPago"]').forEach((r) => r.addEventListener('change', actualizarBotonPago));

// --- Paso 3: pago ---
function mostrarPaso3() {
  tipoSeleccionado = tipoActual();
  const n = nochesSeleccionadas();
  $('pagoTotal').textContent = fmtMoneda(precioDeTipo(tipoSeleccionado) * n);
  $('pagoMsg').textContent = ''; $('pagoMsg').className = 'modal__msg';
  $('paso2').hidden = true; $('paso3').hidden = false; $('reservaOk').hidden = true;
  marcarPaso(3);
  $('pgTitular').focus();
}

// Si una acción protegida responde 401 (sesión perdida), vuelve al Paso 1.
function volverAPaso1Por401() {
  usuario = null;
  renderCuenta();
  verLogin('');
  const m = $('lpMsg');
  m.textContent = t('session.expired');
  m.className = 'modal__msg err';
}

function formatoFecha(s) {
  const [y, m, d] = s.split('-').map(Number);
  try { return new Date(y, m - 1, d).toLocaleDateString(LOCALE_FECHA[idiomaActual] || 'es-DO', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

/* ---- Paso 1: crear cuenta y continuar ---- */
function validarRegistro() {
  const nombre = $('rvNombre'), email = $('rvEmail'), tel = $('rvTel'), pass = $('rvPass');
  let ok = true;
  if (!nombre.value.trim()) ok = marcarError(nombre, $('rvNombreErr'), t('err.nombre'));
  else limpiarError(nombre, $('rvNombreErr'));
  if (!EMAIL_RE.test(email.value.trim())) ok = marcarError(email, $('rvEmailErr'), t('err.email'));
  else limpiarError(email, $('rvEmailErr'));
  if (!telValido(tel.value)) ok = marcarError(tel, $('rvTelErr'), t('err.tel'));
  else limpiarError(tel, $('rvTelErr'));
  if (pass.value.length < 6) ok = marcarError(pass, $('rvPassErr'), t('err.min6'));
  else limpiarError(pass, $('rvPassErr'));
  return ok;
}

$('regForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validarRegistro()) return;
  const btn = $('btnRegistro'); const msg = $('regMsg');
  msg.textContent = ''; msg.className = 'modal__msg';
  cargando(btn, true);
  try {
    const { data } = await pedir('/api/registro', {
      method: 'POST',
      body: JSON.stringify({
        nombre: $('rvNombre').value.trim(),
        telefono: $('rvTel').value.trim(),
        email: $('rvEmail').value.trim(),
        password: $('rvPass').value,
        cedula: $('rvCedula').value.trim(),
        direccion: $('rvDireccion').value.trim(),
        aceptaPromos: $('rvPromos').checked,
      }),
    });
    if (data.ok) {
      usuario = data.usuario;
      renderCuenta();
      mostrarPaso2(); // -> elegir tipo de habitación
    } else {
      msg.textContent = data.error || t('reg.fail'); msg.className = 'modal__msg err';
      if (/correo/i.test(data.error || '') && /existe|registrad/i.test(data.error || '')) {
        verLogin($('rvEmail').value.trim());
      }
    }
  } catch {
    msg.textContent = t('net.error'); msg.className = 'modal__msg err';
  } finally { cargando(btn, false); }
});

/* ---- Paso 1: iniciar sesión y continuar ---- */
$('loginPaso1').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('lpEmail'); const pass = $('lpPass');
  const msg = $('lpMsg'); msg.textContent = ''; msg.className = 'modal__msg';
  let ok = true;
  if (!EMAIL_RE.test(email.value.trim())) ok = marcarError(email, $('lpEmailErr'), t('err.email'));
  else limpiarError(email, $('lpEmailErr'));
  if (pass.value.length < 6) ok = marcarError(pass, $('lpPassErr'), t('err.min6'));
  else limpiarError(pass, $('lpPassErr'));
  if (!ok) return;

  const btn = $('btnLoginPaso1');
  cargando(btn, true);
  try {
    const { data } = await pedir('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.value.trim(), password: pass.value }),
    });
    if (data.ok) {
      usuario = data.usuario; pass.value = '';
      renderCuenta();
      mostrarPaso2(); // -> elegir tipo de habitación
    } else {
      msg.textContent = data.error || t('login.wrong'); msg.className = 'modal__msg err';
    }
  } catch {
    msg.textContent = t('net.error'); msg.className = 'modal__msg err';
  } finally { cargando(btn, false); }
});

/* ---- Paso 2: continuar (al pago, o reservar directo si el pago está apagado) ---- */
$('reservaDetalle').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!esPagoActivo()) { hacerReservaSinPago($('irPago')); return; }
  const nota = $('tipoNota');
  if (!tipoActual()) {
    nota.textContent = t('resv.pickType'); nota.className = 'disp-nota err';
    return;
  }
  // En oficina: se crea la reserva ya (pago al llegar). En línea: va al pago.
  if (formaPagoActual() === 'oficina') { hacerReservaOficina($('irPago')); return; }
  mostrarPaso3();
});
$('volverPaso2').addEventListener('click', () => mostrarPaso2());

// Reserva sin pago (pago en línea desactivado): POST sin tipo ni pago.
async function hacerReservaSinPago(btn) {
  const msg = $('reservaMsg'); msg.textContent = ''; msg.className = 'modal__msg';
  const payload = {
    llegada: llegada.value,
    salida: salida.value,
    huespedes: $('huespedes').value,
    observacion: $('observacion').value.trim(),
  };
  cargando(btn, true);
  try {
    const { ok, status, data } = await pedir('/api/reservas', { method: 'POST', body: JSON.stringify(payload) });
    if (status === 401) { volverAPaso1Por401(); return; }
    if (ok && data.ok) { mostrarExito(data); return; }
    msg.textContent = (data && data.error) || t('resv.saveFail'); msg.className = 'modal__msg err';
  } catch {
    msg.textContent = t('net.serverError'); msg.className = 'modal__msg err';
  } finally { cargando(btn, false); }
}

// Reserva con pago en la oficina del hotel: crea la reserva ya (con el tipo),
// sin cobro en línea; el huésped paga al llegar.
async function hacerReservaOficina(btn) {
  const msg = $('reservaMsg'); msg.textContent = ''; msg.className = 'modal__msg';
  const payload = {
    llegada: llegada.value,
    salida: salida.value,
    huespedes: $('huespedes').value,
    tipo: tipoActual(),
    observacion: $('observacion').value.trim(),
    formaPago: 'oficina',
  };
  cargando(btn, true);
  try {
    const { ok, status, data } = await pedir('/api/reservas', { method: 'POST', body: JSON.stringify(payload) });
    if (status === 401) { volverAPaso1Por401(); return; }
    if (ok && data.ok) { mostrarExito(data); return; }
    msg.textContent = (data && data.error) || t('resv.saveFail'); msg.className = 'modal__msg err';
  } catch {
    msg.textContent = t('net.serverError'); msg.className = 'modal__msg err';
  } finally { cargando(btn, false); }
}

/* ---- Paso 3: formato y validación de la tarjeta (modo prueba) ---- */
const pgNumero = $('pgNumero'), pgVenc = $('pgVenc'), pgCvv = $('pgCvv'), pgTitular = $('pgTitular');

function marcaTarjeta(num) {
  if (/^4/.test(num)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  return '';
}
function luhnOk(num) {
  let s = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = num.charCodeAt(i) - 48;
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    s += d; alt = !alt;
  }
  return s % 10 === 0;
}

// Agrupa el número de 4 en 4 y detecta la marca (sin registrar el número).
pgNumero.addEventListener('input', () => {
  const d = pgNumero.value.replace(/\D/g, '').slice(0, 19);
  const marca = marcaTarjeta(d);
  pgNumero.value = d.replace(/(.{4})/g, '$1 ').trim();
  $('cardBrand').textContent = marca;
  pgCvv.maxLength = marca === 'Amex' ? 4 : 3;
  limpiarError(pgNumero, $('pgNumeroErr'));
});
// Vencimiento como MM/AA.
pgVenc.addEventListener('input', () => {
  const d = pgVenc.value.replace(/\D/g, '').slice(0, 4);
  pgVenc.value = d.length >= 3 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  limpiarError(pgVenc, $('pgVencErr'));
});
pgCvv.addEventListener('input', () => { pgCvv.value = pgCvv.value.replace(/\D/g, ''); limpiarError(pgCvv, $('pgCvvErr')); });
pgTitular.addEventListener('input', () => limpiarError(pgTitular, $('pgTitularErr')));

function validarPago() {
  let ok = true;
  if (!pgTitular.value.trim()) ok = marcarError(pgTitular, $('pgTitularErr'), t('pay.titularReq'));
  else limpiarError(pgTitular, $('pgTitularErr'));

  const num = pgNumero.value.replace(/\D/g, '');
  const marca = marcaTarjeta(num);
  const clave = { Visa: 'visa', Mastercard: 'mastercard', Amex: 'amex' }[marca];
  const aceptados = metodosPago();
  if (!/^\d{13,19}$/.test(num) || !luhnOk(num)) ok = marcarError(pgNumero, $('pgNumeroErr'), t('pay.cardInvalid'));
  else if (clave && aceptados.length && !aceptados.includes(clave)) {
    const lista = aceptados.map((m) => ETIQUETA_MARCA[m]).filter(Boolean).join(', ');
    ok = marcarError(pgNumero, $('pgNumeroErr'), t('pay.notAccepted', { marca, lista }));
  } else limpiarError(pgNumero, $('pgNumeroErr'));

  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(pgVenc.value.trim());
  if (!m) ok = marcarError(pgVenc, $('pgVencErr'), t('pay.useExp'));
  else {
    const exp = new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59, 59);
    if (exp < new Date()) ok = marcarError(pgVenc, $('pgVencErr'), t('pay.expired'));
    else limpiarError(pgVenc, $('pgVencErr'));
  }

  const cvvLen = marcaTarjeta(num) === 'Amex' ? 4 : 3;
  if (!new RegExp(`^\\d{${cvvLen}}$`).test(pgCvv.value)) ok = marcarError(pgCvv, $('pgCvvErr'), t('pay.cvvInvalid'));
  else limpiarError(pgCvv, $('pgCvvErr'));
  return ok;
}

/* ---- Paso 3: pagar y confirmar -> POST /api/reservas ---- */
$('pagoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validarPago()) return;
  const btn = $('pagar'); const msg = $('pagoMsg');
  msg.textContent = ''; msg.className = 'modal__msg';

  const payload = {
    llegada: llegada.value,
    salida: salida.value,
    huespedes: $('huespedes').value,
    tipo: tipoSeleccionado,
    observacion: $('observacion').value.trim(),
    formaPago: 'linea',
    pago: {
      numero: pgNumero.value.replace(/\s/g, ''),
      vencimiento: pgVenc.value.trim(),
      cvv: pgCvv.value,
      titular: pgTitular.value.trim(),
    },
  };

  cargando(btn, true);
  try {
    const { ok, status, data } = await pedir('/api/reservas', { method: 'POST', body: JSON.stringify(payload) });
    if (status === 401) { volverAPaso1Por401(); return; }
    if (ok && data.ok) { mostrarExito(data); return; }
    msg.textContent = (data && data.error) || t('pay.payFail'); msg.className = 'modal__msg err';
  } catch {
    msg.textContent = t('net.serverError'); msg.className = 'modal__msg err';
  } finally { cargando(btn, false); }
});

// Último éxito mostrado (para re-traducir al cambiar de idioma).
let estadoExito = null;

// Muestra el número de reserva, el tipo, el total y el pago (si hubo).
function mostrarExito(data) {
  estadoExito = data;
  renderExito(data);
  $('paso1').hidden = true; $('paso2').hidden = true; $('paso3').hidden = true;
  $('reservaOk').hidden = false;
  marcarPaso(4); // pasos completados
  // Limpia los datos de la tarjeta de la vista (no se registran).
  pgNumero.value = ''; pgVenc.value = ''; pgCvv.value = ''; pgTitular.value = ''; $('cardBrand').textContent = '';
  $('okCerrar').focus();
}

// Pinta el contenido del éxito con el idioma actual.
function renderExito(data) {
  $('okNumero').textContent = data.numero;
  const lead = $('reservaOk').querySelector('.success__lead');
  if (lead) lead.textContent = data.pago ? t('ok.leadPaid') : t('ok.lead');
  const noches = data.dias || nochesSeleccionadas();
  const partes = [];
  if (data.tipo) partes.push(data.tipo);
  else if (data.codigo) partes.push(t('ok.room', { codigo: data.codigo }));
  partes.push(nochesTxt(noches));
  if (data.total != null) partes.push(fmtMoneda(data.total));
  $('okDetalle').textContent = partes.join(' · ');
  if (data.pago) {
    $('okPago').innerHTML = t('ok.paidWith', {
      marca: escapar(data.pago.marca),
      u4: escapar(data.pago.ultimos4),
      sim: data.pago.simulado ? t('ok.testMode') : '',
    });
  } else { $('okPago').textContent = ''; }
}

$('okCerrar').addEventListener('click', () => cerrarModal());

/* ============================ Cancelación ============================ */
const modalCancel = $('modalCancel');
function abrirCancel() {
  $('cancelMsg').textContent = ''; $('cancelMsg').className = 'modal__msg';
  abrirModal(modalCancel, { foco: $('cNumero') });
}
$('openCancel').addEventListener('click', abrirCancel);
$('openCancelMobile').addEventListener('click', () => { cerrarMenuMovil(); abrirCancel(); });

$('cancelForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const numero = $('cNumero'); const tel = $('cTelefono');
  const msg = $('cancelMsg'); msg.textContent = ''; msg.className = 'modal__msg';
  let ok = true;
  if (!numero.value.trim()) ok = marcarError(numero, $('cNumeroErr'), t('cancel.numReq'));
  else limpiarError(numero, $('cNumeroErr'));
  if (!telValido(tel.value)) ok = marcarError(tel, $('cTelefonoErr'), t('err.tel'));
  else limpiarError(tel, $('cTelefonoErr'));
  if (!ok) return;

  const btn = $('confirmarCancel');
  cargando(btn, true);
  try {
    const { ok: httpOk, data } = await pedir('/api/cancelar', {
      method: 'POST',
      body: JSON.stringify({ numero: numero.value.trim(), telefono: tel.value.trim() }),
    });
    if (httpOk && data.ok) {
      msg.textContent = t('cancel.done', { numero: data.numero });
      msg.className = 'modal__msg ok';
      numero.value = ''; tel.value = '';
    } else {
      msg.textContent = (data && data.error) || t('cancel.fail'); msg.className = 'modal__msg err';
    }
  } catch {
    msg.textContent = t('net.serverError'); msg.className = 'modal__msg err';
  } finally { cargando(btn, false); }
});

/* ============================ Mis reservas (cliente) ============================
   Lista las reservas del cliente con sesión. Permite cancelar y modificar las
   fechas de las reservas ACTIVAS. Ante un 401 se reabre el inicio de sesión.
   ========================================================================= */
const modalMisReservas = $('modalMisReservas');
const BADGE_ESTADO = {
  ACTIVA: { key: 'badge.activa', cls: 'badge--ok' },
  HOSPEDADA: { key: 'badge.hospedada', cls: 'badge--info' },
  DECLINADA: { key: 'badge.cancelada', cls: 'badge--off' },
};

function abrirMisReservas() {
  abrirModal(modalMisReservas);
  cargarMisReservas();
}

function soloFecha(f) { return String(f || '').slice(0, 10); }

async function cargarMisReservas() {
  const cont = $('misResvLista');
  cont.innerHTML = `<p class="misresv__loading">${escapar(t('mis.loading'))}</p>`;
  let r;
  try {
    r = await pedir('/api/mis-reservas');
  } catch {
    cont.innerHTML = `<p class="misresv__msg err">${escapar(t('mis.connError'))}</p>`;
    return;
  }
  if (r.status === 401) { cerrarModal({ devolverFoco: false }); usuario = null; renderCuenta(); abrirAuth(); return; }
  if (!r.ok || !r.data.ok) {
    cont.innerHTML = `<p class="misresv__msg err">${escapar((r.data && r.data.error) || t('mis.loadFail'))}</p>`;
    return;
  }
  const reservas = r.data.reservas || [];
  if (!reservas.length) {
    cont.innerHTML = `<p class="misresv__empty">${escapar(t('mis.empty'))}</p>`;
    return;
  }
  cont.innerHTML = '';
  reservas.forEach((rv) => cont.appendChild(tarjetaReserva(rv)));
}

function tarjetaReserva(rv) {
  const estado = String(rv.estado || '').trim().toUpperCase();
  const badgeDef = BADGE_ESTADO[estado];
  const badge = badgeDef ? { txt: t(badgeDef.key), cls: badgeDef.cls } : { txt: rv.estado || '—', cls: 'badge--off' };
  const noches = Number(rv.dias) || 0;
  const art = document.createElement('article');
  art.className = 'misresv__card';

  const partes = [];
  if (rv.fecha) partes.push(escapar(t('mis.arrival', { fecha: formatoFecha(soloFecha(rv.fecha)) })));
  if (noches) partes.push(nochesTxt(noches));

  art.innerHTML =
    `<div class="misresv__top">` +
      `<span class="misresv__num">N.º <strong>${escapar(String(rv.numero))}</strong></span>` +
      `<span class="badge ${badge.cls}">${escapar(badge.txt)}</span>` +
    `</div>` +
    (rv.tipo ? `<p class="misresv__tipo">${escapar(rv.tipo)}</p>` : '') +
    (partes.length ? `<p class="misresv__meta">${partes.join(' · ')}</p>` : '') +
    (rv.total != null ? `<p class="misresv__total">${escapar(fmtMoneda(rv.total))}</p>` : '') +
    `<p class="misresv__msg" role="alert"></p>`;

  const msg = art.querySelector('.misresv__msg');

  if (estado === 'ACTIVA') {
    const acciones = document.createElement('div');
    acciones.className = 'misresv__acciones';
    acciones.innerHTML =
      `<button type="button" class="btn btn--ghost btn--sm" data-modificar>${escapar(t('mis.modificar'))}</button>` +
      `<button type="button" class="btn btn--danger btn--sm" data-cancelar>${escapar(t('mis.cancelar'))}</button>`;
    art.appendChild(acciones);

    // --- Formulario de modificación de fechas (oculto hasta pedirlo) ---
    const form = document.createElement('form');
    form.className = 'misresv__form';
    form.hidden = true;
    form.setAttribute('novalidate', '');
    const hoyStr = iso(new Date());
    const idL = `mrLleg-${rv.numero}`, idS = `mrSal-${rv.numero}`;
    form.innerHTML =
      `<div class="grid2">` +
        `<div class="field"><label for="${idL}">${escapar(t('mis.nuevaLlegada'))}</label>` +
          `<input type="date" id="${idL}" min="${hoyStr}" required></div>` +
        `<div class="field"><label for="${idS}">${escapar(t('mis.nuevaSalida'))}</label>` +
          `<input type="date" id="${idS}" min="${hoyStr}" required></div>` +
      `</div>` +
      `<div class="misresv__formbtns">` +
        `<button type="submit" class="btn btn--solid btn--sm" data-confirmar>${escapar(t('mis.guardar'))}</button>` +
        `<button type="button" class="btn btn--ghost btn--sm" data-cerrar-mod>${escapar(t('mis.descartar'))}</button>` +
      `</div>`;
    art.appendChild(form);

    const inpL = form.querySelector(`#${CSS.escape(idL)}`);
    const inpS = form.querySelector(`#${CSS.escape(idS)}`);
    inpL.addEventListener('change', () => {
      const min = inpL.value ? iso(new Date(new Date(inpL.value).getTime() + DIA_MS)) : hoyStr;
      inpS.min = min;
      if (!inpS.value || inpS.value <= inpL.value) inpS.value = min;
    });

    acciones.querySelector('[data-modificar]').addEventListener('click', () => {
      const abrir = form.hidden;
      form.hidden = !abrir;
      msg.textContent = ''; msg.className = 'misresv__msg';
      if (abrir) {
        if (rv.fecha) { inpL.value = soloFecha(rv.fecha); inpL.dispatchEvent(new Event('change')); }
        inpL.focus();
      }
    });
    form.querySelector('[data-cerrar-mod]').addEventListener('click', () => {
      form.hidden = true;
      acciones.querySelector('[data-modificar]').focus();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.textContent = ''; msg.className = 'misresv__msg';
      const hoy2 = iso(new Date());
      if (!inpL.value || !inpS.value) {
        msg.textContent = t('mis.pickBoth'); msg.className = 'misresv__msg err'; return;
      }
      if (inpL.value < hoy2) { msg.textContent = t('mis.pastArrival'); msg.className = 'misresv__msg err'; return; }
      if (new Date(inpS.value) <= new Date(inpL.value)) {
        msg.textContent = t('mis.afterArrival'); msg.className = 'misresv__msg err'; return;
      }
      const btn = form.querySelector('[data-confirmar]');
      cargando(btn, true);
      try {
        const res = await pedir('/api/mis-reservas/modificar', {
          method: 'POST',
          body: JSON.stringify({ numero: rv.numero, llegada: inpL.value, salida: inpS.value }),
        });
        if (res.status === 401) { cerrarModal({ devolverFoco: false }); usuario = null; renderCuenta(); abrirAuth(); return; }
        if (res.ok && res.data.ok) { cargarMisReservas(); return; }
        msg.textContent = (res.data && res.data.error) || t('mis.changeFail'); msg.className = 'misresv__msg err';
      } catch {
        msg.textContent = t('net.serverError'); msg.className = 'misresv__msg err';
      } finally { cargando(btn, false); }
    });

    acciones.querySelector('[data-cancelar]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      msg.textContent = ''; msg.className = 'misresv__msg';
      cargando(btn, true);
      try {
        const res = await pedir('/api/mis-reservas/cancelar', {
          method: 'POST',
          body: JSON.stringify({ numero: rv.numero }),
        });
        if (res.status === 401) { cerrarModal({ devolverFoco: false }); usuario = null; renderCuenta(); abrirAuth(); return; }
        if (res.ok && res.data.ok) { cargarMisReservas(); return; }
        msg.textContent = (res.data && res.data.error) || t('cancel.fail'); msg.className = 'misresv__msg err';
      } catch {
        msg.textContent = t('net.serverError'); msg.className = 'misresv__msg err';
      } finally { cargando(btn, false); }
    });
  }

  return art;
}

/* ============================ Menú móvil ============================ */
const burger = $('burger');
const nav = document.querySelector('.nav');
const menuMovil = $('mobileMenu');

function cerrarMenuMovil() {
  nav.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
  menuMovil.hidden = true;
}
burger.addEventListener('click', () => {
  const abierto = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(abierto));
  menuMovil.hidden = !abierto;
});
menuMovil.querySelectorAll('a').forEach((a) => a.addEventListener('click', cerrarMenuMovil));
// Cerrar el menú móvil con Escape o al tocar fuera (si no hay modal activo).
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalActivo && nav.classList.contains('open')) {
    cerrarMenuMovil(); burger.focus();
  }
});
document.addEventListener('click', (e) => {
  if (nav.classList.contains('open') && !nav.contains(e.target)) cerrarMenuMovil();
});

/* ============================ Galería: lightbox ============================
   Abre la imagen en grande reutilizando el gestor de modales (foco, Escape,
   backdrop e inert ya resueltos). Sin scripts inline (compatible con CSP).
   ========================================================================= */
const galeriaGrid = $('galeria-grid');
if (galeriaGrid) {
  galeriaGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.gallery__item');
    if (!btn) return;
    const img = btn.querySelector('img');
    if (!img) return;
    const amp = $('lightboxImg');
    amp.src = img.currentSrc || img.src;
    amp.alt = img.alt || '';
    abrirModal($('lightbox'));
  });
}

/* ============================ Selector de tema ============================
   4 temas con variables CSS (html[data-theme]). La elección se guarda en
   localStorage y se aplica al cargar (el <head> ya la aplicó para evitar
   parpadeo). Cambiar de tema NO toca el HTML ni la lógica.
   ========================================================================= */
const TEMAS = ['esmeralda', 'costa-azul', 'carbon-oro', 'editorial-blanco'];
const TEMA_KEY = 'tema';
const temaBtn = $('themeBtn');
const temaMenu = $('themeMenu');

function guardarTema(t) { try { localStorage.setItem(TEMA_KEY, t); } catch { /* sin persistencia */ } }

// Tema por defecto inyectado por el servidor como <html data-tema-defecto="…">.
function temaDefectoServidor() {
  const d = document.documentElement.getAttribute('data-tema-defecto');
  return TEMAS.includes(d) ? d : null;
}

// Resuelve el tema a aplicar:
// 1) localStorage "tema"  2) <html data-tema-defecto>  3) "esmeralda".
function resolverTema() {
  try { const s = localStorage.getItem(TEMA_KEY); if (TEMAS.includes(s)) return s; } catch { /* sin acceso */ }
  return temaDefectoServidor() || 'esmeralda';
}

function aplicarTema(t) {
  if (!TEMAS.includes(t)) t = 'esmeralda';
  document.documentElement.setAttribute('data-theme', t);
  temaMenu.querySelectorAll('.theme__opt').forEach((o) =>
    o.setAttribute('aria-checked', String(o.dataset.theme === t)));
}

function cerrarTemaFuera(e) { if (!$('theme').contains(e.target)) cerrarTemaMenu(); }
function abrirTemaMenu() {
  temaMenu.hidden = false;
  temaBtn.setAttribute('aria-expanded', 'true');
  const activo = temaMenu.querySelector('[aria-checked="true"]') || temaMenu.querySelector('.theme__opt');
  if (activo) activo.focus();
  document.addEventListener('click', cerrarTemaFuera);
}
function cerrarTemaMenu({ foco = false } = {}) {
  if (!temaMenu || temaMenu.hidden) return;
  temaMenu.hidden = true;
  temaBtn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', cerrarTemaFuera);
  if (foco) temaBtn.focus();
}

temaBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (temaMenu.hidden) abrirTemaMenu(); else cerrarTemaMenu();
});
temaMenu.querySelectorAll('.theme__opt').forEach((o) => {
  o.addEventListener('click', () => {
    aplicarTema(o.dataset.theme);
    guardarTema(o.dataset.theme);
    cerrarTemaMenu({ foco: true });
  });
});
// Teclado: Escape cierra; flechas navegan entre opciones.
temaMenu.addEventListener('keydown', (e) => {
  const opts = Array.from(temaMenu.querySelectorAll('.theme__opt'));
  const i = opts.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); cerrarTemaMenu({ foco: true }); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
});

/* ============ Progreso de scroll + botón "volver arriba" ============
   Barra fina superior que refleja el avance de lectura y un botón flotante
   que aparece al bajar. Lectura de scroll en rAF (sin saltos) y respeto de
   prefers-reduced-motion. Sin scripts inline (compatible con CSP estricta).
   ================================================================== */
const toTop = $('toTop');
const barraProgreso = $('scrollProgress') ? $('scrollProgress').querySelector('i') : null;
const prefiereMenosMovimiento = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

if (toTop) {
  toTop.hidden = false; // solo con JS activo; el control visible lo da el CSS
  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefiereMenosMovimiento ? 'auto' : 'smooth' });
  });
}

let scrollTicking = false;
function actualizarScrollUI() {
  const doc = document.documentElement;
  const max = (doc.scrollHeight - doc.clientHeight) || 1;
  const y = window.scrollY || doc.scrollTop || 0;
  if (barraProgreso) barraProgreso.style.transform = `scaleX(${Math.min(1, Math.max(0, y / max))})`;
  if (toTop) toTop.classList.toggle('is-visible', y > 600);
  scrollTicking = false;
}
function alHacerScroll() {
  if (!scrollTicking) { scrollTicking = true; requestAnimationFrame(actualizarScrollUI); }
}
window.addEventListener('scroll', alHacerScroll, { passive: true });
window.addEventListener('resize', alHacerScroll, { passive: true });
actualizarScrollUI(); // estado inicial

/* ============================ Reseñas de huéspedes ============================
   Testimonios públicos (GET /api/resenas) + formulario para dejar reseña
   (POST /api/resenas, requiere sesión de cliente). El formulario solo se
   muestra con sesión; sin ella se invita a iniciar sesión. CSP-safe.
   ========================================================================= */
const reviewsList = $('reviewsList');
const reviewsFormWrap = $('reviewsFormWrap');
// undefined = aún sin cargar; null = error; array = reseñas.
let resenasData;

function estrellasHTML(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span${i <= n ? ' class="is-on"' : ''}>★</span>`;
  return s;
}

function formatoFechaResena(valor) {
  const d = new Date(valor);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(LOCALE_FECHA[idiomaActual] || 'es-DO',
      { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

// Pinta la lista desde la caché (o el mensaje de carga / vacío / error).
function renderResenas() {
  if (!reviewsList) return;
  if (resenasData === undefined) return; // aún cargando: conserva el placeholder
  if (resenasData === null) {
    reviewsList.innerHTML = `<p class="reviews__msg err">${escapar(t('rev.error'))}</p>`;
    return;
  }
  if (!resenasData.length) {
    reviewsList.innerHTML = `<p class="reviews__empty">${escapar(t('rev.empty'))}</p>`;
    return;
  }
  reviewsList.innerHTML = '';
  resenasData.forEach((r) => {
    const art = document.createElement('article');
    art.className = 'review';
    const rating = Number(r.rating) || 0;
    const fecha = r.creado ? formatoFechaResena(r.creado) : '';
    art.innerHTML =
      `<div class="review__top">` +
        `<span class="review__name">${escapar(r.nombre || '')}</span>` +
        `<span class="stars" role="img" aria-label="${escapar(t('rev.ratingLabel', { n: rating }))}">${estrellasHTML(rating)}</span>` +
      `</div>` +
      `<p class="review__text">${escapar(r.comentario || '')}</p>` +
      (fecha ? `<p class="review__date">${escapar(fecha)}</p>` : '');
    reviewsList.appendChild(art);
  });
}

async function cargarResenas() {
  if (!reviewsList) return;
  try {
    const { ok, data } = await pedir('/api/resenas', { credentials: 'include' });
    if (!ok || !data || !data.ok) { resenasData = null; renderResenas(); return; }
    resenasData = Array.isArray(data.resenas) ? data.resenas : [];
    renderResenas();
  } catch { resenasData = null; renderResenas(); }
}

// Formulario (con sesión) o aviso para iniciar sesión (sin ella).
function renderResenasForm() {
  if (!reviewsFormWrap) return;
  if (usuario) {
    let estrellas = '';
    // Orden inverso (5→1) para el iluminado con ~ en CSS; accesible por teclado.
    for (let i = 5; i >= 1; i--) {
      estrellas +=
        `<input type="radio" name="revRating" id="revStar${i}" value="${i}">` +
        `<label for="revStar${i}" title="${escapar(t('rev.stars' + i))}">` +
          `<span aria-hidden="true">★</span>` +
          `<span class="sr-only">${escapar(t('rev.stars' + i))}</span>` +
        `</label>`;
    }
    reviewsFormWrap.innerHTML =
      `<form class="reviews__form" id="reviewForm" novalidate>` +
        `<p class="step__hint">${escapar(t('rev.formHint'))}</p>` +
        `<div class="field">` +
          `<span class="field__label">${escapar(t('rev.yourRating'))}</span>` +
          `<fieldset class="rating" id="revRatingGroup">` +
            `<legend class="sr-only">${escapar(t('rev.yourRating'))}</legend>` +
            estrellas +
          `</fieldset>` +
        `</div>` +
        `<div class="field">` +
          `<label for="revComentario">${escapar(t('rev.comment'))}</label>` +
          `<textarea id="revComentario" rows="3" maxlength="400" placeholder="${escapar(t('rev.commentPh'))}"></textarea>` +
        `</div>` +
        `<button type="submit" class="btn btn--solid modal__submit" id="revEnviar">${escapar(t('rev.send'))}</button>` +
        `<p class="modal__msg" id="revMsg" role="alert"></p>` +
      `</form>`;
    cablearResenaForm();
  } else {
    reviewsFormWrap.innerHTML =
      `<div class="reviews__login">` +
        `<p>${escapar(t('rev.needLogin'))}</p>` +
        `<button type="button" class="btn btn--solid btn--sm" data-rev-login>${escapar(t('rev.loginBtn'))}</button>` +
      `</div>`;
    reviewsFormWrap.querySelectorAll('[data-rev-login]').forEach((b) =>
      b.addEventListener('click', abrirAuth));
  }
}

function cablearResenaForm() {
  const form = $('reviewForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('revMsg'); msg.textContent = ''; msg.className = 'modal__msg';
    const sel = form.querySelector('input[name="revRating"]:checked');
    const rating = sel ? Number(sel.value) : 0;
    const comentario = $('revComentario').value.trim();
    if (!rating) { msg.textContent = t('rev.pickRating'); msg.className = 'modal__msg err'; return; }
    if (comentario.length < 4) { msg.textContent = t('rev.needComment'); msg.className = 'modal__msg err'; return; }

    const btn = $('revEnviar');
    cargando(btn, true);
    try {
      const { ok, status, data } = await pedir('/api/resenas', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ rating, comentario }),
      });
      if (status === 401) { usuario = null; renderCuenta(); abrirAuth(); return; }
      if (ok && data && data.ok) {
        msg.textContent = (data && data.mensaje) || t('rev.thanks');
        msg.className = 'modal__msg ok';
        $('revComentario').value = '';
        form.querySelectorAll('input[name="revRating"]').forEach((r) => { r.checked = false; });
        cargarResenas(); // refresca la lista de testimonios
      } else {
        msg.textContent = (data && (data.error || data.mensaje)) || t('rev.sendFail');
        msg.className = 'modal__msg err';
      }
    } catch {
      msg.textContent = t('net.serverError'); msg.className = 'modal__msg err';
    } finally { cargando(btn, false); }
  });
}

/* ============================ Arranque ============================ */
aplicarTema(resolverTema()); // sincroniza el selector con el tema resuelto
aplicarIdioma(resolverIdioma()); // aplica ES/EN guardado (por defecto ES) y traduce el DOM
$('year').textContent = new Date().getFullYear();
resumenFechas();  // muestra la selección de fechas por defecto
dispoLive();      // y la disponibilidad para esas fechas (si hay sesión)
renderCuenta();   // pinta estado inicial (sin sesión) de inmediato
cargarSesion();   // y lo corrige cuando responde /api/yo
// Config del sitio (pago, tarifas, contacto, tema) y luego el catálogo público.
cargarConfig().then(cargarCatalogo);
cargarResenas();  // testimonios públicos (el formulario lo pinta renderCuenta según sesión)

/* ===== Backend remoto por túnel =====
   Abre el demo con ?api=<URL-del-túnel> para que TODAS las llamadas /api vayan a
   ese backend (ver pedir()) y así emular el sitio real (frontend en el hosting +
   backend/BD en la LAN por el túnel). Se guarda en localStorage y persiste.
   ?api=off  borra la configuración y vuelve al modo estático.
   El aviso va ABAJO, se puede cerrar con clic y se oculta solo. */
(function () {
  try {
    var qp = new URLSearchParams(location.search).get('api');
    if (qp != null) {
      qp = qp.trim().replace(/\/+$/, '');
      try {
        if (qp === '' || qp.toLowerCase() === 'off') localStorage.removeItem('apiBase');
        else if (/^https?:\/\//.test(qp)) localStorage.setItem('apiBase', qp);
      } catch (e) {}
    }
    var api = '';
    try { api = localStorage.getItem('apiBase') || API_DEFECTO; } catch (e) { api = API_DEFECTO; }
    if (!api) return;
    var b = document.createElement('div');
    b.setAttribute('role', 'status');
    b.title = 'Clic para ocultar';
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:9px 16px;font:600 13px/1.4 Inter,system-ui,sans-serif;text-align:center;color:#fff;background:#6b6b6b;cursor:pointer';
    b.textContent = 'Conectando con el servidor por el túnel…';
    var quitar = function () { if (b && b.parentNode) b.parentNode.removeChild(b); };
    b.addEventListener('click', quitar);
    var add = function () { (document.body || document.documentElement).appendChild(b); };
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
    var set = function (bg, txt) { b.style.background = bg; b.textContent = txt + '   (clic para ocultar)'; setTimeout(quitar, 6000); };
    fetch(api + '/api/salud', { cache: 'no-store' })
      .then(function (r) {
        if (r.ok) return r.json().then(function (d) {
          if (d && d.ok) set('#153e33', '✅ Conectado al backend y a la base de datos por el túnel (modo backend remoto).');
          else set('#9a6b00', '⚠️ Backend alcanzado, pero la base de datos no respondió.');
        });
        set('#9a6b00', '⚠️ Backend alcanzado por el túnel, pero respondió HTTP ' + r.status + '.');
      })
      .catch(function () {
        set('#8a1f1f', '❌ No se pudo alcanzar el backend (' + api + ').');
      });
  } catch (e) {}
})();
