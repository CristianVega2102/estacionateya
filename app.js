import {
  observarSesion, registrar, ingresar, ingresarConGoogle, salir, obtenerPerfil, traducirError
} from "./auth.js";
import {
  crearSpot, escucharSpotsDisponibles, escucharMisSpots, reservarSpot, finalizarSpot
} from "./spots.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const soloDigitos = (t = "") => String(t).replace(/\D/g, "");
const esc = (t = "") => String(t).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let usuario = null, perfil = null;
let modoAuth = "ingresar", filtro = "calle", tipoPublicar = "calle", coords = null;
let stopBuscar = null, stopMis = null;

/* ---------- Utilidades de pantalla ---------- */
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("visible"), 3200);
}

function mostrar(pantalla) {
  $("#cargando").hidden = true;
  $("#pantalla-auth").hidden = pantalla !== "auth";
  $("#pantalla-app").hidden = pantalla !== "app";
}

function irA(vista) {
  $$(".vista").forEach((v) => (v.hidden = v.id !== `vista-${vista}`));
  $$(".nav-btn").forEach((b) => b.classList.toggle("activo", b.dataset.vista === vista));
  if (vista === "publicar") $("#pub-telefono").value = perfil?.telefono || $("#pub-telefono").value;
  window.scrollTo(0, 0);
}

/* ---------- Acceso ---------- */
function setModoAuth(modo) {
  modoAuth = modo;
  $$(".tab-auth").forEach((b) => b.classList.toggle("activo", b.dataset.modo === modo));
  $$(".solo-registro").forEach((el) => (el.hidden = modo !== "registro"));
  $("#auth-nombre").required = modo === "registro";
  $("#auth-telefono").required = modo === "registro";
  $("#btn-auth").textContent = modo === "registro" ? "Crear cuenta" : "Ingresar";
  $("#auth-password").autocomplete = modo === "registro" ? "new-password" : "current-password";
  $("#auth-error").textContent = "";
}

$$(".tab-auth").forEach((b) => b.addEventListener("click", () => setModoAuth(b.dataset.modo)));

$("#form-auth").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#btn-auth");
  btn.disabled = true;
  $("#auth-error").textContent = "";
  try {
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    if (modoAuth === "registro") {
      perfil = await registrar({
        nombre: $("#auth-nombre").value.trim(),
        telefono: soloDigitos($("#auth-telefono").value),
        email, password
      });
    } else {
      await ingresar(email, password);
    }
  } catch (err) {
    console.error(err);
    $("#auth-error").textContent = traducirError(err.code);
  } finally {
    btn.disabled = false;
  }
});

$("#btn-google").addEventListener("click", async () => {
  $("#auth-error").textContent = "";
  try { await ingresarConGoogle(); }
  catch (err) { console.error(err); $("#auth-error").textContent = traducirError(err.code); }
});

$("#btn-salir").addEventListener("click", () => salir());

/* ---------- Sesión ---------- */
observarSesion(async (user) => {
  detenerEscuchas();
  if (!user) {
    usuario = null; perfil = null;
    mostrar("auth");
    return;
  }
  usuario = user;
  perfil = (await obtenerPerfil(user.uid)) ||
    { nombre: user.displayName || user.email.split("@")[0], telefono: "" };
  mostrar("app");
  irA("buscar");
  escucharBusqueda();
  stopMis = escucharMisSpots(user.uid, renderMis, errorDatos);
});

function detenerEscuchas() {
  if (stopBuscar) stopBuscar();
  if (stopMis) stopMis();
  stopBuscar = stopMis = null;
}

function errorDatos(err) {
  console.error(err);
  toast("No pudimos cargar los lugares. Revisá tu conexión.");
}

/* ---------- Tarjetas ---------- */
function linkWhatsApp(s) {
  const texto = `Hola ${s.anclaNombre}, vi tu lugar en EstacionateYa (${s.direccion}). ¿Sigue disponible?`;
  return `https://wa.me/${soloDigitos(s.anclaTelefono)}?text=${encodeURIComponent(texto)}`;
}

function tarjeta(s, propia) {
  const esCalle = s.tipo === "calle";
  const costo = Number(s.costo) > 0 ? `$${Number(s.costo).toLocaleString("es-AR")}` : "Gratis";
  const unidad = s.fraccionTiempo === "por hora" ? "por hora" : "pago único";
  const mapa = s.lat != null
    ? `<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${Number(s.lat)},${Number(s.lng)}">Ver en el mapa</a>` : "";
  const horario = s.horario ? `<p class="detalle">Horario: ${esc(s.horario)}</p>` : "";
  let acciones = "";
  if (propia) {
    if (s.estado !== "finalizado") {
      acciones = `<div class="acciones una"><button class="btn btn-borde" data-accion="finalizar" data-id="${esc(s.id)}">Finalizar</button></div>`;
    }
  } else {
    acciones = `<div class="acciones">
      <button class="btn btn-primario" data-accion="reservar" data-id="${esc(s.id)}">Reservar</button>
      <a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${linkWhatsApp(s)}">WhatsApp</a>
    </div>`;
  }
  const marca = propia
    ? `<span class="estado ${esc(s.estado)}">${esc(s.estado)}</span>`
    : `<span class="insignia">${esCalle ? "En vivo" : "Garage"}</span>`;
  return `<article class="tarjeta ${esCalle ? "calle" : "garage"}">
    <div class="tarjeta-fila">
      <div>${marca}</div>
      <div class="precio">${costo}<small>${unidad}</small></div>
    </div>
    <p class="direccion">${esc(s.direccion)}</p>
    ${s.descripcion ? `<p class="detalle">${esc(s.descripcion)}</p>` : ""}
    ${horario}
    <p class="detalle">Publica ${esc(s.anclaNombre)}</p>
    ${mapa}
    ${acciones}
  </article>`;
}

/* ---------- Buscar (Conductor) ---------- */
function escucharBusqueda() {
  if (stopBuscar) stopBuscar();
  $("#lista-buscar").innerHTML = '<p class="vacio">Buscando lugares…</p>';
  stopBuscar = escucharSpotsDisponibles(filtro, renderBuscar, errorDatos);
}

function renderBuscar(lista) {
  const ajenos = lista.filter((s) => s.anclaId !== usuario?.uid);
  $("#lista-buscar").innerHTML = ajenos.length
    ? ajenos.map((s) => tarjeta(s, false)).join("")
    : '<p class="vacio">No hay lugares disponibles ahora. Probá en unos minutos o publicá el tuyo.</p>';
}

$$(".chip").forEach((chip) => chip.addEventListener("click", () => {
  filtro = chip.dataset.filtro;
  $$(".chip").forEach((c) => c.classList.toggle("activo", c === chip));
  escucharBusqueda();
}));

/* ---------- Mis lugares (Ancla) ---------- */
function renderMis(lista) {
  $("#lista-mis").innerHTML = lista.length
    ? lista.map((s) => tarjeta(s, true)).join("")
    : '<p class="vacio">Todavía no publicaste nada. Tocá Publicar para ofrecer tu lugar.</p>';
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-accion]");
  if (!btn) return;
  const { accion, id } = btn.dataset;
  if (accion === "reservar" && !confirm("¿Reservar este lugar?")) return;
  btn.disabled = true;
  try {
    if (accion === "reservar") {
      await reservarSpot(id);
      toast("Lugar reservado. Coordiná con quien lo publicó.");
    } else if (accion === "finalizar") {
      await finalizarSpot(id);
      toast("Publicación finalizada.");
    }
  } catch (err) {
    console.error(err);
    toast("No se pudo completar la acción. Probá de nuevo.");
    btn.disabled = false;
  }
});

/* ---------- Publicar (Ancla) ---------- */
function setTipoPublicar(tipo) {
  tipoPublicar = tipo;
  $$(".seg").forEach((b) => b.classList.toggle("activo", b.dataset.tipo === tipo));
  $$(".solo-calle").forEach((el) => (el.hidden = tipo !== "calle"));
  $$(".solo-garage").forEach((el) => (el.hidden = tipo !== "garage"));
  $("#lbl-direccion").textContent = tipo === "calle" ? "Calle y altura" : "Dirección exacta";
  $("#lbl-costo").textContent = tipo === "calle" ? "Costo (pago único)" : "Costo por hora";
  $("#pub-descripcion").placeholder = tipo === "calle"
    ? "Ej: auto gris, salgo en 5 minutos" : "Ej: portón verde, timbre 2";
}

$$(".seg").forEach((b) => b.addEventListener("click", () => setTipoPublicar(b.dataset.tipo)));

$("#btn-ubicacion").addEventListener("click", () => {
  const estado = $("#estado-ubicacion");
  if (!navigator.geolocation) { estado.textContent = "Tu navegador no permite ubicación."; return; }
  estado.textContent = "Buscando ubicación…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      estado.textContent = "Ubicación guardada.";
    },
    () => { estado.textContent = "No pudimos obtenerla. Activá el GPS y el permiso de ubicación."; },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

$("#form-publicar").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (tipoPublicar === "calle" && !coords) {
    toast("Tocá «Usar mi ubicación actual» primero.");
    return;
  }
  const btn = $("#btn-publicar");
  btn.disabled = true;
  try {
    await crearSpot({
      anclaId: usuario.uid,
      anclaNombre: perfil.nombre,
      anclaTelefono: soloDigitos($("#pub-telefono").value),
      tipo: tipoPublicar,
      lat: tipoPublicar === "calle" ? coords.lat : null,
      lng: tipoPublicar === "calle" ? coords.lng : null,
      direccion: $("#pub-direccion").value.trim(),
      descripcion: $("#pub-descripcion").value.trim(),
      horario: tipoPublicar === "garage" ? $("#pub-horario").value.trim() : "",
      costo: Number($("#pub-costo").value),
      fraccionTiempo: tipoPublicar === "calle" ? "único" : "por hora"
    });
    e.target.reset();
    coords = null;
    $("#estado-ubicacion").textContent = "Hace falta para que te encuentren.";
    toast("Publicado. Ya lo ven los conductores.");
    irA("mis");
  } catch (err) {
    console.error(err);
    toast("No se pudo publicar. Probá de nuevo.");
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Navegación inferior ---------- */
$$(".nav-btn").forEach((b) => b.addEventListener("click", () => irA(b.dataset.vista)));

setModoAuth("ingresar");
setTipoPublicar("calle");
