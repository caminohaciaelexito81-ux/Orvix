// Chat en vivo: todas las conversaciones del bot, filtros y acciones sobre cada cliente.
(() => {
  const FILTROS_INICIO = () => ({ orden: 'reciente', noLeidos: false, sinEtiqueta: false, actividad: 'todas', pago: 'todos', quien: 'todos', tipo: 'todos', desde: '', hasta: '', etiquetas: [] });
  const f = { ...FILTROS_INICIO(), buscar: '' };
  let lista = [], abierto = null, actual = null, firma = '', reloj = null, panelAbierto = false;
  const COLORES = ['#e5484d', '#17a366', '#3b82f6', '#a855f7', '#f59e0b', '#0ea5a4', '#ec4899'];
  const color = t => COLORES[[...String(t)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length];
  const iniciales = c => ((c.nombre || c.telefono || '?').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2) || '?').toUpperCase();
  const ruta = (extra = '') => `/bots/${X.botId}/chats/${encodeURIComponent(abierto)}${extra}`;
  const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const DIA = 864e5;

  // ---------- Filtros ----------
  const ACTIVIDAD = { hoy: 'hoy', '24': DIA, 7: 7 * DIA, 30: 30 * DIA };
  function pasaFiltros(c) {
    const ahora = Date.now();
    if (f.noLeidos && !c.noLeidos) return false;
    if (f.sinEtiqueta && c.etiquetas.length) return false;
    if (f.actividad === 'hoy' && new Date(c.ultimo).toDateString() !== new Date().toDateString()) return false;
    if (['24', '7', '30'].includes(f.actividad) && ahora - c.ultimo > ACTIVIDAD[f.actividad]) return false;
    if (f.actividad === 'antiguas' && ahora - c.ultimo <= 30 * DIA) return false;
    if (f.pago === 'pagado' && !c.pagado) return false;
    if (f.pago === 'pendiente' && (c.pagado || !c.envioComprobante)) return false;
    if (f.pago === 'sinregistro' && (c.pagado || c.envioComprobante)) return false;
    if (f.quien === 'cliente' && c.ultimoDe !== 'cliente') return false;
    if (f.quien === 'bot' && !['bot', 'yo'].includes(c.ultimoDe)) return false;
    if (f.tipo !== 'todos' && c.ultimoTipo !== f.tipo) return false;
    if (f.desde && c.ultimo < new Date(f.desde + 'T00:00').getTime()) return false;
    if (f.hasta && c.ultimo > new Date(f.hasta + 'T23:59:59').getTime()) return false;
    if (f.etiquetas.length && !f.etiquetas.some(e => c.etiquetas.includes(e))) return false;
    const q = sinTildes(f.buscar);
    return !q || sinTildes(c.nombre + ' ' + c.telefono).includes(q);
  }
  const ORDEN = {
    reciente: (a, z) => z.ultimo - a.ultimo,
    antiguo: (a, z) => a.ultimo - z.ultimo,
    noleidos: (a, z) => (z.noLeidos > 0) - (a.noLeidos > 0) || z.ultimo - a.ultimo,
    nombre: (a, z) => (a.nombre || a.telefono).localeCompare(z.nombre || z.telefono, 'es'),
    nuevos: (a, z) => z.creado - a.creado
  };
  const filtradas = () => lista.filter(pasaFiltros).sort(ORDEN[f.orden] || ORDEN.reciente);
  const cuantosFiltros = () => {
    const base = FILTROS_INICIO();
    return Object.keys(base).filter(k => k !== 'orden' && JSON.stringify(f[k]) !== JSON.stringify(base[k])).length;
  };

  function pintarFiltros() {
    const caja = $('#panel-filtros');
    if (!caja) return;
    const n = cuantosFiltros();
    $('#btn-filtros').classList.toggle('activo', panelAbierto || n > 0);
    $('#btn-filtros').innerHTML = `${X.ic('filtros', 15)} Filtros${n ? `<span class="globo">${n}</span>` : ''}`;
    caja.classList.toggle('oculto', !panelAbierto);
    if (!panelAbierto) return;
    const pildoras = (campo, opciones) => `<div class="pildoras">${opciones.map(([k, t]) => `<button class="${f[campo] === k ? 'activo' : ''}" data-f="${campo}" data-v="${k}">${t}</button>`).join('')}</div>`;
    const todas = [...new Set(lista.flatMap(c => c.etiquetas))].sort((a, z) => a.localeCompare(z, 'es'));
    caja.innerHTML = `
      <h6>${X.ic('ordenar', 13)} Ordenar por</h6>
      <select data-f="orden">${[['reciente', 'Más reciente'], ['antiguo', 'Más antiguo'], ['noleidos', 'No leídos primero'], ['nuevos', 'Contactos nuevos'], ['nombre', 'Nombre (A-Z)']].map(([k, t]) => `<option value="${k}"${f.orden === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <h6>${X.ic('rayo', 13)} Rápidos</h6>
      <label class="casilla"><input type="checkbox" data-f="noLeidos" ${f.noLeidos ? 'checked' : ''}>${X.ic('mensaje', 14)} Solo no leídos</label>
      <label class="casilla"><input type="checkbox" data-f="sinEtiqueta" ${f.sinEtiqueta ? 'checked' : ''}>${X.ic('etiqueta', 14)} Sin etiquetar</label>
      <h6>${X.ic('reloj', 13)} Última actividad</h6>
      ${pildoras('actividad', [['todas', 'Todas'], ['hoy', 'Hoy'], ['24', '24 h'], ['7', '7 días'], ['30', '30 días'], ['antiguas', 'Antiguas']])}
      <h6>${X.ic('tarjeta', 13)} Pago</h6>
      ${pildoras('pago', [['todos', 'Todos'], ['pagado', 'Pagado'], ['pendiente', 'Pendiente'], ['sinregistro', 'Sin registro']])}
      <h6>${X.ic('mensaje', 13)} Último mensaje</h6>
      ${pildoras('quien', [['todos', 'Todos'], ['cliente', 'Cliente respondió'], ['bot', 'Bot respondió']])}
      ${pildoras('tipo', [['todos', 'Todos los tipos'], ['texto', 'Texto'], ['imagen', 'Imagen'], ['audio', 'Audio'], ['video', 'Video'], ['documento', 'Documento']])}
      <h6>${X.ic('calendario', 13)} Rango personalizado</h6>
      <div class="rango"><input type="date" data-f="desde" value="${f.desde}"><span>→</span><input type="date" data-f="hasta" value="${f.hasta}"></div>
      <h6>${X.ic('etiqueta', 13)} Etiquetas (varias)</h6>
      ${todas.length ? `<div class="pildoras">${todas.map(e => `<button class="etq-f${f.etiquetas.includes(e) ? ' activo' : ''}" data-etq="${esc(e)}"><i></i>${esc(e)}</button>`).join('')}</div>` : '<p class="tenue" style="margin:0;font-size:12px">Aún no hay etiquetas.</p>'}
      <button class="limpiar" data-limpiar>${X.ic('xCirculo', 14)} Limpiar filtros</button>`;
  }

  function alFiltrar(e) {
    const el = e.target.closest('[data-f], [data-etq], [data-limpiar]');
    if (!el) return;
    if (el.dataset.limpiar !== undefined) Object.assign(f, FILTROS_INICIO());
    else if (el.dataset.etq !== undefined) {
      const k = el.dataset.etq;
      f.etiquetas = f.etiquetas.includes(k) ? f.etiquetas.filter(x => x !== k) : [...f.etiquetas, k];
    } else if (el.type === 'checkbox') f[el.dataset.f] = el.checked;
    else if (el.dataset.v !== undefined) f[el.dataset.f] = el.dataset.v;
    else f[el.dataset.f] = el.value;
    const scroll = $('#panel-filtros').scrollTop;
    pintarFiltros(); pintarLista();
    $('#panel-filtros').scrollTop = scroll;
  }

  // ---------- Lista ----------
  function pintarLista() {
    const caja = $('#conversaciones');
    if (!caja) return;
    const visibles = filtradas();
    $('#conv-n').textContent = visibles.length === lista.length ? lista.length : `${visibles.length}/${lista.length}`;
    caja.innerHTML = visibles.length ? visibles.map(c => `<div class="conv${c.jid === abierto ? ' activo' : ''}" data-jid="${esc(c.jid)}">
      <div class="avatar" style="background:${color(c.jid)}">${esc(iniciales(c))}</div>
      <div class="datos"><b>${esc(c.nombre || '+' + c.telefono)}</b>
        ${c.pagado ? `<span class="chip-pagado">${X.ic('checkCirculo', 11)} Pagado</span>` : ''}
        <span class="vista">${c.ultimoDe && c.ultimoDe !== 'cliente' ? `<i class="de-bot">${X.ic('respuesta', 12)}</i>` : ''}${esc(c.vista || (c.ultimoTipo ? '[' + c.ultimoTipo + ']' : ''))}</span></div>
      <div class="lado">${X.cuando(c.ultimo)}${c.noLeidos ? `<span class="globo">${c.noLeidos}</span>` : ''}${c.pausado ? `<i title="Bot detenido">${X.ic('pausa', 13)}</i>` : c.enFlujo ? `<i title="En un flujo">${X.ic('engranaje', 13)}</i>` : ''}</div></div>`).join('')
      : `<div class="vacio"><b>${lista.length ? 'Ninguna coincide' : 'Aún no hay conversaciones'}</b>${lista.length ? 'Prueba con otros filtros.' : 'Aparecerán cuando alguien escriba a tu WhatsApp.'}</div>`;
  }

  // ---------- Mensajes ----------
  const RESULTADO = {
    valido: ['si', 'Pago validado'], invalido: ['no', 'No coincide con tus reglas'], repetido: ['no', 'Comprobante ya usado antes'], revisar: ['medio', 'Revisa y registra la venta si es correcto']
  };
  // "S/ 13,00" en vez de "13,00 PEN".
  const conSimbolo = (n, moneda) => X.dineroSimbolo(n, moneda, { decimales: 2 });
  function tarjetaComprobante(m) {
    const [clase, nota] = RESULTADO[m.resultado] || ['medio', ''];
    const puedeRegistrar = !actual.pagado && m.resultado !== 'valido' && m.monto > 0;
    return `<div class="comprobante">
      <header>${X.ic('recibo', 15)}<b>Transcripción comprobante</b><span class="solo-tu">Sólo visible para ti</span></header>
      <div class="monto-det"><small>Monto detectado</small><b>${m.monto > 0 ? conSimbolo(m.monto, m.moneda) : 'No encontrado'}</b></div>
      <pre>${esc(m.texto || '(no se pudo leer texto en la imagen)')}</pre>
      <footer><span class="resultado ${clase}">${X.ic(clase === 'si' ? 'checkCirculo' : clase === 'no' ? 'xCirculo' : 'info', 13)} ${nota}</span>
        ${puedeRegistrar ? `<button class="btn chico rojo" data-registrar="${m.monto}">${X.ic('dinero', 14)} Registrar venta</button>` : ''}
        <time>${X.hora(m.ts)}</time></footer></div>`;
  }
  function burbuja(m) {
    if (m.tipo === 'comprobante') return tarjetaComprobante(m);
    let cuerpo = '';
    const url = m.archivo && X.urlArchivo(m.archivo);
    if (url && m.tipo === 'imagen') cuerpo = `<img src="${url}" loading="lazy" onclick="window.open(this.src)">`;
    else if (url && m.tipo === 'sticker') cuerpo = `<img src="${url}" style="max-width:120px">`;
    else if (url && m.tipo === 'video') cuerpo = `<video src="${url}" controls preload="none"></video>`;
    else if (url && m.tipo === 'audio') cuerpo = `<audio src="${url}" controls preload="none"></audio>`;
    else if (url) cuerpo = `<a class="doc" href="${url}" target="_blank" rel="noopener">${X.ic('documento', 20)} ${esc(m.nombre || 'Documento')}</a>`;
    else if (m.tipo !== 'texto') cuerpo = `<i>[${esc(m.tipo)}]</i>`;
    const quien = m.de === 'bot' ? X.ic('bot', 12) + ' ' : m.de === 'yo' ? X.ic('usuario', 12) + ' ' : '';
    return `<div class="msg ${m.de}">${cuerpo}${m.texto ? (cuerpo ? '<br>' : '') + esc(m.texto) : ''}<time>${quien}${X.hora(m.ts)}</time></div>`;
  }
  // Separadores de día entre los mensajes ("Hoy", "Ayer", "12 oct 2026").
  function conDias(mensajes) {
    let dia = '', h = '';
    const hoy = new Date().toDateString(), ayer = new Date(Date.now() - DIA).toDateString();
    for (const m of mensajes) {
      const d = new Date(m.ts).toDateString();
      if (d !== dia) { dia = d; h += `<div class="dia"><span>${d === hoy ? 'Hoy' : d === ayer ? 'Ayer' : X.fecha(m.ts)}</span></div>`; }
      h += burbuja(m);
    }
    return h;
  }

  function pintarHilo() {
    const hilo = $('#hilo');
    if (!hilo) return;
    $('.chat').classList.toggle('abierta', Boolean(actual));
    if (!actual) { hilo.innerHTML = `<div class="hilo-vacio">${X.ic('chats', 46)}<b>Selecciona una conversación</b>Los mensajes de WhatsApp aparecerán aquí.</div>`; return; }
    const c = actual;
    const accion = (a, ic, col, titulo, lleno) => `<button class="accion2${lleno ? ' lleno' : ''}" style="--c:${col}" data-a="${a}" title="${titulo}">${X.ic(ic, 17)}</button>`;
    hilo.innerHTML = `<div class="cabeza">
        <button class="btn chico menu-btn" data-a="volver">${X.ic('atras')}</button>
        <div class="avatar grande" style="background:${color(c.jid)}">${esc(iniciales(c))}</div>
        <div class="quien"><b>${esc(c.nombre || 'Sin nombre')}</b>
          <span><i class="punto-verde"></i>${esc(c.telefono || '')}${c.enFlujo ? ` · en flujo «${esc(c.enFlujo)}»` : ''}${c.pausado ? ' · bot detenido' : ''}${c.iaActiva ? ' · IA activa' : ''}</span>
          <div class="etqs">${c.pagado ? `<span class="chip-pagado">${X.ic('checkCirculo', 11)} Pagado</span>` : ''}${c.etiquetas.filter(e => e !== 'Pagado').map(e => `<span class="chip">${esc(e)}</span>`).join('')}</div></div>
        <div class="acciones">
          ${c.pagado ? `<span class="chip-pagado">${X.ic('checkCirculo', 11)} Pagado</span>` : ''}
          ${accion('flujo', 'enviar', '#0d9488', 'Enviar un flujo a este cliente', true)}
          ${accion('pausa', c.pausado ? 'play' : 'detener', '#ea580c', c.pausado ? 'Reanudar el bot en este chat' : 'Detener el bot en este chat')}
          ${accion('pagado', 'checkCirculo', '#17a366', 'Marcar como pagado (registrar venta manual)')}
          ${accion('ia', 'bot', c.iaActiva ? '#2563eb' : '#94a3b8', c.iaActiva ? 'Apagar la IA en este chat' : 'Encender la IA en este chat')}
          ${accion('info', 'info', '#0ea5a4', 'Información del contacto')}
          ${accion('borrar', 'basura', '#e5484d', 'Eliminar conversación')}</div></div>
      <div class="mensajes" id="mensajes">${conDias(c.mensajes)}</div>
      <form class="redactar"><button type="button" class="icono" data-a="adjuntar" title="Enviar un archivo">${X.ic('clip', 19)}</button>
        <textarea id="texto-msg" rows="1" placeholder="Escribe un mensaje…"></textarea><button class="enviar-btn" title="Enviar (Enter)">${X.ic('enviar', 17)}</button></form>`;
    const caja = $('#mensajes');
    caja.scrollTop = caja.scrollHeight;
    $('#texto-msg').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } };
    $('.redactar').onsubmit = e => { e.preventDefault(); enviar(); };
  }

  async function cargarHilo(forzar) {
    if (!abierto) return;
    let c;
    try { c = await X.api(ruta()); } catch { abierto = null; actual = null; return pintarHilo(); }
    const nueva = [c.mensajes.length, c.mensajes.at(-1)?.id, c.pausado, c.iaActiva, c.pagado, c.enFlujo, c.etiquetas.join()].join('|');
    if (!forzar && nueva === firma) return;
    const borrador = $('#texto-msg')?.value || '';
    firma = nueva; actual = c;
    pintarHilo();
    if (borrador) $('#texto-msg').value = borrador;
  }

  async function cargarLista() {
    try { lista = await X.api(`/bots/${X.botId}/chats`); } catch { return; }
    pintarLista();
    if (panelAbierto && !$('#panel-filtros').contains(document.activeElement)) { const s = $('#panel-filtros').scrollTop; pintarFiltros(); $('#panel-filtros').scrollTop = s; }
    cargarHilo();
  }

  async function enviar() {
    const campo = $('#texto-msg'), texto = campo.value.trim();
    if (!texto) return;
    campo.value = '';
    const ok = await X.intentar(() => X.api(ruta('/enviar'), { body: { texto } }));
    if (ok === undefined) campo.value = texto;
    cargarHilo(true);
  }

  async function registrarVenta(monto) {
    if (!await X.confirmar(`¿Registrar una venta de ${X.dinero(monto)} para ${actual.nombre || actual.telefono}? Se suma a tus métricas y no se puede deshacer.`, 'Sí, registrar')) return;
    await X.intentar(() => X.api(ruta('/pagado'), { body: { monto } }), 'Venta registrada');
    cargarHilo(true);
  }

  const acciones = {
    volver() { abierto = null; actual = null; pintarHilo(); pintarLista(); },
    async flujo() {
      const flujos = await X.api(`/bots/${X.botId}/flujos`);
      if (!flujos.length) return X.aviso('Primero crea un flujo en «Flujos avanzados».', true);
      const enUso = new Set((X.bot().disparadores || []).map(d => d.flujoId));
      let elegido = null;
      const v = X.ventana(`<div class="modal-cab">${X.ic('enviar', 22)}<div><h3>Enviar flujo</h3><small>A: ${esc(actual.nombre || '+' + actual.telefono)}</small></div></div>
        <div class="modal-cuerpo"><input id="buscar-flujo" placeholder="Buscar por nombre…" autocomplete="off">
          <div class="flujos-elegir">${flujos.map(x => `<button type="button" class="flujo-op" data-f="${x.id}" data-n="${esc(sinTildes(x.nombre))}">
            <span class="flujo-ic">${X.ic('red', 18)}</span><div><b>${esc(x.nombre)}</b><small>${X.ic('capas', 12)} ${x.nodos} ${x.nodos === 1 ? 'nodo' : 'nodos'} ${enUso.has(x.id) ? '<i class="activo-f">● activo</i>' : ''}</small></div></button>`).join('')}</div></div>
        <div class="modal-pie"><button class="btn" data-c>Cancelar</button><button class="btn rojo" data-ok disabled>Enviar flujo</button></div>`);
      $('.ventana', v).classList.add('modal');
      $('#buscar-flujo', v).oninput = e => { const q = sinTildes(e.target.value); $$('.flujo-op', v).forEach(b => b.classList.toggle('oculto', !b.dataset.n.includes(q))); };
      v.addEventListener('click', async e => {
        const op = e.target.closest('[data-f]');
        if (op) { elegido = op.dataset.f; $$('.flujo-op', v).forEach(b => b.classList.toggle('activo', b === op)); $('[data-ok]', v).disabled = false; return; }
        if (e.target.closest('[data-c]')) return v.remove();
        if (e.target.closest('[data-ok]') && elegido) {
          v.remove();
          await X.intentar(() => X.api(ruta('/flujo'), { body: { flujoId: elegido } }), 'Flujo enviado');
          cargarHilo(true);
        }
      });
    },
    async pausa() {
      await X.intentar(() => X.api(ruta('/pausa'), { body: { pausado: !actual.pausado } }), actual.pausado ? 'El bot vuelve a atender este chat' : 'Bot detenido en este chat');
      cargarHilo(true);
    },
    async pagado() {
      const monto = await X.pedir('Marcar como pagado', '', `Valor que pagó (${X.bot().moneda}). Ojo: entra en tu contabilidad y no se puede deshacer.`);
      if (!monto) return;
      await X.intentar(() => X.api(ruta('/pagado'), { body: { monto: Number(monto.replace(',', '.')) } }), 'Venta registrada');
      cargarHilo(true);
    },
    async ia() {
      await X.intentar(() => X.api(ruta('/ia'), { body: { activa: !actual.iaActiva } }), actual.iaActiva ? 'IA apagada en este chat' : 'IA encendida en este chat');
      cargarHilo(true);
    },
    info() {
      const c = actual;
      X.ventana(`<h3>${X.ic('info')} Información del contacto</h3><table class="tabla">
        <tr><td>Nombre</td><td><b>${esc(c.nombre || '—')}</b></td></tr><tr><td>Teléfono</td><td>+${esc(c.telefono || '—')}</td></tr>
        <tr><td>Primer mensaje</td><td>${X.fecha(c.creado)} ${X.hora(c.creado)}</td></tr>
        <tr><td>Compras</td><td>${c.compras || 0} · ${X.dinero(c.totalPagado)}</td></tr>
        <tr><td>Etiquetas</td><td>${c.etiquetas.map(e => `<span class="chip">${esc(e)}</span>`).join(' ') || '—'}</td></tr>
        <tr><td>Anuncio de origen</td><td>${c.anuncio ? (c.anuncio.url ? `<a href="${esc(c.anuncio.url)}" target="_blank" rel="noopener">${esc(c.anuncio.titulo)}</a>` : esc(c.anuncio.titulo)) : 'Sin anuncio (orgánico)'}</td></tr>
        <tr><td>Remarketing</td><td>${c.conRemarketing ? 'Programado' : 'No'}</td></tr></table>
        <div class="fila fin" style="margin-top:14px"><button class="btn" onclick="X.cerrarVentana()">Cerrar</button></div>`);
    },
    async borrar() {
      if (!await X.confirmar('¿Eliminar esta conversación del panel? (En tu WhatsApp no se borra.)', 'Sí, eliminar')) return;
      await X.intentar(() => X.api(ruta(), { method: 'DELETE' }), 'Conversación eliminada');
      abierto = null; actual = null; cargarLista(); pintarHilo();
    },
    async adjuntar() {
      const id = await X.elegirArchivo();
      if (!id) return;
      await X.intentar(() => X.api(ruta('/enviar'), { body: { archivoId: id, texto: $('#texto-msg').value.trim() } }), 'Archivo enviado');
      $('#texto-msg').value = '';
      cargarHilo(true);
    }
  };

  X.vistas.chat = {
    titulo: 'Chat en vivo',
    async pintar(el) {
      el.innerHTML = `<div class="chat"><div class="lista">
          <div class="lista-cab"><h5>${X.ic('chats', 15)} Conversaciones <span id="conv-n"></span></h5><button class="btn-filtros" id="btn-filtros"></button></div>
          <label class="buscar-chat">${X.ic('buscar', 15)}<input placeholder="Buscar por nombre o teléfono…" value="${esc(f.buscar)}" id="buscar-chat"></label>
          <div class="panel-filtros oculto" id="panel-filtros"></div>
          <div class="conversaciones" id="conversaciones"></div></div><div class="hilo" id="hilo"></div></div>`;
      $('#buscar-chat').oninput = e => { f.buscar = e.target.value; pintarLista(); pintarFiltros(); };
      $('#btn-filtros').onclick = () => { panelAbierto = !panelAbierto; pintarFiltros(); };
      $('#panel-filtros').addEventListener('click', e => { if (!e.target.matches('select, input')) alFiltrar(e); });
      $('#panel-filtros').addEventListener('change', e => { if (e.target.matches('select, input')) alFiltrar(e); });
      $('#conversaciones').addEventListener('click', e => {
        const jid = e.target.closest('.conv')?.dataset.jid;
        if (!jid) return;
        abierto = jid; firma = '';
        pintarLista(); cargarHilo(true);
      });
      $('#hilo').addEventListener('click', e => {
        const r = e.target.closest('[data-registrar]');
        if (r && actual) return registrarVenta(Number(r.dataset.registrar));
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a && actual) acciones[a]();
      });
      firma = '';
      pintarFiltros();
      pintarHilo();
      await cargarLista();
      reloj = setInterval(cargarLista, 3000);
      X.alSalir = () => clearInterval(reloj);
    }
  };
})();
