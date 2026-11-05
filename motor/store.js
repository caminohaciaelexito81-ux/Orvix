// Guardado de datos en archivos JSON dentro de la carpeta "datos".
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(aqui, '..');
export const DATOS = process.env.DATOS_DIR ? path.resolve(process.env.DATOS_DIR) : path.join(RAIZ, 'datos');
for (const d of ['', 'archivos', 'media', 'sesiones']) fs.mkdirSync(path.join(DATOS, d), { recursive: true });

export const nuevoId = (p = '') => p + crypto.randomBytes(6).toString('hex');

function leer(archivo, def) {
  try { return JSON.parse(fs.readFileSync(path.join(DATOS, archivo), 'utf8')); } catch { return def; }
}
function escribir(archivo, obj) {
  const destino = path.join(DATOS, archivo);
  fs.writeFileSync(destino + '.tmp', JSON.stringify(obj));
  fs.renameSync(destino + '.tmp', destino);
}

export const db = Object.assign(
  { acceso: { tokens: {} }, bots: [], flujos: [], archivos: [], ventas: [], comprobantes: {}, distrib: {} },
  leer('db.json', {})
);
db.acceso.tokens ||= {};

// contactos[botId][jid] = contacto (con sus mensajes)
export const contactos = {};
for (const b of db.bots) contactos[b.id] = leer(`contactos-${b.id}.json`, {});

const pendientes = new Set();
let temporizador = null;
export function guardar(botId) {
  pendientes.add(botId || 'db');
  if (!temporizador) temporizador = setTimeout(volcar, 800);
}
export function volcar() {
  temporizador = null;
  for (const p of pendientes) {
    try {
      if (p === 'db') escribir('db.json', db);
      else if (contactos[p]) escribir(`contactos-${p}.json`, contactos[p]);
    } catch (e) { console.error('[guardar]', e.message); }
  }
  pendientes.clear();
}
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { volcar(); process.exit(0); });

// Avisos recientes para el panel (ventas, errores). Solo en memoria.
export const eventos = [];
export function evento(e) {
  eventos.push({ ts: Date.now(), ...e });
  if (eventos.length > 200) eventos.shift();
}

export function nuevoBot(nombre) {
  return {
    id: nuevoId('b'), nombre: nombre || 'Mi bot', creado: Date.now(), activo: false, numero: null,
    moneda: 'USD', zona: 'America/Bogota',
    pixel: { id: '', token: '', activo: false },
    disparadores: [],
    pagos: {
      msgConfirmacion: '¡Perfecto! Acabo de ver tu comprobante. Dame un momento mientras lo valido 🙌',
      msgInvalido: 'Lo siento, no pude validar ese comprobante. ¿Me envías la captura completa del pago, por favor?',
      reglas: [], rapidas: [],
      post: { activo: false, flujoId: '', minutos: 0 }
    },
    paisesBloqueados: [],
    ia: { activo: false, apiKey: '', modelo: 'claude-opus-5-5', instrucciones: '' }
  };
}

export const botPorId = id => db.bots.find(b => b.id === id);
