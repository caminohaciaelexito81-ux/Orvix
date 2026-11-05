// Conexión de cada bot con WhatsApp (por QR o por código), usando Baileys.
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import QRCode from 'qrcode';
import { DATOS, botPorId, guardar } from './store.js';

const mod = await import('@whiskeysockets/baileys');
const B = mod.useMultiFileAuthState ? mod : mod.default;
const makeWASocket = B.makeWASocket || (typeof B.default === 'function' ? B.default : mod.default);

const logger = pino({ level: 'silent' });
const sesiones = new Map();
const dormir = ms => new Promise(r => setTimeout(r, ms));
const dirSesion = id => path.join(DATOS, 'sesiones', id);

let alMensaje = async () => {};
export const alRecibir = fn => { alMensaje = fn; };

export function estado(botId) {
  const s = sesiones.get(botId);
  return { estado: s?.estado || 'desconectado', qr: s?.qr || null, codigo: s?.codigo || null, numero: s?.numero || botPorId(botId)?.numero || null, error: s?.error || null };
}
export const conectado = botId => sesiones.get(botId)?.estado === 'conectado';

export async function iniciar(botId, opc = {}) {
  const previa = sesiones.get(botId);
  if (previa?.sock && previa.estado !== 'desconectado') return;
  const s = { estado: 'iniciando', quiere: true, opc, enviados: new Set(), intentos: previa?.intentos || 0 };
  sesiones.set(botId, s);

  const { state, saveCreds } = await B.useMultiFileAuthState(dirSesion(botId));
  let version;
  try { ({ version } = await B.fetchLatestBaileysVersion()); } catch { /* usa la versión incluida */ }
  const sock = makeWASocket({
    auth: state, version, logger, browser: B.Browsers.ubuntu('Chrome'),
    printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false, generateHighQualityLinkPreview: false
  });
  s.sock = sock;
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async u => {
    if (sesiones.get(botId) !== s) return;
    if (u.qr) {
      if (opc.modo === 'codigo' && opc.telefono) {
        if (!s.codigo) {
          try { s.codigo = await sock.requestPairingCode(String(opc.telefono).replace(/\D/g, '')); s.estado = 'codigo'; }
          catch { s.error = 'No se pudo generar el código. Revisa el número (con indicativo del país) e inténtalo de nuevo.'; }
        }
      } else {
        s.qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 });
        s.estado = 'qr';
      }
    }
    if (u.connection === 'open') {
      s.estado = 'conectado'; s.qr = null; s.codigo = null; s.error = null; s.intentos = 0;
      s.numero = (sock.user?.id || '').split(':')[0].split('@')[0];
      const bot = botPorId(botId);
      if (bot) { bot.numero = s.numero; bot.activo = true; guardar(); }
      console.log(`[whatsapp] ${bot?.nombre || botId} conectado (${s.numero})`);
    }
    if (u.connection === 'close') {
      const codigo = u.lastDisconnect?.error?.output?.statusCode;
      s.estado = 'desconectado'; s.sock = null; s.qr = null; s.codigo = null;
      if (codigo === B.DisconnectReason.loggedOut) {
        fs.rmSync(dirSesion(botId), { recursive: true, force: true });
        const bot = botPorId(botId);
        if (bot) { bot.activo = false; bot.numero = null; guardar(); }
        s.quiere = false; s.numero = null;
      } else if (s.quiere) {
        s.intentos++;
        setTimeout(() => {
          if (sesiones.get(botId) === s && s.quiere) iniciar(botId, opc).catch(e => console.error('[whatsapp] reconexión', e.message));
        }, Math.min(30000, 2000 * s.intentos));
      }
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) Promise.resolve(alMensaje(botId, m, s)).catch(e => console.error('[mensaje]', e));
  });
}

export function detener(botId) {
  const s = sesiones.get(botId);
  const bot = botPorId(botId);
  if (bot) { bot.activo = false; guardar(); }
  if (!s) return;
  s.quiere = false;
  try { s.sock?.end(undefined); } catch { /* ya estaba cerrado */ }
  s.estado = 'desconectado'; s.sock = null; s.qr = null; s.codigo = null;
}

export async function desvincular(botId) {
  const s = sesiones.get(botId);
  if (s) s.quiere = false;
  try { await s?.sock?.logout(); } catch { /* sin conexión */ }
  sesiones.delete(botId);
  fs.rmSync(dirSesion(botId), { recursive: true, force: true });
  const bot = botPorId(botId);
  if (bot) { bot.activo = false; bot.numero = null; guardar(); }
}

export async function enviar(botId, jid, contenido) {
  const s = sesiones.get(botId);
  if (!s?.sock || s.estado !== 'conectado') throw new Error('El bot no está conectado a WhatsApp');
  const r = await s.sock.sendMessage(jid, contenido);
  if (r?.key?.id) {
    if (s.enviados.size > 5000) s.enviados.clear();
    s.enviados.add(r.key.id);
  }
  return r;
}

// Muestra "escribiendo..." un momento para que el envío se vea humano.
export async function escribiendo(botId, jid, ms) {
  const sock = sesiones.get(botId)?.sock;
  if (!sock) return;
  try {
    await sock.sendPresenceUpdate('composing', jid);
    await dormir(ms);
    await sock.sendPresenceUpdate('paused', jid);
  } catch { /* la presencia es opcional */ }
}

export function descargar(botId, m) {
  const sock = sesiones.get(botId)?.sock;
  return B.downloadMediaMessage(m, 'buffer', {}, { logger, reuploadRequest: sock?.updateMediaMessage });
}
