// Núcleo del panel: ayudas, conexión con el motor, entrada y navegación.
const X = {
  base: '', token: '', bots: [], botId: '', archivos: [], opciones: { paises: [], modelos: [] },
  vistas: {}, alSalir: null, ultimoEvento: Date.now()
};
const guardado = {
  leer: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  poner: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* sin almacenamiento */ } }
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const idCorto = p => p + Math.random().toString(36).slice(2, 10);

// Iconos de línea (estilo Lucide, el mismo que usan Base44 y la mayoría de paneles modernos).
const ICONOS = {
  capas: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  linea: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  enchufe: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  chats: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  barras: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16h8"/><path d="M7 11h12"/><path d="M7 6h3"/>',
  imagenes: '<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/>',
  red: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
  rayo: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  tarjeta: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  prohibido: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  bot: '<circle cx="12" cy="3.2" r="1.4" fill="currentColor"/><path d="M12 4.6V7"/><rect x="4" y="7" width="16" height="13" rx="4.5"/><circle cx="9" cy="12.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="12.6" r="1.5" fill="currentColor" stroke="none"/><path d="M9.6 16.3c1.4.9 3.4.9 4.8 0"/><path d="M2 12v4"/><path d="M22 12v4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  filtros: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  instagram: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  externo: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  bandera: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  agarre: '<circle cx="9" cy="5" r="1.4" fill="currentColor"/><circle cx="9" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="19" r="1.4" fill="currentColor"/><circle cx="15" cy="5" r="1.4" fill="currentColor"/><circle cx="15" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="19" r="1.4" fill="currentColor"/>',
  reloj2: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  ramaGit: '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  bombilla: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  cadena: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  carrito: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  porcentaje: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  embudo: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  tabla: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  monedas: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  hucha: '<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/>',
  ordenar: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  usuario: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  reproducir: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
  usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  dinero: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  etiqueta: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  sube: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  mensaje: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  billetera: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  repetir: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  recibo: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  enviar: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  pausa: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  basura: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  texto: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  imagen: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  dividir: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>',
  mezclar: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  megafono: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  copiar: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  arriba: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  abajo: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  guardar: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  nube: '<path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/>',
  mundo: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  llave: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  cohete: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  pulso: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  escudo: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  campana: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  detener: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
  desvincular: '<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/>',
  mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  lapiz: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  ojo: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  documento: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  musica: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  estrella: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  estrellaLlena: '<polygon fill="currentColor" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  atras: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCirculo: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  xCirculo: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  pregunta: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  calendario: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  flecha: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  carpeta: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  portapapeles: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  cargando: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  respuesta: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  engranaje: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
};
// Robot relleno a color (cabeza turquesa, ojos que brillan) para la barra y las tarjetas de bots.
X.robot = (tam = 22) => `<svg class="ic robot" width="${tam}" height="${tam}" viewBox="0 0 24 24" aria-hidden="true">
  <defs><linearGradient id="rb-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs>
  <path d="M12 2.6v4" stroke="#0d9488" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="2.6" r="1.8" fill="#f59e0b"/>
  <rect x="1" y="11" width="2.6" height="5" rx="1.3" fill="#0d9488"/><rect x="20.4" y="11" width="2.6" height="5" rx="1.3" fill="#0d9488"/>
  <rect x="3" y="6.5" width="18" height="15" rx="5" fill="url(#rb-g)"/>
  <rect x="5.5" y="9.3" width="13" height="7.6" rx="3.6" fill="#0f1b2d"/>
  <circle cx="9.2" cy="13.1" r="1.7" fill="#5eead4"/><circle cx="14.8" cy="13.1" r="1.7" fill="#5eead4"/>
  <circle cx="9.7" cy="12.5" r=".55" fill="#fff"/><circle cx="15.3" cy="12.5" r=".55" fill="#fff"/>
  <path d="M10 19c1.2.7 2.8.7 4 0" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>`;
X.ic = (nombre, tam = 18) => `<svg class="ic" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;

// Bloques de página con la misma estructura en todo el panel:
// sección con cabecera (icono, título, subtítulo), etiquetas de campo con icono, pistas con (i) y consejos.
X.seccion = (icono, titulo, sub, cuerpo, extra = '') => `<section class="seccion"><header><span class="sec-ic">${X.ic(icono, 20)}</span><div class="crece"><h3>${titulo}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${extra}</header><div class="sec-cuerpo">${cuerpo}</div></section>`;
X.etiqueta = (icono, texto, color = '') => `<span class="etq"><span class="etq-ic ${color}">${X.ic(icono, 14)}</span>${texto}</span>`;
X.pista = texto => `<p class="pista">${X.ic('info', 13)}<span>${texto}</span></p>`;
X.consejo = texto => `<div class="consejo">${X.ic('bombilla', 17)}<span>${texto}</span></div>`;
X.intro = texto => `<p class="intro">${texto}</p>`;
// Campo completo: etiqueta con icono + control + pista opcional.
X.campo = (icono, texto, control, pista = '', color = '') => `<label class="campo2">${X.etiqueta(icono, texto, color)}${control}${pista ? X.pista(pista) : ''}</label>`;
X.cajaLista = (titulo, contenido, vacio) => `<div class="caja-lista"><h4>${X.ic('menu', 15)} ${titulo}</h4>${contenido || `<p class="lista-vacia">${vacio}</p>`}</div>`;

X.dinero = (n, moneda) => {
  try { return new Intl.NumberFormat('es', { style: 'currency', currency: moneda || X.bot()?.moneda || 'USD', maximumFractionDigits: 2 }).format(n || 0); }
  catch { return (n || 0).toFixed(2); }
};
// Símbolo corto de cada moneda ("S/ 13,00", "$ 15.000", "Bs 20").
const SIMBOLOS = { PEN: 'S/', COP: '$', USD: '$', MXN: '$', ARS: '$', CLP: '$', UYU: '$', BOB: 'Bs', VES: 'Bs.', GTQ: 'Q', DOP: 'RD$', CRC: '₡', PYG: '₲', BRL: 'R$', EUR: '€' };
X.simbolo = moneda => SIMBOLOS[moneda || X.bot()?.moneda || 'USD'] || (moneda || '$');
X.dineroSimbolo = (n, moneda, { decimales, compacto } = {}) => {
  const v = Number(n) || 0;
  const dec = decimales ?? (v % 1 ? 2 : 0);
  const num = new Intl.NumberFormat('es', compacto && Math.abs(v) >= 10000 ? { notation: 'compact', maximumFractionDigits: 1 } : { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
  return `${X.simbolo(moneda)} ${num}`;
};
X.fecha = ts => new Date(ts).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
X.hora = ts => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
X.cuando = ts => (Date.now() - ts < 86400000 && new Date(ts).getDate() === new Date().getDate()) ? X.hora(ts) : X.fecha(ts);
X.bot = () => X.bots.find(b => b.id === X.botId);
X.urlArchivo = ruta => `${X.base}${ruta}?t=${X.token}`;

X.aviso = (texto, error) => {
  const d = document.createElement('div');
  d.className = 'aviso' + (error ? ' error' : '');
  d.textContent = texto;
  $('#avisos').append(d);
  setTimeout(() => d.remove(), error ? 6000 : 3500);
};

X.api = async (ruta, opc = {}) => {
  const cab = { Authorization: 'Bearer ' + X.token };
  let cuerpo = opc.body;
  if (cuerpo && !(cuerpo instanceof FormData)) { cab['Content-Type'] = 'application/json'; cuerpo = JSON.stringify(cuerpo); }
  let r;
  try { r = await fetch(X.base + '/api' + ruta, { method: opc.method || (cuerpo ? 'POST' : 'GET'), headers: cab, body: cuerpo }); }
  catch { throw new Error('No hay conexión con el motor. ¿Está encendido?'); }
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401 && X.token && !opc.sinSalir) { X.salir(); throw new Error(datos.error || 'Sesión vencida'); }
  if (!r.ok) throw new Error(datos.error || 'Algo salió mal');
  return datos;
};
// Ejecuta una acción y muestra el error si falla.
X.intentar = async (fn, bien) => {
  try { const r = await fn(); if (bien) X.aviso(bien); return r; }
  catch (e) { X.aviso(e.message, true); return undefined; }
};

X.ventana = (html, grande) => {
  const v = document.createElement('div');
  v.className = 'velo';
  v.innerHTML = `<div class="ventana${grande ? ' grande' : ''}">${html}</div>`;
  v.addEventListener('mousedown', e => { if (e.target === v) v.remove(); });
  document.body.append(v);
  $('input,textarea,select', v)?.focus();
  return v;
};
X.cerrarVentana = () => $$('.velo').forEach(v => v.remove());
X.confirmar = (texto, boton = 'Sí, continuar') => new Promise(ok => {
  const v = X.ventana(`<h3>${esc(texto)}</h3><div class="fila fin"><button class="btn" data-r="0">Cancelar</button><button class="btn rojo" data-r="1">${esc(boton)}</button></div>`);
  v.addEventListener('click', e => { const r = e.target.dataset?.r; if (r !== undefined) { v.remove(); ok(r === '1'); } });
});
X.pedir = (titulo, valor = '', etiqueta = '') => new Promise(ok => {
  const v = X.ventana(`<h3>${esc(titulo)}</h3><form><label class="campo"><span>${esc(etiqueta)}</span><input name="v" value="${esc(valor)}" autocomplete="off"></label>
    <div class="fila fin"><button type="button" class="btn" data-c>Cancelar</button><button class="btn rojo">Aceptar</button></div></form>`);
  $('form', v).onsubmit = e => { e.preventDefault(); const t = e.target.v.value.trim(); v.remove(); ok(t || null); };
  $('[data-c]', v).onclick = () => { v.remove(); ok(null); };
});

// ---------- Entrada ----------

const MARCA = '<div class="marca"><i>O</i><div><b>ORVIX QR</b><small>CRM DE WHATSAPP</small></div></div>';

X.arrancar = async () => {
  X.base = guardado.leer('xv_motor');
  X.token = guardado.leer('xv_token');
  X.botId = guardado.leer('xv_bot');
  let estado = null;
  try { estado = await (await fetch(X.base + '/api/estado')).json(); } catch { /* sin motor */ }
  if (estado?.app !== 'xventas') return X.pantallaMotor();
  if (X.token) {
    try { await X.cargarBase(); return X.pintarMarco(); } catch { X.token = ''; guardado.poner('xv_token', ''); }
  }
  X.pantallaEntrada(estado.configurado, estado.pideCodigo);
};

X.pantallaMotor = () => {
  $('#app').innerHTML = `<div class="entrada"><form class="caja">${MARCA}
    <h2 style="margin:22px 0 6px">Conecta tu motor</h2>
    <p class="ayuda" style="margin-bottom:16px">Este panel necesita la dirección del motor (el servidor que mantiene WhatsApp conectado). Pégala aquí una sola vez en cada navegador: es la que te dio Cloud Shell (termina en <b>.sslip.io</b>).</p>
    <label class="campo"><span>Dirección del motor</span><input name="url" placeholder="https://34-123-45-67.sslip.io" value="${esc(X.base)}" required></label>
    <button class="btn rojo" style="width:100%;justify-content:center">Conectar</button></form></div>`;
  $('form').onsubmit = async e => {
    e.preventDefault();
    let url = e.target.url.value.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(url)) url = (/^(localhost|127\.)/.test(url) ? 'http://' : 'https://') + url;
    try {
      const r = await (await fetch(url + '/api/estado')).json();
      if (r.app !== 'xventas') throw new Error();
      guardado.poner('xv_motor', url); X.arrancar();
    } catch { X.aviso('No encontré un motor de ORVIX QR en esa dirección.', true); }
  };
};

X.pantallaEntrada = (configurado, pideCodigo) => {
  $('#app').innerHTML = `<div class="entrada"><form class="caja">${MARCA}
    <h2 style="margin:22px 0 6px">${configurado ? 'Entrar al panel' : 'Crea tu contraseña'}</h2>
    <p class="ayuda" style="margin-bottom:16px">${configurado ? 'Escribe la contraseña de tu panel.' : 'Es la primera vez que abres el panel. Elige una contraseña (mínimo 8 caracteres) y guárdala bien.'}</p>
    ${pideCodigo ? `<label class="campo"><span>Código de instalación</span><input name="codigo" required autocomplete="off" placeholder="Lo mostró Google Cloud al terminar la instalación">
      <div class="ayuda">Solo se pide esta vez, para que nadie más pueda crear la contraseña de tu panel.</div></label>` : ''}
    <label class="campo"><span>Contraseña</span><input name="clave" type="password" minlength="${configurado ? 1 : 8}" required autocomplete="${configurado ? 'current-password' : 'new-password'}"></label>
    <button class="btn rojo" style="width:100%;justify-content:center">${configurado ? 'Entrar' : 'Crear y entrar'}</button></form></div>`;
  $('form').onsubmit = async e => {
    e.preventDefault();
    const cuerpo = { clave: e.target.clave.value, codigo: e.target.codigo?.value || '' };
    const r = await X.intentar(() => X.api(configurado ? '/entrar' : '/configurar', { body: cuerpo, sinSalir: true }));
    if (!r) return;
    X.token = r.token; guardado.poner('xv_token', r.token);
    await X.cargarBase(); X.pintarMarco();
  };
};

X.salir = () => { X.token = ''; guardado.poner('xv_token', ''); X.alSalir?.(); location.hash = ''; X.arrancar(); };

X.cargarBase = async () => {
  [X.bots, X.archivos, X.opciones] = await Promise.all([X.api('/bots', { sinSalir: true }), X.api('/archivos', { sinSalir: true }), X.api('/opciones', { sinSalir: true })]);
  if (!X.bots.length) X.bots = [await X.api('/bots', { body: { nombre: 'Mi primer bot' } })];
  if (!X.bot()) X.elegirBot(X.bots[0].id, true);
};
X.recargarBots = async () => { X.bots = await X.api('/bots'); X.pintarBarra(); };
X.elegirBot = (id, callado) => { X.botId = id; guardado.poner('xv_bot', id); if (!callado) { X.pintarBarra(); X.ir(); } };
// Guarda cambios de configuración del bot actual.
X.guardarBot = async (cambios, bien = 'Guardado') => {
  const b = await X.intentar(() => X.api('/bots/' + X.botId, { method: 'PATCH', body: cambios }), bien);
  if (b) X.bots = X.bots.map(x => x.id === b.id ? b : x);
  return b;
};

// ---------- Marco y navegación ----------

const MENU = [
  ['PRINCIPAL'], ['analiticas', 'capas', 'Analíticas'], ['dashboard', 'linea', 'Dashboard'], ['conectar', 'enchufe', 'Conectar'], ['chat', 'chats', 'Chat en vivo'], ['reportes', 'barras', 'Reportes'],
  ['AUTOMATIZACIÓN'], ['archivos', 'imagenes', 'Archivos'], ['flujos', 'red', 'Flujos avanzados'], ['disparadores', 'rayo', 'Disparadores'],
  ['CONFIGURACIÓN'], ['pagos', 'tarjeta', 'Pagos y accesos'], ['paises', 'prohibido', 'Bloqueo por país'], ['ia', 'bot', 'Configurar IA'], ['guia', 'reproducir', 'Guía paso a paso']
];

X.pintarMarco = () => {
  $('#app').innerHTML = `<div class="marco">
    <nav class="lateral">${MARCA}
      ${MENU.map(m => m.length === 1 ? `<h5>${m[0]}</h5>` : `<a href="#/${m[0]}" data-v="${m[0]}">${X.ic(m[1], 19)}<span>${m[2]}</span></a>`).join('')}
    </nav>
    <div class="principal">
      <div class="barra"><button class="btn chico menu-btn" onclick="$('.lateral').classList.toggle('abierto')">${X.ic('menu')}</button><h1 id="titulo" class="crece"></h1>
        <div id="barra-bot" class="fila"></div>
        <div class="desplegable" id="cuenta">
          <button class="disparo cuenta-btn" data-abrir><span class="avatar-cuenta">${X.ic('usuario', 18)}</span><span class="cuenta-nombre">Administrador</span>${X.ic('chevron', 16)}</button>
          <div class="menu-caja derecha">
            <div class="menu-cab"><span class="avatar-cuenta grande">${X.ic('usuario', 22)}</span><div><b>Administrador</b><small>Dueño del panel</small></div></div>
            <label class="menu-op"><input type="checkbox" id="notis">${X.ic('campana')} Avisarme de cada venta</label>
            <a class="menu-op" href="#/guia">${X.ic('reproducir')} Guía paso a paso</a>
            <div class="menu-sep"></div>
            <button class="menu-op peligro" onclick="X.salir()">${X.ic('salir')} Cerrar sesión</button>
          </div>
        </div>
      </div>
      <main class="vista" id="vista"></main>
    </div></div>`;
  const notis = $('#notis');
  notis.checked = guardado.leer('xv_notis') === '1';
  notis.onchange = async () => {
    if (notis.checked && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    guardado.poner('xv_notis', notis.checked ? '1' : '');
  };
  $('.lateral').addEventListener('click', e => { if (e.target.closest('a')) $('.lateral').classList.remove('abierto'); });
  // Menús desplegables de la barra: se abren con su botón y se cierran al hacer clic fuera o al elegir algo.
  $('.barra').addEventListener('click', e => {
    const boton = e.target.closest('[data-abrir]');
    if (!boton) return;
    const caja = boton.closest('.desplegable'), abrir = !caja.classList.contains('abierto');
    $$('.desplegable.abierto').forEach(d => d.classList.remove('abierto'));
    caja.classList.toggle('abierto', abrir);
  });
  document.onclick = e => {
    if (e.target.closest('.desplegable')) { if (e.target.closest('a.menu-op, button.menu-op, .bot-op')) $$('.desplegable.abierto').forEach(d => d.classList.remove('abierto')); return; }
    $$('.desplegable.abierto').forEach(d => d.classList.remove('abierto'));
  };
  X.pintarBarra();
  window.onhashchange = X.ir;
  X.ir();
  clearInterval(X.relojEventos);
  X.relojEventos = setInterval(X.revisarEventos, 6000);
};

X.pintarBarra = () => {
  const b = X.bot(), c = b?.conexion?.estado;
  const el = $('#barra-bot');
  if (!el || !b) return;
  const abierto = $('#bots-menu')?.classList.contains('abierto');
  const linea = x => x.conexion?.estado === 'conectado' ? '+' + esc(x.conexion.numero || '') : 'sin teléfono';
  el.innerHTML = `<span class="estado ${c === 'conectado' ? 'si' : c && c !== 'desconectado' ? 'medio' : ''}">${c === 'conectado' ? 'Conectado · +' + esc(b.conexion.numero || '') : c && c !== 'desconectado' ? 'Conectando…' : 'Desconectado'}</span>
    <div class="desplegable${abierto ? ' abierto' : ''}" id="bots-menu">
      <button class="disparo" data-abrir title="Cambiar de bot">${X.robot(24)}<b class="disparo-nombre">${esc(b.nombre)}</b>${X.ic('chevron', 16)}</button>
      <div class="menu-caja derecha">
        <div class="menu-tit">TUS BOTS (${X.bots.length})</div>
        <div class="bots-lista">${X.bots.map(x => `<div class="bot-op${x.id === b.id ? ' activo' : ''}" onclick="X.elegirBot('${x.id}')">
          <span class="punto ${x.conexion?.estado === 'conectado' ? 'si' : ''}">${X.ic(x.conexion?.estado === 'conectado' ? 'checkCirculo' : 'reloj', 16)}</span>
          <div class="crece"><b>${esc(x.nombre)}</b><small>${linea(x)}</small></div>
          ${x.id === b.id ? `<span class="tilde">${X.ic('check', 16)}</span>` : ''}
          <button class="icono" title="Renombrar" onclick="event.stopPropagation();X.accionBot('renombrar','${x.id}')">${X.ic('lapiz', 15)}</button>
          <button class="icono peligro" title="Eliminar" onclick="event.stopPropagation();X.accionBot('eliminar','${x.id}')">${X.ic('basura', 15)}</button></div>`).join('')}</div>
        <div class="menu-sep"></div>
        <button class="menu-op verde" onclick="X.accionBot('nuevo')">${X.ic('mas')} Nuevo bot</button>
        <button class="menu-op verde" onclick="X.accionBot('clonar','${b.id}')">${X.ic('copiar')} Clonar este bot</button>
      </div>
    </div>`;
};

X.ir = () => {
  if (!$('#vista')) return; // en la pantalla de entrada no hay vistas
  const [nombre, arg] = (location.hash.replace(/^#\/?/, '') || 'analiticas').split('/');
  const vista = X.vistas[nombre] || X.vistas.analiticas;
  X.alSalir?.(); X.alSalir = null;
  $$('.desplegable.abierto').forEach(d => d.classList.remove('abierto'));
  $$('.lateral a').forEach(a => a.classList.toggle('activo', a.dataset.v === nombre));
  const icono = MENU.find(m => m[0] === (X.vistas[nombre] ? nombre : 'analiticas'))?.[1];
  $('#titulo').innerHTML = `${icono ? `<span class="tit-ic">${X.ic(icono, 20)}</span>` : ''}<span>${esc(vista.titulo)}</span>`;
  const el = $('#vista');
  el.innerHTML = '';
  el.scrollTop = 0;
  Promise.resolve(vista.pintar(el, arg)).catch(e => { el.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${esc(e.message)}</div>`; });
};

X.gestionarBots = () => {
  X.ventana(`<h3>Mis bots</h3>
    <p class="ayuda" style="margin:-8px 0 14px">Cada bot es un número de WhatsApp con sus propios flujos, pagos y métricas.</p>
    ${X.bots.map(b => `<div class="fila" style="padding:9px 0;border-bottom:1px solid var(--borde)">
      <div class="crece"><b>${esc(b.nombre)}</b><div class="ayuda" style="margin:0">${b.conexion.estado === 'conectado' ? '● Conectado · +' + esc(b.conexion.numero) : '○ Sin conectar'}</div></div>
      <button class="btn chico" onclick="X.accionBot('renombrar','${b.id}')">Renombrar</button>
      <button class="btn chico" onclick="X.accionBot('clonar','${b.id}')">Clonar</button>
      <button class="btn chico peligro" onclick="X.accionBot('eliminar','${b.id}')">Eliminar</button></div>`).join('')}
    <div class="fila fin" style="margin-top:16px"><button class="btn" onclick="X.cerrarVentana()">Cerrar</button><button class="btn rojo" onclick="X.accionBot('nuevo')">${X.ic('mas')} Nuevo bot</button></div>`, true);
};
X.accionBot = async (accion, id) => {
  const b = X.bots.find(x => x.id === id);
  X.cerrarVentana();
  $$('.desplegable.abierto').forEach(d => d.classList.remove('abierto'));
  if (accion === 'nuevo') {
    const nombre = await X.pedir('Nuevo bot', '', 'Nombre (por ejemplo: Recetas Colombia)');
    if (!nombre) return;
    const nuevo = await X.intentar(() => X.api('/bots', { body: { nombre } }), 'Bot creado');
    if (nuevo) { await X.recargarBots(); X.elegirBot(nuevo.id); }
  } else if (accion === 'renombrar') {
    const nombre = await X.pedir('Renombrar bot', b.nombre, 'Nombre');
    if (nombre) { await X.intentar(() => X.api('/bots/' + id, { method: 'PATCH', body: { nombre } }), 'Nombre cambiado'); await X.recargarBots(); }
  } else if (accion === 'clonar') {
    const copia = await X.intentar(() => X.api(`/bots/${id}/clonar`, { method: 'POST' }), 'Bot clonado con sus flujos y configuración');
    if (copia) await X.recargarBots();
  } else if (accion === 'eliminar') {
    if (X.bots.length < 2) return X.aviso('Necesitas al menos un bot.', true);
    if (!await X.confirmar(`¿Eliminar "${b.nombre}" con sus flujos, chats y ventas? No se puede deshacer.`, 'Sí, eliminar')) return;
    await X.intentar(() => X.api('/bots/' + id, { method: 'DELETE' }), 'Bot eliminado');
    X.bots = await X.api('/bots');
    if (!X.bot()) X.elegirBot(X.bots[0].id); else X.pintarBarra();
  }
};

X.revisarEventos = async () => {
  let lista;
  try { lista = await X.api('/eventos?desde=' + X.ultimoEvento); } catch { return; }
  for (const e of lista) {
    X.ultimoEvento = Math.max(X.ultimoEvento, e.ts);
    if (e.tipo === 'aviso') { X.aviso(e.texto, true); continue; }
    if (e.tipo !== 'venta') continue;
    const texto = `Venta de ${e.nombre}: ${X.dinero(e.monto, e.moneda)}`;
    X.aviso(texto);
    if (guardado.leer('xv_notis') !== '1') continue;
    X.sonar();
    if ('Notification' in window && Notification.permission === 'granted') new Notification('ORVIX QR', { body: texto });
  }
};
X.sonar = () => {
  try {
    const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(880, ctx.currentTime); o.frequency.setValueAtTime(1320, ctx.currentTime + .12);
    g.gain.setValueAtTime(.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .4);
    o.start(); o.stop(ctx.currentTime + .4);
  } catch { /* el navegador no dejó sonar */ }
};
