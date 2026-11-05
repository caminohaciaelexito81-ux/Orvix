// Servidor del panel: API + archivos del panel web.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import { RAIZ, DATOS, db, contactos, guardar, eventos, nuevoId, nuevoBot, botPorId } from './store.js';
import * as wa from './whatsapp.js';
import * as motor from './engine.js';
import { MODELOS } from './ia.js';
import { PAISES } from './paises.js';

const PUERTO = Number(process.env.PORT) || 3900;
const DIA = 86400000;
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network', 'true'); // panel en Vercel + motor en la PC (localhost)
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Promise.resolve().then(...) también atrapa los errores lanzados al instante (si no, salían como "Error interno").
const envolver = fn => (req, res) => Promise.resolve().then(() => fn(req, res)).catch(e => {
  console.error('[api]', req.method, req.path, e.message);
  res.status(e.estado || 500).json({ error: e.message || 'Error interno' });
});
const fallo = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });

// ---------- Acceso ----------

const hashClave = (clave, sal) => crypto.scryptSync(String(clave), sal, 32).toString('hex');
const claveFija = process.env.CLAVE_PANEL || '';
const configurado = () => Boolean(claveFija || db.acceso.hash);
function claveCorrecta(clave) {
  if (claveFija) return String(clave) === claveFija;
  try {
    const a = Buffer.from(hashClave(clave, db.acceso.sal), 'hex'), b = Buffer.from(db.acceso.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
function nuevoToken() {
  const t = crypto.randomBytes(24).toString('hex');
  for (const k in db.acceso.tokens) if (db.acceso.tokens[k] < Date.now()) delete db.acceso.tokens[k];
  db.acceso.tokens[t] = Date.now() + 30 * DIA;
  guardar();
  return t;
}
const tokenValido = t => Boolean(t && db.acceso.tokens[t] > Date.now());

let fallos = 0, bloqueadoHasta = 0;
// En la nube, la primera contraseña solo la puede crear quien tenga el código de instalación
// (lo genera el instalador). Así nadie más se adueña del panel si entra primero.
const codigoInstalacion = process.env.CODIGO_INSTALACION || '';
app.get('/api/estado', (req, res) => res.json({ app: 'xventas', configurado: configurado(), pideCodigo: Boolean(codigoInstalacion) && !configurado() }));
app.post('/api/configurar', envolver((req, res) => {
  if (configurado()) throw fallo(400, 'El panel ya tiene contraseña');
  if (codigoInstalacion && String(req.body.codigo || '').trim() !== codigoInstalacion) {
    if (++fallos >= 5) { fallos = 0; bloqueadoHasta = Date.now() + 60000; }
    throw fallo(401, 'El código de instalación no es correcto');
  }
  if (Date.now() < bloqueadoHasta) throw fallo(429, 'Demasiados intentos. Espera un minuto.');
  const clave = String(req.body.clave || '');
  if (clave.length < 8) throw fallo(400, 'La contraseña debe tener al menos 8 caracteres');
  db.acceso.sal = crypto.randomBytes(16).toString('hex');
  db.acceso.hash = hashClave(clave, db.acceso.sal);
  res.json({ token: nuevoToken() });
}));
app.post('/api/entrar', envolver((req, res) => {
  if (Date.now() < bloqueadoHasta) throw fallo(429, 'Demasiados intentos. Espera un minuto.');
  if (!configurado() || !claveCorrecta(req.body.clave || '')) {
    if (++fallos >= 5) { fallos = 0; bloqueadoHasta = Date.now() + 60000; }
    throw fallo(401, 'Contraseña incorrecta');
  }
  fallos = 0;
  res.json({ token: nuevoToken() });
}));

// Las imágenes y audios se piden con ?t=token porque el navegador no envía cabeceras en <img>.
const protegerArchivo = (req, res, next) => tokenValido(req.query.t) ? next() : res.sendStatus(401);
app.get('/archivo/:id', protegerArchivo, (req, res) => {
  const a = db.archivos.find(x => x.id === req.params.id);
  if (!a) return res.sendStatus(404);
  res.type(a.tipo).sendFile(path.join(DATOS, 'archivos', a.ruta));
});
app.get('/media/:bot/:archivo', protegerArchivo, (req, res) => {
  const destino = path.join(DATOS, 'media', path.basename(req.params.bot), path.basename(req.params.archivo));
  fs.existsSync(destino) ? res.sendFile(destino) : res.sendStatus(404);
});

app.use('/api', (req, res, next) => {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  tokenValido(t) ? next() : res.status(401).json({ error: 'Sesión vencida. Vuelve a entrar.' });
});

// ---------- Bots ----------

const OCULTO = '••••••••';
const ocultar = v => v ? OCULTO + String(v).slice(-4) : '';
function botPublico(b) {
  return {
    ...b, conexion: wa.estado(b.id),
    pixel: { ...b.pixel, token: ocultar(b.pixel.token) },
    ia: { ...b.ia, apiKey: ocultar(b.ia.apiKey) }
  };
}
function botDe(req) {
  const b = botPorId(req.params.id);
  if (!b) throw fallo(404, 'Ese bot no existe');
  return b;
}

app.get('/api/bots', (req, res) => res.json(db.bots.map(botPublico)));
app.post('/api/bots', envolver((req, res) => {
  const b = nuevoBot(String(req.body.nombre || '').trim());
  db.bots.push(b); contactos[b.id] = {}; guardar();
  res.json(botPublico(b));
}));
app.patch('/api/bots/:id', envolver((req, res) => {
  const b = botDe(req), c = req.body;
  for (const k of ['nombre', 'moneda', 'zona', 'disparadores', 'pagos', 'paisesBloqueados']) if (c[k] !== undefined) b[k] = c[k];
  if (c.pixel) b.pixel = { ...b.pixel, ...c.pixel, token: String(c.pixel.token ?? '').startsWith(OCULTO) ? b.pixel.token : (c.pixel.token ?? b.pixel.token) };
  if (c.ia) b.ia = { ...b.ia, ...c.ia, apiKey: String(c.ia.apiKey ?? '').startsWith(OCULTO) ? b.ia.apiKey : (c.ia.apiKey ?? b.ia.apiKey) };
  guardar();
  res.json(botPublico(b));
}));
app.delete('/api/bots/:id', envolver(async (req, res) => {
  const b = botDe(req);
  await wa.desvincular(b.id);
  db.bots = db.bots.filter(x => x.id !== b.id);
  db.flujos = db.flujos.filter(f => f.botId !== b.id);
  db.ventas = db.ventas.filter(v => v.botId !== b.id);
  delete contactos[b.id];
  fs.rmSync(path.join(DATOS, `contactos-${b.id}.json`), { force: true });
  fs.rmSync(path.join(DATOS, 'media', b.id), { recursive: true, force: true });
  guardar();
  res.json({ ok: true });
}));

// Copia nodos dándoles identificadores nuevos (para duplicar flujos y clonar bots).
function copiarNodos(nodos) {
  return (nodos || []).map(n => {
    const c = { ...n, id: nuevoId('n') };
    if (n.ramas) c.ramas = Object.fromEntries(Object.entries(n.ramas).map(([k, v]) => [k, copiarNodos(v)]));
    if (n.salidas) c.salidas = n.salidas.map(s => ({ ...s, id: nuevoId('s'), nodos: copiarNodos(s.nodos) }));
    if (n.pasos) c.pasos = n.pasos.map(p => ({ ...p }));
    if (n.opcionA) { c.opcionA = [...n.opcionA]; c.opcionB = [...(n.opcionB || [])]; c.espera = { ...n.espera }; }
    return c;
  });
}
app.post('/api/bots/:id/clonar', envolver((req, res) => {
  const origen = botDe(req);
  const b = { ...structuredClone(origen), id: nuevoId('b'), nombre: origen.nombre + ' (copia)', creado: Date.now(), activo: false, numero: null };
  const mapa = {};
  for (const f of db.flujos.filter(f => f.botId === origen.id)) {
    const copia = { ...f, id: nuevoId('f'), botId: b.id, nodos: copiarNodos(f.nodos) };
    mapa[f.id] = copia.id;
    db.flujos.push(copia);
  }
  b.disparadores = b.disparadores.map(d => ({ ...d, id: nuevoId('d'), flujoId: mapa[d.flujoId] || '' }));
  b.pagos.post.flujoId = mapa[b.pagos.post.flujoId] || '';
  db.bots.push(b); contactos[b.id] = {}; guardar();
  res.json(botPublico(b));
}));

app.get('/api/bots/:id/conexion', envolver((req, res) => res.json(wa.estado(botDe(req).id))));
app.post('/api/bots/:id/iniciar', envolver(async (req, res) => {
  const b = botDe(req);
  wa.detener(b.id);
  b.activo = true; guardar();
  await wa.iniciar(b.id, { modo: req.body.modo === 'codigo' ? 'codigo' : 'qr', telefono: req.body.telefono });
  res.json(wa.estado(b.id));
}));
app.post('/api/bots/:id/detener', envolver((req, res) => { const b = botDe(req); wa.detener(b.id); res.json(wa.estado(b.id)); }));
app.post('/api/bots/:id/desvincular', envolver(async (req, res) => { const b = botDe(req); await wa.desvincular(b.id); res.json(wa.estado(b.id)); }));

// ---------- Flujos ----------

function contarNodos(nodos) {
  let n = 0;
  for (const x of nodos || []) {
    n++;
    if (x.ramas) for (const k in x.ramas) n += contarNodos(x.ramas[k]);
    if (x.salidas) for (const s of x.salidas) n += contarNodos(s.nodos);
  }
  return n;
}
function distribuidoresDe(nodos, salida = []) {
  for (const x of nodos || []) {
    if (x.tipo === 'distribuidor') salida.push(x);
    if (x.ramas) for (const k in x.ramas) distribuidoresDe(x.ramas[k], salida);
    if (x.salidas) for (const s of x.salidas) distribuidoresDe(s.nodos, salida);
  }
  return salida;
}
function flujoDe(req) {
  const f = db.flujos.find(x => x.id === req.params.fid);
  if (!f) throw fallo(404, 'Ese flujo no existe');
  return f;
}
app.get('/api/bots/:id/flujos', envolver((req, res) => {
  const b = botDe(req);
  res.json(db.flujos.filter(f => f.botId === b.id).map(f => ({ id: f.id, nombre: f.nombre, nodos: contarNodos(f.nodos), actualizado: f.actualizado })));
}));
app.post('/api/bots/:id/flujos', envolver((req, res) => {
  const b = botDe(req);
  const f = { id: nuevoId('f'), botId: b.id, nombre: String(req.body.nombre || 'Flujo nuevo').trim(), nodos: [], actualizado: Date.now() };
  db.flujos.push(f); guardar();
  res.json(f);
}));
app.get('/api/flujos/:fid', envolver((req, res) => {
  const f = flujoDe(req);
  const leads = {};
  for (const d of distribuidoresDe(f.nodos)) Object.assign(leads, db.distrib[d.id]?.leads);
  res.json({ ...f, leads });
}));
app.put('/api/flujos/:fid', envolver((req, res) => {
  const f = flujoDe(req);
  if (req.body.nombre !== undefined) f.nombre = String(req.body.nombre).trim() || f.nombre;
  if (Array.isArray(req.body.nodos)) f.nodos = req.body.nodos;
  f.actualizado = Date.now(); guardar();
  res.json({ ok: true });
}));
app.post('/api/flujos/:fid/duplicar', envolver((req, res) => {
  const f = flujoDe(req);
  const copia = { ...f, id: nuevoId('f'), nombre: f.nombre + ' (copia)', nodos: copiarNodos(f.nodos), actualizado: Date.now() };
  db.flujos.push(copia); guardar();
  res.json(copia);
}));
app.delete('/api/flujos/:fid', envolver((req, res) => {
  const f = flujoDe(req);
  db.flujos = db.flujos.filter(x => x.id !== f.id); guardar();
  res.json({ ok: true });
}));

// ---------- Archivos ----------

const subida = multer({
  storage: multer.diskStorage({
    destination: path.join(DATOS, 'archivos'),
    filename: (req, file, cb) => cb(null, nuevoId('a') + path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8))
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});
app.get('/api/archivos', (req, res) => res.json(db.archivos));
app.post('/api/archivos', subida.array('archivos', 20), envolver((req, res) => {
  const nuevos = (req.files || []).map(f => ({
    id: path.parse(f.filename).name, nombre: Buffer.from(f.originalname, 'latin1').toString('utf8'),
    tipo: f.mimetype, tam: f.size, ruta: f.filename, creado: Date.now()
  }));
  db.archivos.push(...nuevos); guardar();
  res.json(nuevos);
}));
app.patch('/api/archivos/:aid', envolver((req, res) => {
  const a = db.archivos.find(x => x.id === req.params.aid);
  if (!a) throw fallo(404, 'Ese archivo no existe');
  a.nombre = String(req.body.nombre || '').trim() || a.nombre; guardar();
  res.json(a);
}));
app.delete('/api/archivos/:aid', envolver((req, res) => {
  const a = db.archivos.find(x => x.id === req.params.aid);
  if (a) { fs.rmSync(path.join(DATOS, 'archivos', a.ruta), { force: true }); db.archivos = db.archivos.filter(x => x !== a); guardar(); }
  res.json({ ok: true });
}));

// ---------- Chat en vivo ----------

function chatDe(req) {
  const b = botDe(req);
  const c = contactos[b.id]?.[req.params.jid];
  if (!c) throw fallo(404, 'Esa conversación no existe');
  return { b, c };
}
app.get('/api/bots/:id/chats', envolver((req, res) => {
  const b = botDe(req);
  const filas = Object.values(contactos[b.id] || {}).map(c => {
    // La tarjeta privada del comprobante no cuenta como "último mensaje" de la conversación.
    const u = c.mensajes.findLast(m => m.de !== 'sistema');
    return {
      jid: c.jid, nombre: c.nombre, telefono: c.telefono, ultimo: c.ultimo, creado: c.creado, pagado: c.pagado, noLeidos: c.noLeidos || 0,
      etiquetas: c.etiquetas, pausado: c.pausado, enFlujo: Boolean(c.exec), ultimoDe: u?.de, ultimoTipo: u?.tipo,
      // "Pendiente" = mandó un comprobante que todavía no se aprobó; "Sin registro" = nunca mandó uno.
      envioComprobante: c.mensajes.some(m => m.tipo === 'comprobante' || (m.de === 'sistema' && String(m.texto).startsWith('🧾'))),
      vista: u ? (u.texto || `[${u.tipo}]`).slice(0, 70) : ''
    };
  }).sort((a, z) => z.ultimo - a.ultimo);
  res.json(filas);
}));
app.get('/api/bots/:id/chats/:jid', envolver((req, res) => {
  const { b, c } = chatDe(req);
  if (c.noLeidos) { c.noLeidos = 0; guardar(b.id); }
  const flujo = c.exec && db.flujos.find(f => f.id === c.exec.flujoId);
  res.json({ ...c, exec: undefined, remarketing: undefined, enFlujo: flujo?.nombre || null, conRemarketing: Boolean(c.remarketing) });
}));
app.post('/api/bots/:id/chats/:jid/enviar', envolver(async (req, res) => {
  const { b, c } = chatDe(req);
  if (req.body.archivoId) await motor.enviarArchivo(b, c, req.body.archivoId, req.body.texto || '', 'yo');
  else await motor.enviarTexto(b, c, req.body.texto, 'yo');
  res.json({ ok: true });
}));
app.post('/api/bots/:id/chats/:jid/flujo', envolver((req, res) => {
  const { b, c } = chatDe(req);
  if (!db.flujos.some(f => f.id === req.body.flujoId)) throw fallo(404, 'Ese flujo no existe');
  c.pausado = false;
  motor.iniciarFlujo(b, c, req.body.flujoId);
  res.json({ ok: true });
}));
app.post('/api/bots/:id/chats/:jid/pausa', envolver((req, res) => {
  const { b, c } = chatDe(req);
  c.pausado = Boolean(req.body.pausado);
  if (c.pausado) { c.exec = null; c.remarketing = null; }
  guardar(b.id);
  res.json({ ok: true });
}));
app.post('/api/bots/:id/chats/:jid/ia', envolver((req, res) => {
  const { b, c } = chatDe(req);
  c.iaActiva = Boolean(req.body.activa); guardar(b.id);
  res.json({ ok: true });
}));
app.post('/api/bots/:id/chats/:jid/pagado', envolver(async (req, res) => {
  const { b, c } = chatDe(req);
  const monto = Number(req.body.monto);
  if (!(monto > 0)) throw fallo(400, 'Escribe el valor que pagó');
  await motor.marcarPagado(b, c, monto, { manual: true });
  res.json({ ok: true });
}));
app.delete('/api/bots/:id/chats/:jid', envolver((req, res) => {
  const { b, c } = chatDe(req);
  delete contactos[b.id][c.jid]; guardar(b.id);
  res.json({ ok: true });
}));

// ---------- Métricas ----------

const formatos = {};
function partes(ts, zona) {
  let f = formatos[zona];
  if (!f) {
    try { f = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' }); }
    catch { f = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' }); }
    formatos[zona] = f;
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, mes: `${p.year}-${p.month}`, hora: Number(p.hour) % 24, semana: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
function botsPedidos(req) {
  const ids = String(req.query.bots || '').split(',').filter(Boolean);
  return db.bots.filter(b => ids.includes(b.id));
}

app.get('/api/metricas', envolver((req, res) => {
  const bots = botsPedidos(req);
  const ids = bots.map(b => b.id);
  const zona = bots[0]?.zona || 'America/Bogota';
  const desde = Number(req.query.desde) || 0, hasta = Number(req.query.hasta) || Date.now();
  const enRango = ts => ts >= desde && ts <= hasta;
  const todos = ids.flatMap(id => Object.values(contactos[id] || {}));
  const botDe = new Map(ids.flatMap(id => Object.values(contactos[id] || {}).map(c => [c, id])));
  const ventasTodas = db.ventas.filter(v => ids.includes(v.botId));
  const cs =todos.filter(c => enRango(c.creado));
  const vs = ventasTodas.filter(v => enRango(v.ts));
  const suma = l => l.reduce((a, v) => a + v.monto, 0);

  const compradores = new Set(vs.map(v => v.botId + v.jid));
  const comprasPorCliente = {};
  for (const v of ventasTodas) comprasPorCliente[v.botId + v.jid] = (comprasPorCliente[v.botId + v.jid] || 0) + 1;
  const repiten = [...compradores].filter(k => comprasPorCliente[k] > 1).length;

  const ingresosDiarios = {}, contactosDiarios = {}, ingresosMensuales = {}, anuncios = {};
  const porHora = Array.from({ length: 24 }, () => ({ contactos: 0, ventas: 0, monto: 0 }));
  const porDia = Array.from({ length: 7 }, () => ({ contactos: 0, ventas: 0, monto: 0 }));
  for (const c of cs) {
    const p = partes(c.creado, zona);
    contactosDiarios[p.dia] = (contactosDiarios[p.dia] || 0) + 1;
    porHora[p.hora].contactos++; porDia[p.semana].contactos++;
  }
  for (const v of vs) {
    const p = partes(v.ts, zona);
    ingresosDiarios[p.dia] = (ingresosDiarios[p.dia] || 0) + v.monto;
    porHora[p.hora].ventas++; porHora[p.hora].monto += v.monto;
    porDia[p.semana].ventas++; porDia[p.semana].monto += v.monto;
    const titulo = v.anuncio?.titulo || 'Sin anuncio (orgánico)';
    const a = (anuncios[titulo] ||= { titulo, url: v.anuncio?.url || '', ventas: 0, monto: 0 });
    a.ventas++; a.monto += v.monto;
  }
  for (const v of ventasTodas) { const p = partes(v.ts, zona); ingresosMensuales[p.mes] = (ingresosMensuales[p.mes] || 0) + v.monto; }

  const largo = hasta - (desde || (ventasTodas[0]?.ts ?? hasta));
  const antes = ts => desde && ts >= desde - largo && ts < desde;
  const vAntes = ventasTodas.filter(v => antes(v.ts));
  const anterior = { ingresos: suma(vAntes), compradores: new Set(vAntes.map(v => v.botId + v.jid)).size, contactos: todos.filter(c => antes(c.creado)).length };

  const distribuidores = [];
  for (const f of db.flujos.filter(f => ids.includes(f.botId))) {
    for (const d of distribuidoresDe(f.nodos)) {
      distribuidores.push({
        flujo: f.nombre,
        salidas: d.salidas.map(s => {
          const ventas = ventasTodas.filter(v => v.salidas?.[d.id] === s.id);
          const leads = db.distrib[d.id]?.leads?.[s.id] || 0;
          return { nombre: s.nombre, leads, ventas: ventas.length, monto: suma(ventas), conversion: leads ? ventas.length / leads * 100 : 0 };
        })
      });
    }
  }
  const etiquetas = {};
  for (const c of todos) for (const e of c.etiquetas) etiquetas[e] = (etiquetas[e] || 0) + 1;

  // Compradores por día (en el período) y contactos/compradores por mes (todo el historial) para el Dashboard.
  const compradoresDiarios = {}, contactosMensuales = {}, compradoresMensuales = {};
  const unicos = (mapa, clave, quien) => { (mapa[clave] ||= new Set()).add(quien); };
  for (const v of vs) unicos(compradoresDiarios, partes(v.ts, zona).dia, v.botId + v.jid);
  for (const c of todos) { const m = partes(c.creado, zona).mes; contactosMensuales[m] = (contactosMensuales[m] || 0) + 1; }
  for (const v of ventasTodas) unicos(compradoresMensuales, partes(v.ts, zona).mes, v.botId + v.jid);
  const contar = mapa => Object.fromEntries(Object.entries(mapa).map(([k, s]) => [k, s.size]));

  // Comparativo: mes calendario actual contra el anterior (en la zona del bot), sin importar el período elegido.
  const mesActual = partes(Date.now(), zona).mes;
  const [an, me] = mesActual.split('-').map(Number);
  const mesPrevio = me === 1 ? `${an - 1}-12` : `${an}-${String(me - 1).padStart(2, '0')}`;
  const resumenMes = mes => {
    const delMes = ts => partes(ts, zona).mes === mes;
    const hastaMes = ts => partes(ts, zona).mes <= mes;
    const v = ventasTodas.filter(x => delMes(x.ts)), c = todos.filter(x => delMes(x.creado));
    const comp = new Set(v.map(x => x.botId + x.jid));
    const compras = {};
    for (const x of ventasTodas.filter(y => hastaMes(y.ts))) compras[x.botId + x.jid] = (compras[x.botId + x.jid] || 0) + 1;
    const leads = todos.filter(x => hastaMes(x.creado));
    const pagaron = new Set(ventasTodas.filter(x => hastaMes(x.ts)).map(x => x.botId + x.jid));
    const pagoAlguno = x => pagaron.has(botDe.get(x) + x.jid) || (mes === mesActual && x.pagado);
    return {
      ingresos: suma(v), compradores: comp.size, contactos: c.length,
      ticket: comp.size ? suma(v) / comp.size : null,
      conversion: c.length ? Math.min(100, comp.size / c.length * 100) : 0,
      repeticion: comp.size ? [...comp].filter(k => compras[k] > 1).length / comp.size * 100 : 0,
      transacciones: v.length, leads: leads.length, compradoresTotal: pagaron.size,
      pendientes: leads.filter(x => !pagoAlguno(x)).length
    };
  };
  const tieneDatosAntes = [...ventasTodas.map(v => v.ts), ...todos.map(c => c.creado)].some(ts => partes(ts, zona).mes <= mesPrevio);
  const comparativo = { actual: resumenMes(mesActual), anterior: tieneDatosAntes ? resumenMes(mesPrevio) : null };

  res.json({
    moneda: bots[0]?.moneda || 'USD', zona,
    compradores: compradores.size, facturado: suma(vs), transacciones: vs.length, contactos: cs.length,
    ticket: compradores.size ? suma(vs) / compradores.size : 0,
    conversion: cs.length ? Math.min(100, compradores.size / cs.length * 100) : 0,
    ingresosTotales: suma(ventasTodas),
    repeticion: compradores.size ? repiten / compradores.size * 100 : 0,
    embudo: { contactos: cs.length, pendientes: cs.filter(c => !c.pagado).length, compradores: compradores.size },
    ingresosDiarios, contactosDiarios, ingresosMensuales, porHora, porDia, anterior,
    anuncios: Object.values(anuncios).sort((a, z) => z.monto - a.monto).slice(0, 10),
    historial: vs.slice(-5000).reverse().map(v => ({ bot: botPorId(v.botId)?.nombre || '', moneda: botPorId(v.botId)?.moneda || 'USD', nombre: v.nombre, telefono: v.telefono, ts: v.ts, monto: v.monto, anuncio: v.anuncio, manual: v.manual, meta: v.meta })),
    distribuidores, etiquetas,
    compradoresDiarios: contar(compradoresDiarios), contactosMensuales, compradoresMensuales: contar(compradoresMensuales), comparativo
  });
}));

app.get('/api/reporte', envolver((req, res) => {
  const ids = botsPedidos(req).map(b => b.id);
  const desde = Number(req.query.desde) || 0, hasta = Number(req.query.hasta) || Date.now();
  const filas = ids.flatMap(id => Object.values(contactos[id] || {}).filter(c => c.creado >= desde && c.creado <= hasta).map(c => ({
    bot: botPorId(id).nombre, nombre: c.nombre, telefono: c.telefono, creado: c.creado, ultimo: c.ultimo, pagado: c.pagado,
    compras: c.compras || 0, total: c.totalPagado || 0, etiquetas: c.etiquetas, anuncio: c.anuncio?.titulo || ''
  })));
  res.json(filas.sort((a, z) => z.creado - a.creado));
}));

app.get('/api/eventos', (req, res) => res.json(eventos.filter(e => e.ts > (Number(req.query.desde) || 0))));
app.get('/api/opciones', (req, res) => res.json({ paises: PAISES.map(([iso, nombre, , region]) => ({ iso, nombre, region })), modelos: MODELOS }));

app.use(express.static(path.join(RAIZ, 'web')));
app.use((err, req, res, next) => {
  const grande = err?.code === 'LIMIT_FILE_SIZE';
  res.status(grande ? 413 : 500).json({ error: grande ? 'El archivo supera los 50 MB' : 'Error interno' });
});

wa.alRecibir(motor.recibir);
motor.arrancarMotor();
for (const b of db.bots) {
  if (b.activo && fs.existsSync(path.join(DATOS, 'sesiones', b.id, 'creds.json'))) {
    wa.iniciar(b.id).catch(e => console.error('[whatsapp]', b.nombre, e.message));
  }
}
// En la nube escucha solo dentro del servidor (Caddy pone el candado https delante).
const HOST = process.env.HOST || undefined;
app.listen(PUERTO, HOST, () => console.log(`\n  ORVIX QR listo. Abre el panel en:  http://localhost:${PUERTO}\n`));
