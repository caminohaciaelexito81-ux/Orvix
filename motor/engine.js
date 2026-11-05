// Cerebro del bot: mensajes entrantes, flujos, remarketing y validación de pagos.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DATOS, db, contactos, guardar, evento, nuevoId, botPorId } from './store.js';
import * as wa from './whatsapp.js';
import * as ia from './ia.js';
import { estaBloqueado, paisesDe } from './paises.js';

const VERSION_GRAPH = 'v24.0';
const MAX_MENSAJES = 300;

export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const lista = s => String(s || '').split(';').map(x => x.trim()).filter(Boolean);
const escaparRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const azar = (a, b) => a + Math.floor(Math.random() * (b - a));
const MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
const aMs = (cantidad, unidad) => Math.max(0, Number(cantidad) || 0) * (MS[unidad] || 1000);

// ¿El texto contiene alguna de las palabras o frases (como palabra completa)?
export function coincide(texto, palabras) {
  const t = norm(texto);
  return (palabras || []).some(p => {
    const w = norm(p);
    return w && new RegExp('(^|[^a-z0-9])' + escaparRe(w) + '($|[^a-z0-9])').test(t);
  });
}

// ---------- Contactos y mensajes ----------

function telefonoDe(jid, m) {
  const limpio = j => String(j || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  if (jid.endsWith('@s.whatsapp.net')) return limpio(jid);
  const k = m?.key || {};
  return limpio(k.senderPn || k.remoteJidAlt || k.participantPn || '');
}

export function contactoDe(botId, jid, m) {
  const cs = (contactos[botId] ||= {});
  let c = cs[jid];
  if (!c) {
    c = cs[jid] = {
      jid, telefono: telefonoDe(jid, m), nombre: m?.pushName || '', creado: Date.now(), ultimo: Date.now(),
      anuncio: null, etiquetas: [], pagado: false, totalPagado: 0, compras: 0, iaActiva: false, pausado: false,
      exec: null, remarketing: null, salidas: {}, noLeidos: 0, nuevo: true, mensajes: []
    };
  }
  if (m?.pushName && !c.nombre) c.nombre = m.pushName;
  if (!c.telefono && m) c.telefono = telefonoDe(jid, m);
  return c;
}

export function agregar(botId, c, msg) {
  const completo = { id: nuevoId('m'), ts: Date.now(), ...msg };
  c.mensajes.push(completo);
  if (c.mensajes.length > MAX_MENSAJES) c.mensajes.splice(0, c.mensajes.length - MAX_MENSAJES);
  c.ultimo = completo.ts;
  guardar(botId);
  return completo;
}

function etiquetar(c, etiqueta) {
  const e = String(etiqueta || '').trim();
  if (e && !c.etiquetas.includes(e)) c.etiquetas.push(e);
}

function contenido(m) {
  let msg = m.message;
  if (!msg) return null;
  msg = msg.ephemeralMessage?.message || msg.viewOnceMessage?.message || msg.viewOnceMessageV2?.message || msg.documentWithCaptionMessage?.message || msg;
  if (msg.conversation) return { tipo: 'texto', texto: msg.conversation };
  if (msg.extendedTextMessage) return { tipo: 'texto', texto: msg.extendedTextMessage.text || '', ctx: msg.extendedTextMessage.contextInfo };
  if (msg.imageMessage) return { tipo: 'imagen', texto: msg.imageMessage.caption || '', mime: msg.imageMessage.mimetype, ctx: msg.imageMessage.contextInfo };
  if (msg.videoMessage) return { tipo: 'video', texto: msg.videoMessage.caption || '', mime: msg.videoMessage.mimetype, ctx: msg.videoMessage.contextInfo };
  if (msg.audioMessage) return { tipo: 'audio', texto: '', mime: msg.audioMessage.mimetype, ctx: msg.audioMessage.contextInfo };
  if (msg.documentMessage) return { tipo: 'documento', texto: msg.documentMessage.caption || '', mime: msg.documentMessage.mimetype, nombre: msg.documentMessage.fileName };
  if (msg.stickerMessage) return { tipo: 'sticker', texto: '', mime: msg.stickerMessage.mimetype };
  const boton = msg.buttonsResponseMessage?.selectedDisplayText || msg.listResponseMessage?.title || msg.templateButtonReplyMessage?.selectedDisplayText;
  if (boton) return { tipo: 'texto', texto: boton };
  return null;
}

const EXTENSION = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'application/pdf': 'pdf' };

function guardarMedia(botId, buffer, cont) {
  const mime = String(cont.mime || '').split(';')[0];
  const ext = EXTENSION[mime] || (cont.nombre || '').split('.').pop() || 'bin';
  const carpeta = path.join(DATOS, 'media', botId);
  fs.mkdirSync(carpeta, { recursive: true });
  const nombre = `${nuevoId('r')}.${ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin'}`;
  fs.writeFileSync(path.join(carpeta, nombre), buffer);
  return `/media/${botId}/${nombre}`;
}

// ---------- Envíos ----------

const variables = (texto, c) => String(texto || '')
  .replace(/\{nombre\}/gi, (c.nombre || '').split(' ')[0] || '')
  .replace(/\{telefono\}/gi, c.telefono || '');

export async function enviarTexto(bot, c, texto, de = 'bot') {
  const t = variables(texto, c).trim();
  if (!t) return;
  if (de === 'bot') await wa.escribiendo(bot.id, c.jid, Math.min(3500, 500 + t.length * 20));
  await wa.enviar(bot.id, c.jid, { text: t });
  agregar(bot.id, c, { de, tipo: 'texto', texto: t });
}

export async function enviarArchivo(bot, c, archivoId, caption = '', de = 'bot') {
  const a = db.archivos.find(x => x.id === archivoId);
  if (!a) return;
  const buffer = fs.readFileSync(path.join(DATOS, 'archivos', a.ruta));
  const pie = variables(caption, c).trim() || undefined;
  let cont, tipo;
  if (a.tipo.startsWith('image/')) { cont = { image: buffer, caption: pie }; tipo = 'imagen'; }
  else if (a.tipo.startsWith('video/')) { cont = { video: buffer, caption: pie }; tipo = 'video'; }
  else if (a.tipo.startsWith('audio/')) {
    const esNota = a.tipo.includes('ogg');
    cont = { audio: buffer, mimetype: esNota ? 'audio/ogg; codecs=opus' : a.tipo, ptt: esNota }; tipo = 'audio';
  } else { cont = { document: buffer, mimetype: a.tipo || 'application/octet-stream', fileName: a.nombre, caption: pie }; tipo = 'documento'; }
  await wa.enviar(bot.id, c.jid, cont);
  agregar(bot.id, c, { de, tipo, texto: pie || '', archivo: `/archivo/${a.id}`, nombre: a.nombre });
}

// ---------- Flujos ----------

export function iniciarFlujo(bot, c, flujoId, esperaMs = 0) {
  c.exec = { flujoId, ruta: [], i: 0, sigue: Date.now() + esperaMs, espera: null };
  c.flujoIniciado = true;
  guardar(bot.id);
}

// Busca la lista de nodos donde va el contacto, bajando por las ramas que ya tomó.
function secuencia(flujo, ruta) {
  let seq = flujo.nodos;
  for (const r of ruta) {
    const n = seq?.[r.i];
    if (!n) return null;
    if (n.tipo === 'condicion') seq = n.ramas?.[r.k];
    else if (n.tipo === 'distribuidor') seq = n.salidas?.find(s => s.id === r.k)?.nodos;
    else return null;
  }
  return seq || null;
}

function ramificar(bot, c, rama) {
  const e = c.exec;
  e.ruta.push({ i: e.espera.i, k: rama });
  e.i = 0; e.espera = null; e.sigue = Date.now() + 800;
  guardar(bot.id);
}

async function paso(bot, c) {
  const e = c.exec;
  const flujo = db.flujos.find(f => f.id === e.flujoId);
  const seq = flujo && secuencia(flujo, e.ruta);
  if (!seq || e.i >= seq.length) { c.exec = null; guardar(bot.id); return; }
  const idx = e.i, n = seq[idx];
  e.i++;
  e.sigue = Date.now() + azar(700, 1500);
  try {
    switch (n.tipo) {
      case 'texto': await enviarTexto(bot, c, n.texto); break;
      case 'media': if (n.archivoId) await enviarArchivo(bot, c, n.archivoId, n.caption); break;
      case 'pausa': e.sigue = Date.now() + aMs(n.cantidad, n.unidad); break;
      case 'condicion':
        await enviarTexto(bot, c, n.pregunta);
        e.espera = { i: idx, hasta: Date.now() + (aMs(n.espera?.cantidad, n.espera?.unidad) || MS.d) };
        break;
      case 'distribuidor': {
        if (!n.salidas?.length) break;
        const st = (db.distrib[n.id] ||= { cursor: 0, leads: {} });
        const salida = n.salidas[st.cursor % n.salidas.length];
        st.cursor++;
        st.leads[salida.id] = (st.leads[salida.id] || 0) + 1;
        c.salidas[n.id] = salida.id;
        e.ruta.push({ i: idx, k: salida.id });
        e.i = 0; e.sigue = Date.now();
        guardar();
        break;
      }
      case 'etiqueta': etiquetar(c, n.etiqueta); e.sigue = Date.now(); break;
      case 'ia': c.iaActiva = n.activar !== false; e.sigue = Date.now(); break;
      case 'remarketing':
        if (!c.pagado && n.pasos?.length) {
          c.remarketing = { pasos: n.pasos, i: 0, sigue: Date.now() + aMs(n.minutos, 'm'), desde: n.desde || '07:00', hasta: n.hasta || '21:00', zona: bot.zona };
        }
        e.sigue = Date.now();
        break;
    }
  } catch (err) {
    // Si falló el envío (por ejemplo, se cayó la conexión), reintenta este mismo paso luego.
    e.i = idx; e.sigue = Date.now() + 8000;
    console.error('[flujo]', err.message);
  }
  guardar(bot.id);
}

function horaEn(zona) {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
  catch { return new Date().toTimeString().slice(0, 5); }
}

async function pasoRemarketing(bot, c) {
  const r = c.remarketing;
  if (r.i >= r.pasos.length) { c.remarketing = null; guardar(bot.id); return; }
  const p = r.pasos[r.i];
  if (p.tipo === 'pausa') { r.i++; r.sigue = Date.now() + aMs(p.minutos, 'm'); guardar(bot.id); return; }
  const hora = horaEn(r.zona);
  if (hora < r.desde || hora > r.hasta) { r.sigue = Date.now() + 5 * MS.m; return; }
  try {
    if (p.tipo === 'texto') await enviarTexto(bot, c, p.texto);
    else if (p.tipo === 'media' && p.archivoId) await enviarArchivo(bot, c, p.archivoId, p.caption);
    r.i++; r.sigue = Date.now() + azar(1500, 3000);
  } catch (err) {
    r.sigue = Date.now() + 30000;
    console.error('[remarketing]', err.message);
  }
  guardar(bot.id);
}

const ocupado = new Set();
function lanzar(clave, tarea) {
  ocupado.add(clave);
  tarea().catch(e => console.error('[motor]', e)).finally(() => ocupado.delete(clave));
}

function tic() {
  const ahora = Date.now();
  for (const bot of db.bots) {
    if (!wa.conectado(bot.id)) continue;
    const cs = contactos[bot.id] || {};
    for (const jid in cs) {
      const c = cs[jid];
      if (c.pausado || (!c.exec && !c.remarketing)) continue;
      const clave = bot.id + '|' + jid;
      if (ocupado.has(clave)) continue;
      if (c.exec) {
        if (c.exec.espera) { if (ahora >= c.exec.espera.hasta) ramificar(bot, c, 'otros'); }
        else if (ahora >= c.exec.sigue) lanzar(clave, () => paso(bot, c));
      } else if (c.remarketing) {
        if (c.pagado) { c.remarketing = null; guardar(bot.id); }
        else if (ahora >= c.remarketing.sigue) lanzar(clave, () => pasoRemarketing(bot, c));
      }
    }
  }
}
export function arrancarMotor() { setInterval(tic, 500); }

// ---------- Pagos ----------

let trabajadorOcr = null;
async function ocr(buffer) {
  trabajadorOcr ||= import('tesseract.js').then(t => t.createWorker('spa'));
  const trabajador = await trabajadorOcr;
  const { data } = await trabajador.recognize(buffer);
  return data.text || '';
}

async function leerImagen(bot, buffer, mime) {
  if (bot.ia?.apiKey) {
    try { return await ia.transcribir(bot, buffer, mime); } catch { /* cae al lector gratuito */ }
  }
  return ocr(buffer);
}

function cumpleRegla(regla, texto) {
  const montos = lista(regla.montos).map(norm), contextos = lista(regla.contextos).map(norm);
  if (!montos.length && !contextos.length) return false;
  const montoOk = !montos.length || montos.some(m => texto.includes(m));
  const hallados = contextos.filter(x => texto.includes(x)).length;
  const minimo = Math.min(contextos.length, Math.max(1, Number(regla.minContexto) || 1));
  return montoOk && hallados >= minimo;
}

function aNumero(s) {
  let t = String(s).replace(/[^\d.,]/g, '');
  const m = t.match(/[.,](\d+)$/);
  if (m && m[1].length <= 2) t = t.slice(0, -m[0].length).replace(/[.,]/g, '') + '.' + m[1];
  else t = t.replace(/[.,]/g, '');
  return Number(t) || 0;
}

function montoDe(regla, texto) {
  if (Number(regla.valor) > 0) return Number(regla.valor);
  const hallado = lista(regla.montos).find(m => texto.includes(norm(m)));
  return hallado ? aNumero(hallado) : 0;
}

async function enviarCapi(bot, c, venta) {
  const px = bot.pixel;
  if (!px?.activo || !px.id || !px.token) return;
  const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const usuario = {};
  if (c.telefono) {
    usuario.ph = [sha(c.telefono)];
    const pais = paisesDe(c.telefono)[0];
    if (pais !== 'XX') usuario.country = [sha(pais.toLowerCase())];
  }
  if (c.nombre) usuario.fn = [sha(norm(c.nombre).split(' ')[0])];
  try {
    const r = await fetch(`https://graph.facebook.com/${VERSION_GRAPH}/${encodeURIComponent(px.id)}/events`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        access_token: px.token,
        data: [{
          event_name: 'Purchase', event_time: Math.floor(venta.ts / 1000), event_id: venta.id, action_source: 'chat',
          user_data: usuario, custom_data: { currency: bot.moneda, value: venta.monto }
        }]
      })
    });
    const j = await r.json().catch(() => ({}));
    venta.meta = r.ok ? 'enviado' : 'error: ' + (j.error?.message || r.status);
  } catch (e) { venta.meta = 'error: ' + e.message; }
  guardar();
}

export async function marcarPagado(bot, c, monto, { regla = null, manual = false } = {}) {
  c.pagado = true; c.compras = (c.compras || 0) + 1; c.totalPagado = (c.totalPagado || 0) + monto;
  c.remarketing = null;
  etiquetar(c, 'Pagado');
  const venta = {
    id: nuevoId('v'), botId: bot.id, jid: c.jid, nombre: c.nombre, telefono: c.telefono, monto, ts: Date.now(),
    anuncio: c.anuncio, manual, salidas: { ...c.salidas }
  };
  db.ventas.push(venta);
  evento({ tipo: 'venta', botId: bot.id, nombre: c.nombre || c.telefono, monto, moneda: bot.moneda });
  guardar(); guardar(bot.id);
  enviarCapi(bot, c, venta);
  if (manual || !regla) return venta;

  await enviarTexto(bot, c, regla.mensaje);
  for (const archivoId of regla.archivos || []) await enviarArchivo(bot, c, archivoId);
  const post = bot.pagos.post;
  // El flujo post-compra (upsell/downsell) solo se lanza con la primera compra, para no repetirlo.
  if (post?.activo && post.flujoId && c.compras === 1 && db.flujos.some(f => f.id === post.flujoId)) {
    iniciarFlujo(bot, c, post.flujoId, aMs(post.minutos, 'm'));
  }
  return venta;
}

// Busca el valor pagado en el texto del comprobante: "S/ 13.00", "$ 15.000", "Monto: 20,50"…
const SIMBOLOS = 'S\\/\\.?|US\\$|R\\$|RD\\$|\\$|USD|COP|PEN|MXN|ARS|CLP|BOB|GTQ|DOP|EUR|Bs\\.?|₡|€';
const NUMERO = '(\\d{1,3}(?:[.,\\s]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
export function detectarMonto(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ');
  const m = t.match(new RegExp(`(?:${SIMBOLOS})\\s?${NUMERO}`, 'i'))
    || t.match(new RegExp(`(?:monto|total|valor|importe|pagaste|enviaste|transferiste)\\s*:?\\s*(?:${SIMBOLOS})?\\s?${NUMERO}`, 'i'));
  return m ? aNumero(m[1]) : 0;
}
// Palabras que suelen salir en capturas de pagos (Yape, Plin, Nequi, bancos…).
const PARECE_PAGO = ['pago exitoso', 'transferencia', 'comprobante', 'enviado a', 'enviaste', 'yape', 'plin', 'nequi', 'daviplata', 'operacion',
  'transaccion', 'pago realizado', 'constancia', 'deposito', 'aprobad', 'bancolombia', 'interbank', 'bcp', 'mercado pago', 'pagaste'];

async function procesarImagen(bot, c, buffer, mime) {
  const p = bot.pagos, hayReglas = Boolean(p.reglas?.length);
  if (hayReglas) await enviarTexto(bot, c, p.msgConfirmacion);
  let texto = '';
  try { texto = await leerImagen(bot, buffer, mime); } catch (e) { console.error('[comprobante]', e.message); }
  const t = norm(texto);
  const detectado = detectarMonto(texto);
  // Sin reglas, solo se transcriben las fotos que parecen un pago (las demás fotos siguen normal).
  if (!hayReglas && !PARECE_PAGO.some(w => t.includes(w))) return false;
  const regla = hayReglas ? p.reglas.find(r => cumpleRegla(r, t)) : null;
  const huella = crypto.createHash('sha1').update(t.replace(/\s+/g, '')).digest('hex');
  const repetido = regla && t.length > 20 && db.comprobantes[huella];
  const monto = regla ? (montoDe(regla, t) || detectado) : detectado;
  // Tarjeta privada en el chat: el cliente nunca la recibe (de: 'sistema' no se envía a WhatsApp ni a la IA).
  agregar(bot.id, c, {
    de: 'sistema', tipo: 'comprobante', texto: texto.trim(), monto, moneda: bot.moneda,
    resultado: repetido ? 'repetido' : regla ? 'valido' : hayReglas ? 'invalido' : 'revisar'
  });
  if (!hayReglas) return false;
  if (!regla || repetido) { await enviarTexto(bot, c, p.msgInvalido); return true; }
  db.comprobantes[huella] = Date.now();
  await marcarPagado(bot, c, monto, { regla });
  return true;
}

// ---------- Mensaje entrante ----------

export async function recibir(botId, m, sesion) {
  const bot = botPorId(botId);
  const jid = m.key?.remoteJid;
  if (!bot || !jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return;
  const cont = contenido(m);
  if (!cont) return;

  if (m.key.fromMe) {
    // Mensaje escrito desde el propio teléfono: solo se anota en el chat.
    if (sesion.enviados.has(m.key.id)) return;
    const c = contactos[botId]?.[jid];
    if (c) agregar(botId, c, { de: 'yo', tipo: cont.tipo, texto: cont.texto });
    return;
  }

  const telefono = telefonoDe(jid, m);
  if (estaBloqueado(bot, telefono)) return;

  const c = contactoDe(botId, jid, m);
  const esNuevo = c.nuevo;
  c.nuevo = false;
  const ad = cont.ctx?.externalAdReply;
  if (ad && !c.anuncio) c.anuncio = { titulo: ad.title || ad.body || 'Anuncio', url: ad.sourceUrl || '', id: ad.sourceId || '' };

  let archivo = null, buffer = null;
  if (cont.tipo !== 'texto') {
    try { buffer = await wa.descargar(botId, m); archivo = guardarMedia(botId, buffer, cont); }
    catch (e) { console.error('[descarga]', e.message); }
  }
  agregar(botId, c, { de: 'cliente', tipo: cont.tipo, texto: cont.texto, archivo, nombre: cont.nombre });
  c.noLeidos = (c.noLeidos || 0) + 1;
  if (c.pausado) return;

  if (cont.tipo === 'imagen' && buffer && await procesarImagen(bot, c, buffer, String(cont.mime || '').split(';')[0])) return;

  const texto = cont.texto;
  if (c.exec?.espera && texto) {
    const flujo = db.flujos.find(f => f.id === c.exec.flujoId);
    const n = flujo && secuencia(flujo, c.exec.ruta)?.[c.exec.espera.i];
    ramificar(bot, c, n && coincide(texto, n.opcionA) ? 'si' : n && coincide(texto, n.opcionB) ? 'no' : 'otros');
    return;
  }

  let atendido = false;
  if (texto) {
    const rapida = (bot.pagos.rapidas || []).find(r => coincide(texto, lista(r.claves)));
    if (rapida) { await enviarTexto(bot, c, rapida.respuesta); atendido = true; }
  }

  if (!c.exec) {
    const existe = d => db.flujos.some(f => f.id === d.flujoId);
    const porClave = texto && bot.disparadores.find(d => d.clave && existe(d) && coincide(texto, [d.clave]));
    const porDefecto = esNuevo && bot.disparadores.find(d => d.default && existe(d));
    const disparador = porClave || porDefecto;
    if (disparador) { iniciarFlujo(bot, c, disparador.flujoId); return; }
  }

  if (!atendido && !c.exec && texto && c.iaActiva && bot.ia?.activo && bot.ia.apiKey) {
    try {
      const respuesta = await ia.responder(bot, c);
      if (respuesta) await enviarTexto(bot, c, respuesta);
    } catch { /* el aviso ya quedó registrado */ }
  }
}
