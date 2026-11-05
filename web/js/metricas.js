// Analíticas (varios bots), Dashboard (bot actual) y Reportes.
(() => {
  const DIA = 86400000;
  const MONEDAS = ['USD', 'COP', 'MXN', 'PEN', 'ARS', 'CLP', 'BOB', 'VES', 'GTQ', 'DOP', 'CRC', 'UYU', 'PYG', 'BRL', 'EUR'];
  const NOMBRE_MONEDA = { USD: 'Dólar', COP: 'Peso (Col)', MXN: 'Peso (Mex)', PEN: 'Sol', ARS: 'Peso (Arg)', CLP: 'Peso (Chi)', BOB: 'Boliviano', VES: 'Bolívar', GTQ: 'Quetzal', DOP: 'Peso (Dom)', CRC: 'Colón', UYU: 'Peso (Uru)', PYG: 'Guaraní', BRL: 'Real', EUR: 'Euro' };
  const ZONAS = ['America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Guayaquil', 'America/Caracas', 'America/La_Paz', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Asuncion', 'America/Montevideo', 'America/Guatemala', 'America/Costa_Rica', 'America/Panama', 'America/Santo_Domingo', 'America/Sao_Paulo', 'America/New_York', 'America/Los_Angeles', 'Europe/Madrid'];
  const PERIODOS = [['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['mes', 'Este mes'], ['anterior', 'Mes anterior'], ['todo', 'Todo el tiempo'], ['otro', 'Personalizado']];
  const estado = { periodo: '30', desde: '', hasta: '', bots: null, conocidos: new Set(), buscarBot: '', filtro: 'todos', buscar: '',
    hist: { buscar: '', porPagina: 20, pagina: 1, orden: 'ts', dir: -1 } };
  let graficos = [], ultimo = null, idsActuales = [];
  const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function rango() {
    const ahora = Date.now(), hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (estado.periodo === 'hoy') return [hoy.getTime(), ahora];
    if (estado.periodo === 'mes') return [new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime(), ahora];
    if (estado.periodo === 'anterior') return [new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).getTime(), new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime() - 1];
    if (estado.periodo === 'todo') return [0, ahora];
    if (estado.periodo === 'otro' && estado.desde) return [new Date(estado.desde + 'T00:00').getTime(), estado.hasta ? new Date(estado.hasta + 'T23:59:59').getTime() : ahora];
    return [ahora - Number(estado.periodo === 'otro' ? 30 : estado.periodo) * DIA, ahora];
  }
  // Texto corto del período para las tarjetas: "30 días", "hoy", "este mes"…
  const nombrePeriodo = () => ({ hoy: 'hoy', 7: '7 días', 30: '30 días', mes: 'este mes', anterior: 'mes anterior', todo: 'todo', otro: 'personalizado' })[estado.periodo];
  const barraPeriodo = fn => `<div class="periodo"><span class="periodo-tit">PERÍODO:</span>
    ${PERIODOS.map(([k, n]) => `<button class="pildora${estado.periodo === k ? ' activo' : ''}" onclick="X.${fn}('${k}')">${k === 'otro' ? `<span class="cal">${X.ic('calendario', 15)}</span>` : ''}${n}</button>`).join('')}
    ${estado.periodo === 'otro' ? `<span class="fechas"><input type="date" value="${estado.desde}" onchange="X.fechaMetricas('desde',this.value)"> a <input type="date" value="${estado.hasta}" onchange="X.fechaMetricas('hasta',this.value)"></span>` : ''}</div>`;

  // Tarjetas para elegir qué bots (líneas de WhatsApp) se suman en Analíticas.
  function tarjetasBots() {
    const q = sinTildes(estado.buscarBot);
    const lista = X.bots.filter(b => !q || sinTildes(b.nombre + ' ' + (b.conexion.numero || '')).includes(q));
    const n = X.bots.filter(b => estado.bots.has(b.id)).length;
    const insignia = c => c === 'conectado' ? '<span class="insignia si">CONECTADO</span>' : c && c !== 'desconectado' ? '<span class="insignia medio">CONECTANDO</span>' : '<span class="insignia no">SIN CONECTAR</span>';
    return `<div class="tarjeta"><div class="fila" style="margin-bottom:12px"><div class="crece"><h3>${X.ic('bot')} Seleccionar bots</h3><p class="sub" style="margin:2px 0 0">Elige uno o varios para consolidar el reporte. Cada bot es una línea de WhatsApp.</p></div>
        <span class="chip verde">${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}</span>
        <button class="btn chico" onclick="X.todosBotsMetricas(true)">${X.ic('checkCirculo', 15)} Todos</button><button class="btn chico" onclick="X.todosBotsMetricas(false)">${X.ic('xCirculo', 15)} Ninguno</button></div>
      <label class="buscador">${X.ic('buscar', 16)}<input placeholder="Buscar bot por nombre o número…" value="${esc(estado.buscarBot)}" oninput="X.buscarBotMetricas(this.value)"></label>
      <div class="bots-grid">${X.bots.map(b => `<div class="bot-card${estado.bots.has(b.id) ? ' activo' : ''}${lista.includes(b) ? '' : ' oculto'}" onclick="X.alternarBotMetricas('${b.id}')">
          <div class="bot-cab"><span class="bot-ic">${X.robot(30)}</span><div class="crece"><b>${esc(b.nombre)}</b>
            <div class="bot-num">${b.conexion.estado === 'conectado' ? '+' + esc(b.conexion.numero) : '<i>Sin número</i>'} ${insignia(b.conexion.estado)}</div></div>
            <span class="marca-check">${estado.bots.has(b.id) ? X.ic('check', 14) : ''}</span></div>
          <button class="btn ir-bot" onclick="event.stopPropagation();X.irAlBot('${b.id}')">${X.ic('flecha', 15)} Ir al bot</button></div>`).join('')}
        <button class="bot-card nuevo" onclick="X.accionBot('nuevo')">${X.ic('mas', 22)}<b>Agregar otra línea</b><span>Crea un bot nuevo y conecta otro número</span></button></div>
      ${n ? `<div class="consolidado">Consolidando: ${X.bots.filter(b => estado.bots.has(b.id)).map(b => `<span class="chip verde">${X.ic('bot', 13)} ${esc(b.nombre)}</span>`).join(' ')}</div>` : '<p class="ayuda">Marca al menos un bot para ver sus métricas.</p>'}</div>`;
  }

  function grafico(id, config) {
    if (!window.Chart) return;
    Chart.defaults.color = '#64748b'; Chart.defaults.borderColor = '#edf1f5'; Chart.defaults.font.family = 'Inter, "Segoe UI", system-ui, sans-serif'; Chart.defaults.font.size = 11;
    const lienzo = document.getElementById(id);
    const op = config.options || {};
    const leyenda = { position: 'top', align: 'end', labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'circle', padding: 14 }, ...op.plugins?.legend };
    if (lienzo) graficos.push(new Chart(lienzo, { ...config, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      ...op, plugins: { ...op.plugins, legend: leyenda } } }));
  }
  const limpiar = () => { graficos.forEach(g => g.destroy()); graficos = []; };
  const kpi = (icono, color, titulo, valor, pie = '', borde) => `<div class="kpi${borde ? ' borde' : ''}" style="--c:${color}"><i>${X.ic(icono, 20)}</i><div><small title="${titulo}">${titulo}</small><b title="${valor}">${valor}</b>${pie ? `<em title="${pie}">${pie}</em>` : ''}</div></div>`;
  const cambio = (ahora, antes) => !antes ? '—' : `${ahora >= antes ? '▲' : '▼'} ${Math.abs((ahora - antes) / antes * 100).toFixed(0)}%`;
  // Cabecera de tarjeta con icono de color, título en mayúsculas y subtítulo.
  const cab = (icono, color, titulo, sub = '', extra = '') => `<div class="g-cab"><div class="crece"><h4><span style="color:${color}">${X.ic(icono, 16)}</span>${titulo}</h4>${sub ? `<p>${sub}</p>` : ''}</div>${extra}</div>`;

  // Días seguidos del período (en la zona del bot) para que los gráficos no salten días sin datos.
  function diasDelRango(desde, hasta, zona, conDatos) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' });
    const inicio = desde || (conDatos.length ? new Date(conDatos[0] + 'T12:00').getTime() : hasta - 29 * DIA);
    if ((hasta - inicio) / DIA > 400) return conDatos;
    const lista = [];
    for (let t = inicio; t <= hasta + DIA / 2; t += DIA) { const d = f.format(new Date(t)); if (!lista.includes(d)) lista.push(d); }
    return lista;
  }
  const ultimos12Meses = () => {
    const h = new Date(), lista = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(h.getFullYear(), h.getMonth() - i, 1); lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    return lista;
  };
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const etiquetaMes = k => `${MESES[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`;
  const etiquetaDia = k => `${k.slice(8)}/${k.slice(5, 7)}`;

  // ---------- Bloques de Analíticas ----------
  const ORGANICO = 'Sin anuncio (orgánico)';
  const PALETA = ['#0ea5e9', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#ef4444', '#84cc16'];
  // Facebook o Instagram según el enlace del anuncio.
  const red = a => /instagram|ig\.me/i.test(a?.url || '') ? 'instagram' : 'facebook';
  const iconoRed = a => `<span class="red-ic ${red(a)}" title="${red(a) === 'instagram' ? 'Instagram' : 'Facebook'}">${X.ic(red(a), 12)}</span>`;
  // Montos cortos para los ejes: "S/80", "$1,2 M".
  const ejeDinero = moneda => v => X.dineroSimbolo(v, moneda, { decimales: 0, compacto: true }).replace(' ', '');

  function bloqueAnuncios(m) {
    const conAnuncio = m.anuncios.filter(a => a.titulo !== ORGANICO);
    const total = m.anuncios.reduce((a, x) => a + x.monto, 0);
    const atribuido = conAnuncio.reduce((a, x) => a + x.monto, 0);
    const max = Math.max(...conAnuncio.map(a => a.monto), 1);
    const insignias = conAnuncio.length ? `<div class="fila" style="gap:6px"><span class="insignia-g verde">${X.ic('cadena', 13)} Atribuido: ${X.dineroSimbolo(atribuido, m.moneda)}</span><span class="insignia-g azul">${X.ic('porcentaje', 13)} ${total ? Math.round(atribuido / total * 100) : 0}% atribuido</span></div>` : '';
    return `<div class="tarjeta">${cab('megafono', '#e5484d', 'Anuncios que más venden', 'Top 10 anuncios por ingresos en el período seleccionado', insignias)}
      ${conAnuncio.length ? `<div class="barras-h">${conAnuncio.map((a, i) => `<div class="bh-fila" title="${esc(a.titulo)} · ${a.ventas} ${a.ventas === 1 ? 'venta' : 'ventas'} · ${X.dineroSimbolo(a.monto, m.moneda)}">
          <span class="bh-nombre">${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.titulo)}</a>` : esc(a.titulo)}</span>${iconoRed(a)}
          <div class="bh-pista"><span style="width:${Math.max(2, a.monto / max * 100).toFixed(1)}%;background:${PALETA[i % PALETA.length]}"></span></div>
          <b class="bh-valor">${X.dineroSimbolo(a.monto, m.moneda)}</b></div>`).join('')}</div>`
        : `<div class="vacio grande"><span class="vacio-ic">${X.ic('megafono', 40)}</span><b>Sin datos de anuncios</b>Conecta tus anuncios de Meta (Click a WhatsApp) para ver qué campaña vende más.</div>`}</div>`;
  }

  // Fila de 3: embudo en barras, etiquetas más usadas (dona) y ventas por rama del distribuidor principal.
  function bloqueEmbudo(m, p) {
    const e = m.embudo, base = Math.max(e.contactos, 1);
    const barra = (icono, color, nombre, n, degradado) => `<div class="emb-fila"><span class="emb-nombre"><i style="color:${color}">${X.ic(icono, 15)}</i>${nombre}</span>
      <div class="emb-pista"><span style="width:${n ? Math.max(9, n / base * 100) : 9}%;background:${n ? degradado : '#94a3b8'}">${n}</span></div><small>${(n / base * 100).toFixed(1).replace(/\.0$/, '')}%</small></div>`;
    const etiquetas = Object.entries(m.etiquetas).sort((a, z) => z[1] - a[1]).slice(0, 8);
    const dist = m.distribuidores.map(d => ({ ...d, ventas: d.salidas.reduce((a, s) => a + s.ventas, 0) })).sort((a, z) => z.ventas - a.ventas)[0];
    return `<div class="fila3">
      <div class="tarjeta">${cab('embudo', '#6366f1', 'Embudo de conversión', `Leads → Pendientes → Compradores (${p})`)}
        <div class="embudo">${barra('usuarios', '#3b82f6', 'Leads', e.contactos, 'linear-gradient(90deg,#5eead4,#0d9488)')}
          ${barra('reloj', '#f59e0b', 'Pendientes', e.pendientes, 'linear-gradient(90deg,#fcd34d,#f59e0b)')}
          ${barra('checkCirculo', '#17a366', 'Compradores', e.compradores, 'linear-gradient(90deg,#34d399,#0d9488)')}</div>
        <p class="ayuda" style="margin:10px 0 0">Porcentajes sobre el total de leads del período.</p></div>
      <div class="tarjeta">${cab('etiqueta', '#f59e0b', 'Top etiquetas', 'Las 8 etiquetas más usadas')}
        ${etiquetas.length ? '<div class="lienzo bajo"><canvas id="g-etiquetas"></canvas></div>' : '<div class="vacio">Aún no hay contactos etiquetados.</div>'}</div>
      <div class="tarjeta">${cab('dividir', '#8b5cf6', 'Distribuidores principales', dist ? `Ventas por rama · ${esc(dist.flujo)}` : 'Ventas por rama del distribuidor principal')}
        ${dist && dist.ventas ? `<div class="embudo">${dist.salidas.map((s, i) => `<div class="emb-fila"><span class="emb-nombre"><i class="punto-s" style="background:${PALETA[i % PALETA.length]}"></i>${esc(s.nombre)}</span>
            <div class="emb-pista"><span style="width:${Math.max(9, s.ventas / Math.max(...dist.salidas.map(x => x.ventas), 1) * 100)}%;background:${PALETA[i % PALETA.length]}">${s.ventas}</span></div><small>${s.conversion.toFixed(1).replace(/\.0$/, '')}%</small></div>`).join('')}</div>
            <p class="ayuda" style="margin:10px 0 0">El % es la conversión de cada rama (ventas ÷ leads).</p>`
          : `<div class="vacio">${dist ? 'Sin ventas atribuidas aún.' : 'Agrega un nodo «Distribuidor» en un flujo para ver esta comparación.'}</div>`}</div></div>`;
  }
  function graficoEtiquetas(m) {
    const etiquetas = Object.entries(m.etiquetas).sort((a, z) => z[1] - a[1]).slice(0, 8);
    if (!etiquetas.length) return;
    const colores = etiquetas.map(([e], i) => /pagad/i.test(e) ? '#22c55e' : /rechaz|no pag/i.test(e) ? '#ef4444' : PALETA[i % PALETA.length]);
    grafico('g-etiquetas', { type: 'doughnut', data: { labels: etiquetas.map(x => x[0]), datasets: [{ data: etiquetas.map(x => x[1]), backgroundColor: colores, borderWidth: 2, borderColor: '#fff' }] },
      options: { cutout: '62%', interaction: { mode: 'nearest' }, plugins: { legend: { position: 'right', align: 'center', labels: { usePointStyle: false, boxWidth: 12, boxHeight: 12 } } } } });
  }

  // Actividad por hora y por día: barras de contactos + línea de ventas en dinero (eje derecho).
  const bloqueActividad = p => `<div class="graficos" style="margin-top:16px">
      <div class="tarjeta">${cab('reloj', '#e5484d', 'Actividad por hora', `Contactos vs. ventas por hora (${p})`)}<div class="lienzo"><canvas id="g-horas"></canvas></div></div>
      <div class="tarjeta">${cab('calendario', '#3b82f6', 'Distribución por día de la semana', `Contactos vs. ventas (${p})`)}<div class="lienzo"><canvas id="g-semana"></canvas></div></div></div>`;
  function graficosActividad(m) {
    const dinero = ejeDinero(m.moneda);
    const combo = (id, etiquetas, datos, cBarra, cLinea) => grafico(id, { data: { labels: etiquetas, datasets: [
      { type: 'line', label: 'Ventas', data: datos.map(x => x.monto), borderColor: cLinea, backgroundColor: cLinea, tension: .4, pointRadius: 3, borderWidth: 2.5, yAxisID: 'y2', order: 0 },
      { type: 'bar', label: 'Contactos', data: datos.map(x => x.contactos), backgroundColor: cBarra + '40', borderColor: cBarra, borderWidth: 1.5, borderRadius: 4, yAxisID: 'y', order: 1 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, y2: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { callback: dinero } }, x: { grid: { display: false } } },
        plugins: { tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y2' ? `Ventas: ${X.dinero(c.raw, m.moneda)}` : `Contactos: ${c.raw}` } } } } });
    combo('g-horas', m.porHora.map((_, h) => (h % 12 || 12) + (h < 12 ? 'am' : 'pm')), m.porHora, '#f43f5e', '#10b981');
    combo('g-semana', ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], m.porDia, '#0ea5e9', '#f59e0b');
  }
  // Área suave con degradado (como en las capturas de referencia).
  const area = (color) => c => { const g = c.chart.ctx.createLinearGradient(0, 0, 0, c.chart.height || 240); g.addColorStop(0, color + '55'); g.addColorStop(1, color + '05'); return g; };
  const barraHueca = color => ({ backgroundColor: color + '30', borderColor: color, borderWidth: 1.5, borderRadius: 6, borderSkipped: false, maxBarThickness: 26 });

  const FILAS_COMP = [
    ['ingresos', 'Ingresos (período)', 'dinero'], ['compradores', 'Compradores'], ['contactos', 'Contactos (período)'], ['ticket', 'Ticket promedio', 'dinero'],
    ['conversion', 'Tasa de conversión', 'pct'], ['repeticion', 'Tasa de repetición', 'pct'], ['transacciones', 'Transacciones'],
    ['leads', 'Leads (total)'], ['pendientes', 'Pendientes (total)'], ['compradoresTotal', 'Compradores (total)']
  ];
  function bloqueComparativo(m) {
    const { actual, anterior } = m.comparativo;
    const ver = (v, tipo) => v === null || v === undefined ? '—' : tipo === 'dinero' ? X.dinero(v, m.moneda) : tipo === 'pct' ? v.toFixed(1).replace(/\.0$/, '') + '%' : v;
    const variacion = (a, b, clave) => {
      if (!anterior || a === null || b === null || b === undefined) return '<span class="tenue">—</span>';
      if (!b) return a ? '<span class="var sube">▲ nuevo</span>' : '<span class="tenue">—</span>';
      const p = (a - b) / Math.abs(b) * 100;
      const bueno = clave === 'pendientes' ? p <= 0 : p >= 0;
      return Math.abs(p) < .05 ? '<span class="tenue">0%</span>' : `<span class="var ${bueno ? 'sube' : 'baja'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%</span>`;
    };
    const ahora = new Date(), mesA = MESES[ahora.getMonth()], mesB = MESES[(ahora.getMonth() + 11) % 12];
    return `<div class="tarjeta">${cab('tabla', '#64748b', 'Comparativo de períodos', '', `<span class="g-nota">Mes actual (${mesA}) vs mes anterior (${mesB})</span>`)}
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Métrica</th><th>Mes actual</th><th>Mes anterior</th><th>Variación</th></tr></thead><tbody>
      ${FILAS_COMP.map(([k, n, t]) => `<tr><td>${n}</td><td><b>${ver(actual[k], t)}</b></td><td>${anterior ? ver(anterior[k], t) : '—'}</td><td>${variacion(actual[k], anterior?.[k], k)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }

  const COLS_HIST = [['nombre', 'Nombre'], ['telefono', 'Teléfono'], ['bot', 'Bot'], ['ts', 'Fecha de compra'], ['monto', 'Valor pagado'], ['anuncio', 'Anuncio'], ['origen', 'Origen']];
  function filasHistorial() {
    const h = estado.hist, q = sinTildes(h.buscar);
    const lista = ultimo.historial.map(v => ({ ...v, origen: v.manual ? 'Manual' : 'Comprobante', anuncioTxt: v.anuncio?.titulo || '' }))
      .filter(v => !q || sinTildes(`${v.nombre} ${v.telefono} ${v.bot} ${v.anuncioTxt}`).includes(q));
    const clave = h.orden === 'anuncio' ? 'anuncioTxt' : h.orden;
    return lista.sort((a, z) => { const x = a[clave] ?? '', y = z[clave] ?? ''; return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * h.dir; });
  }
  function pintarHistorial() {
    const caja = $('#historial'); if (!caja) return;
    const h = estado.hist, lista = filasHistorial(), paginas = Math.max(1, Math.ceil(lista.length / h.porPagina));
    h.pagina = Math.min(h.pagina, paginas);
    const trozo = lista.slice((h.pagina - 1) * h.porPagina, h.pagina * h.porPagina);
    const multi = idsActuales.length > 1;
    const cols = COLS_HIST.filter(([k]) => multi || k !== 'bot');
    caja.innerHTML = `<div class="tabla-scroll"><table class="tabla"><thead><tr><th style="width:44px">#</th>${cols.map(([k, n]) => `<th class="ordenable${h.orden === k ? ' activo' : ''}" onclick="X.ordenHistorial('${k}')">${n} <span>${h.orden === k ? (h.dir < 0 ? '▼' : '▲') : '↕'}</span></th>`).join('')}</tr></thead><tbody>
      ${trozo.length ? trozo.map((v, i) => `<tr><td class="tenue">${(h.pagina - 1) * h.porPagina + i + 1}</td>
        ${cols.map(([k]) => `<td>${k === 'nombre' ? esc(v.nombre || '—') : k === 'telefono' ? (v.telefono ? '+' + esc(v.telefono) : '—') : k === 'bot' ? esc(v.bot) : k === 'ts' ? `${X.fecha(v.ts)} <span class="tenue">${X.hora(v.ts)}</span>`
          : k === 'monto' ? `<b class="monto-v">${X.dinero(v.monto, v.moneda || ultimo.moneda)}</b>`
          : k === 'anuncio' ? (v.anuncio ? `<div class="anuncio-c">${iconoRed(v.anuncio)}<span>${esc(v.anuncio.titulo || 'Anuncio')}</span></div>${v.anuncio.url ? `<a class="ver-anuncio" href="${esc(v.anuncio.url)}" target="_blank" rel="noopener">${X.ic('externo', 11)} Ver anuncio</a>` : ''}` : '<span class="tenue">Orgánico</span>')
          : `<span class="chip${v.manual ? '' : ' verde'}">${v.origen}</span>`}</td>`).join('')}</tr>`).join('')
        : `<tr class="fila-vacia"><td colspan="${cols.length + 1}">${X.ic('documento', 18)} ${h.buscar ? 'Ninguna venta coincide con la búsqueda.' : 'Sin ventas en el período seleccionado.'}</td></tr>`}
      </tbody></table></div>
      ${lista.length ? `<div class="paginacion"><span>Mostrando ${(h.pagina - 1) * h.porPagina + 1}–${(h.pagina - 1) * h.porPagina + trozo.length} de ${lista.length}</span>
        <button class="btn chico" ${h.pagina <= 1 ? 'disabled' : ''} onclick="X.paginaHistorial(-1)">Anterior</button><b>${h.pagina} / ${paginas}</b>
        <button class="btn chico" ${h.pagina >= paginas ? 'disabled' : ''} onclick="X.paginaHistorial(1)">Siguiente</button></div>` : ''}`;
  }
  const bloqueHistorial = () => `<div class="tarjeta">
    <div class="g-cab fila"><h4 class="crece"><span style="color:#17a366">${X.ic('recibo', 16)}</span>Historial de ventas</h4>
      <label class="buscador chico">${X.ic('buscar', 15)}<input placeholder="Buscar por nombre o teléfono…" value="${esc(estado.hist.buscar)}" oninput="X.buscarHistorial(this.value)"></label>
      <select class="chico" onchange="X.porPaginaHistorial(this.value)">${[10, 20, 50, 100].map(n => `<option value="${n}"${estado.hist.porPagina === n ? ' selected' : ''}>${n} por página</option>`).join('')}</select></div>
    <div id="historial"></div></div>`;

  const bloqueExportar = () => `<div class="tarjeta">${cab('descargar', '#0d9488', 'Exportar datos', 'Descarga la información del período y de los bots seleccionados. Se abre en Excel o Google Sheets.')}
    <div class="exportar">
      <button class="exp" onclick="X.exportar('ventas')"><span class="exp-ic" style="--c:#17a366">${X.ic('recibo', 20)}</span><div><b>Ventas</b><small>Cliente, teléfono, fecha, valor, anuncio</small></div>${X.ic('descargar', 17)}</button>
      <button class="exp" onclick="X.exportar('contactos')"><span class="exp-ic" style="--c:#3b82f6">${X.ic('usuarios', 20)}</span><div><b>Contactos</b><small>Leads, compradores y pendientes</small></div>${X.ic('descargar', 17)}</button>
      <button class="exp" onclick="X.exportar('anuncios')"><span class="exp-ic" style="--c:#e5484d">${X.ic('megafono', 20)}</span><div><b>Anuncios</b><small>Ventas e ingresos por anuncio</small></div>${X.ic('descargar', 17)}</button>
      <button class="exp" onclick="X.exportar('resumen')"><span class="exp-ic" style="--c:#8b5cf6">${X.ic('tabla', 20)}</span><div><b>Resumen</b><small>Métricas del período y comparativo mensual</small></div>${X.ic('descargar', 17)}</button>
    </div></div>`;

  // ---------- Analíticas (varios bots) ----------
  async function pintarAnaliticas(el) {
    limpiar(); X.alSalir = limpiar;
    if (!estado.bots) estado.bots = new Set();
    for (const x of X.bots) if (!estado.conocidos.has(x.id)) { estado.conocidos.add(x.id); estado.bots.add(x.id); }
    idsActuales = X.bots.filter(b => estado.bots.has(b.id)).map(b => b.id);
    const [desde, hasta] = rango();
    const m = ultimo = await X.api(`/metricas?bots=${idsActuales.join(',')}&desde=${desde}&hasta=${hasta}`);
    const $$$ = n => X.dinero(n, m.moneda);
    const dias = diasDelRango(desde, hasta, m.zona, Object.keys({ ...m.ingresosDiarios, ...m.contactosDiarios }).sort());

    const monedas = [...new Set(X.bots.filter(b => idsActuales.includes(b.id)).map(b => b.moneda))];
    el.innerHTML = `${tarjetasBots()}${barraPeriodo('periodoMetricas')}
      ${monedas.length > 1 ? `<div class="nota gris">${X.ic('info')} Los bots elegidos cobran en monedas distintas (${monedas.join(', ')}). Los totales suman las cifras sin convertir y se muestran en ${esc(m.moneda)}. Para ver valores exactos, elige solo bots con la misma moneda.</div>` : ''}
      <div class="kpis">
        ${kpi('usuarios', '#12b5a6', 'Compradores', m.compradores, 'en el período')}
        ${kpi('dinero', '#17a366', 'Total facturado', $$$(m.facturado), cambio(m.facturado, m.anterior.ingresos) + ' vs. período anterior')}
        ${kpi('etiqueta', '#3b82f6', 'Ticket promedio', $$$(m.ticket), 'facturado ÷ compradores')}
        ${kpi('sube', '#8b5cf6', 'Tasa de conversión', m.conversion.toFixed(1) + '%', 'compradores ÷ contactos')}
        ${kpi('mensaje', '#6366f1', 'Contactos', m.contactos, cambio(m.contactos, m.anterior.contactos) + ' vs. período anterior')}
        ${kpi('billetera', '#f59e0b', 'Ingresos totales', $$$(m.ingresosTotales), 'desde el inicio')}
        ${kpi('repetir', '#ef4444', 'Tasa de repetición', m.repeticion.toFixed(1) + '%', 'clientes que vuelven a comprar')}
        ${kpi('recibo', '#64748b', 'Transacciones', m.transacciones, 'pagos validados')}
      </div>
      ${bloqueIngresos(m, nombrePeriodo())}
      <div style="margin-top:16px">${bloqueEmbudo(m, nombrePeriodo())}</div>
      ${bloqueActividad(nombrePeriodo())}
      <div style="margin-top:16px">${bloqueAnuncios(m)}${bloqueComparativo(m)}${bloqueHistorial()}${bloqueExportar()}</div>`;
    pintarHistorial();
    graficosIngresos(m, dias);
    graficoEtiquetas(m);
    graficosActividad(m);
  }

  // Ingresos por día (área verde) y por mes (barras con borde), como en el panel de referencia.
  const bloqueIngresos = (m, p) => `<div class="graficos">
      <div class="tarjeta">${cab('linea', '#17a366', `Ingresos — ${p === 'todo' ? 'todo el tiempo' : p}`, 'Monto recibido por día', `<span class="g-total">${X.dineroSimbolo(m.facturado, m.moneda)}</span>`)}<div class="lienzo"><canvas id="g-dias"></canvas></div></div>
      <div class="tarjeta">${cab('barras', '#0ea5e9', 'Ingresos — últimos 12 meses', 'Monto facturado mes a mes')}<div class="lienzo"><canvas id="g-ing-meses"></canvas></div></div></div>`;
  function graficosIngresos(m, dias) {
    const dinero = ejeDinero(m.moneda), meses = ultimos12Meses(), verde = '#10b981', cian = '#0ea5e9';
    const tip = { tooltip: { callbacks: { label: c => `Ingresos: ${X.dinero(c.raw, m.moneda)}` } } };
    grafico('g-dias', { type: 'line', data: { labels: dias.map(etiquetaDia), datasets: [
      { label: 'Ingresos', data: dias.map(d => m.ingresosDiarios[d] || 0), borderColor: verde, backgroundColor: area(verde), fill: true, tension: .4, pointRadius: dias.length > 45 ? 0 : 3, pointBackgroundColor: verde, borderWidth: 2.5 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { callback: dinero } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 15, maxRotation: 45 } } }, plugins: tip } });
    grafico('g-ing-meses', { type: 'bar', data: { labels: meses.map(etiquetaMes), datasets: [{ label: 'Ingresos', data: meses.map(x => m.ingresosMensuales[x] || 0), ...barraHueca(cian) }] },
      options: { scales: { y: { beginAtZero: true, ticks: { callback: dinero } }, x: { grid: { display: false }, ticks: { maxRotation: 45 } } }, plugins: tip } });
  }

  // ---------- Dashboard (solo el bot elegido arriba) ----------
  async function pintarDashboard(el) {
    limpiar(); X.alSalir = limpiar;
    const b = X.bot();
    idsActuales = [X.botId];
    const [desde, hasta] = rango();
    const m = ultimo = await X.api(`/metricas?bots=${X.botId}&desde=${desde}&hasta=${hasta}`);
    const $$$ = n => X.dinero(n, m.moneda), p = nombrePeriodo();
    // En las tarjetas pequeñas: "$ 1.078.200" (símbolo corto) para que el monto quepa entero.
    const corto = n => X.dineroSimbolo(n, m.moneda, { decimales: n >= 1000 || !(n % 1) ? 0 : 2 });
    const dias = diasDelRango(desde, hasta, m.zona, Object.keys({ ...m.contactosDiarios, ...m.compradoresDiarios }).sort());
    const meses = ultimos12Meses();
    const c = b.conexion?.estado;

    el.innerHTML = `<div class="dash-cab">
        <div class="dash-bot"><span class="bot-ic">${X.robot(30)}</span><div><b>${esc(b.nombre)}</b><small>${c === 'conectado' ? '+' + esc(b.conexion.numero || '') : 'Sin número conectado'}</small></div></div>
        <div class="fila dash-ajustes">
          <label class="selector-pill" title="Moneda de este bot">${X.ic('monedas', 16)}<select onchange="X.guardarBot({moneda:this.value}).then(X.ir)">${MONEDAS.map(x => `<option value="${x}"${x === b.moneda ? ' selected' : ''}>${x} — ${NOMBRE_MONEDA[x]}</option>`).join('')}</select></label>
          <label class="selector-pill" title="Zona horaria de este bot">${X.ic('mundo', 16)}<select onchange="X.guardarBot({zona:this.value}).then(X.ir)">${ZONAS.map(x => `<option${x === b.zona ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
          <span class="estado ${c === 'conectado' ? 'si' : c && c !== 'desconectado' ? 'medio' : ''}">${c === 'conectado' ? 'Conectado' : c && c !== 'desconectado' ? 'Conectando…' : 'Desconectado'}</span>
        </div></div>
      ${barraPeriodo('periodoMetricas')}
      <div class="kpis kpis3">
        ${kpi('usuarios', '#12b5a6', `Contactos (${p})`, m.contactos)}
        ${kpi('tarjeta', '#64748b', `Pendientes (${p})`, m.embudo.pendientes)}
        ${kpi('carrito', '#17a366', `Compraron (${p})`, m.compradores)}
      </div>
      <div class="kpis kpis5">
        ${kpi('dinero', '#12b5a6', `Ingresos (${p})`, corto(m.facturado), m.moneda, true)}
        ${kpi('hucha', '#2dd4bf', 'Ingresos totales', corto(m.ingresosTotales), m.moneda, true)}
        ${kpi('recibo', '#0f766e', `Ticket (${p})`, corto(m.ticket), m.moneda, true)}
        ${kpi('porcentaje', '#14b8a6', `Conversión (${p})`, m.conversion.toFixed(1).replace(/\.0$/, '') + '%', '', true)}
        ${kpi('repetir', '#64748b', 'Recurrencia', m.repeticion.toFixed(1).replace(/\.0$/, '') + '%', '', true)}
      </div>
      <div class="graficos">
        <div class="tarjeta">${cab('usuarios', '#f43f5e', `Contactos — ${p === 'todo' ? 'todo el tiempo' : p}`, 'Total vs. compradores por día')}<div class="lienzo"><canvas id="g-contactos"></canvas></div></div>
        <div class="tarjeta">${cab('carrito', '#17a366', 'Ventas — últimos 12 meses', 'Contactos totales vs. compradores por mes')}<div class="lienzo"><canvas id="g-meses"></canvas></div></div>
      </div>
      <div style="margin-top:16px">${bloqueIngresos(m, p)}</div>
      <div style="margin-top:16px">${bloqueEmbudo(m, p)}</div>
      ${bloqueActividad(p)}
      <div style="margin-top:16px">${bloqueAnuncios(m)}${bloqueUltimasVentas(m)}</div>`;

    const rosa = '#f43f5e', verde = '#10b981';
    const puntos = etiquetas => etiquetas.length > 45 ? 0 : 3;
    grafico('g-contactos', { type: 'line', data: { labels: dias.map(etiquetaDia), datasets: [
      { label: 'Total', data: dias.map(d => m.contactosDiarios[d] || 0), borderColor: rosa, backgroundColor: area(rosa), fill: true, tension: .4, pointRadius: puntos(dias), pointBackgroundColor: rosa, borderWidth: 2.5 },
      { label: 'Compraron', data: dias.map(d => m.compradoresDiarios[d] || 0), borderColor: verde, backgroundColor: area(verde), fill: true, tension: .4, pointRadius: puntos(dias), pointBackgroundColor: verde, borderWidth: 2.5 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 15, maxRotation: 45 } } } } });
    grafico('g-meses', { type: 'bar', data: { labels: meses.map(etiquetaMes), datasets: [
      { label: 'Total', data: meses.map(x => m.contactosMensuales[x] || 0), ...barraHueca(rosa) },
      { label: 'Compraron', data: meses.map(x => m.compradoresMensuales[x] || 0), ...barraHueca(verde) }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false }, ticks: { maxRotation: 45 } } } } });
    graficosIngresos(m, diasDelRango(desde, hasta, m.zona, Object.keys(m.ingresosDiarios).sort()));
    graficoEtiquetas(m);
    graficosActividad(m);
  }

  // Las 10 compras más recientes del bot, con botón al reporte completo.
  function bloqueUltimasVentas(m) {
    const ventas = m.historial.slice(0, 10);
    const simbolo = v => X.dineroSimbolo(v.monto, v.moneda || m.moneda);
    return `<div class="tarjeta ultimas">
      <div class="ultimas-cab"><span class="sec-ic">${X.ic('documento', 18)}</span><div class="crece"><h3>Últimas ventas</h3><p>Las 10 compras más recientes</p></div>
        <a class="btn rojo" href="#/reportes">${X.ic('linea', 15)} Ver reporte completo</a></div>
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th style="width:40px">#</th><th>Nombre</th><th>Teléfono</th><th>Fecha</th><th style="text-align:right">Monto</th><th>Anuncio</th></tr></thead><tbody>
      ${ventas.length ? ventas.map((v, i) => `<tr><td class="tenue">${i + 1}</td><td><b>${esc(v.nombre || '—')}</b></td><td class="tenue">${esc(v.telefono || '—')}</td>
        <td class="tenue">${new Date(v.ts).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${X.hora(v.ts)}</td>
        <td style="text-align:right;white-space:nowrap"><b class="monto-v">${simbolo(v)}</b> <small class="tenue">${esc(v.moneda || m.moneda)}</small></td>
        <td>${v.anuncio ? `<div class="anuncio-c">${iconoRed(v.anuncio)}<span>${esc(v.anuncio.titulo || 'Anuncio')}</span></div>${v.anuncio.url ? `<a class="ver-anuncio" href="${esc(v.anuncio.url)}" target="_blank" rel="noopener">${X.ic('externo', 11)} Ver anuncio</a>` : ''}` : '<span class="tenue">Orgánico</span>'}</td></tr>`).join('')
        : `<tr class="fila-vacia"><td colspan="6">${X.ic('documento', 18)} Sin ventas en el período seleccionado.</td></tr>`}
      </tbody></table></div></div>`;
  }

  X.periodoMetricas = p => { estado.periodo = p; X.ir(); };
  X.fechaMetricas = (campo, valor) => { estado[campo] = valor; X.ir(); };
  X.alternarBotMetricas = id => { estado.bots.has(id) ? estado.bots.delete(id) : estado.bots.add(id); X.ir(); };
  X.todosBotsMetricas = si => { estado.bots = new Set(si ? X.bots.map(b => b.id) : []); X.ir(); };
  X.buscarBotMetricas = q => {
    estado.buscarBot = q;
    const q2 = sinTildes(q);
    $$('.bots-grid .bot-card:not(.nuevo)').forEach((c, i) => {
      const b = X.bots[i];
      c.classList.toggle('oculto', Boolean(q2) && !sinTildes(b.nombre + ' ' + (b.conexion.numero || '')).includes(q2));
    });
  };
  X.irAlBot = id => { X.elegirBot(id, true); X.pintarBarra(); location.hash = '#/dashboard'; };
  X.buscarHistorial = q => { estado.hist.buscar = q; estado.hist.pagina = 1; pintarHistorial(); };
  X.porPaginaHistorial = n => { estado.hist.porPagina = Number(n); estado.hist.pagina = 1; pintarHistorial(); };
  X.paginaHistorial = d => { estado.hist.pagina += d; pintarHistorial(); };
  X.ordenHistorial = k => { const h = estado.hist; h.dir = h.orden === k ? -h.dir : (k === 'ts' || k === 'monto' ? -1 : 1); h.orden = k; pintarHistorial(); };

  // ---------- Exportar (CSV que abre Excel) ----------
  const celda = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  function descargarCsv(nombre, filas) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `orvix-${nombre}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  X.exportar = async tipo => {
    if (!ultimo) return;
    const m = ultimo;
    if (tipo === 'ventas') {
      if (!m.historial.length) return X.aviso('No hay ventas en este período.', true);
      descargarCsv('ventas', [['Bot', 'Cliente', 'Telefono', 'Fecha', 'Valor pagado', 'Moneda', 'Anuncio', 'Enlace del anuncio', 'Origen'],
        ...filasHistorial().map(v => [v.bot, v.nombre, v.telefono, new Date(v.ts).toLocaleString('es'), v.monto, v.moneda || m.moneda, v.anuncioTxt, v.anuncio?.url || '', v.origen])]);
    } else if (tipo === 'contactos') {
      const [desde, hasta] = rango();
      const filas = await X.intentar(() => X.api(`/reporte?bots=${idsActuales.join(',')}&desde=${desde}&hasta=${hasta}`));
      if (!filas) return;
      if (!filas.length) return X.aviso('No hay contactos en este período.', true);
      descargarCsv('contactos', [['Bot', 'Cliente', 'Telefono', 'Primer contacto', 'Estado', 'Compras', 'Total pagado', 'Etiquetas', 'Anuncio'],
        ...filas.map(f => [f.bot, f.nombre, f.telefono, new Date(f.creado).toLocaleString('es'), f.pagado ? 'Pagado' : 'Pendiente', f.compras, f.total, f.etiquetas.join(', '), f.anuncio])]);
    } else if (tipo === 'anuncios') {
      if (!m.anuncios.length) return X.aviso('No hay ventas con anuncio en este período.', true);
      descargarCsv('anuncios', [['Puesto', 'Anuncio', 'Enlace', 'Ventas', 'Ingresos', 'Moneda'], ...m.anuncios.map((a, i) => [i + 1, a.titulo, a.url, a.ventas, a.monto, m.moneda])]);
    } else {
      const bots = X.bots.filter(b => idsActuales.includes(b.id)).map(b => b.nombre).join(', ');
      const { actual, anterior } = m.comparativo;
      descargarCsv('resumen', [['Bots', bots], ['Período', PERIODOS.find(p => p[0] === estado.periodo)?.[1] || ''], ['Moneda', m.moneda], [],
        ['Métrica', 'Valor del período'], ['Compradores', m.compradores], ['Total facturado', m.facturado], ['Ticket promedio', m.ticket.toFixed(2)], ['Tasa de conversión %', m.conversion.toFixed(1)],
        ['Contactos', m.contactos], ['Ingresos totales', m.ingresosTotales], ['Tasa de repetición %', m.repeticion.toFixed(1)], ['Transacciones', m.transacciones], [],
        ['Comparativo', 'Mes actual', 'Mes anterior'], ...FILAS_COMP.map(([k, n]) => [n, actual[k] ?? '', anterior?.[k] ?? ''])]);
    }
  };

  X.vistas.analiticas = { titulo: 'Analíticas', pintar: pintarAnaliticas };
  X.vistas.dashboard = { titulo: 'Dashboard', pintar: pintarDashboard };

  // ---------- Reportes ----------
  let filas = [];
  const visibles = () => filas.filter(f => (estado.filtro === 'todos' || (estado.filtro === 'compradores') === f.pagado)
    && (!estado.buscar || (f.nombre + ' ' + f.telefono + ' ' + f.etiquetas.join(' ')).toLowerCase().includes(estado.buscar.toLowerCase())));

  function tablaReporte() {
    const lista = visibles();
    $('#reporte-tabla').innerHTML = lista.length ? `<table class="tabla"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Primer contacto</th><th>Estado</th><th>Compras</th><th>Total pagado</th><th>Etiquetas</th><th>Anuncio</th></tr></thead><tbody>
      ${lista.slice(0, 500).map(f => `<tr><td>${esc(f.nombre || '—')}</td><td>+${esc(f.telefono)}</td><td>${X.fecha(f.creado)}</td>
        <td>${f.pagado ? '<span class="chip verde">Pagado</span>' : '<span class="chip">Pendiente</span>'}</td><td>${f.compras}</td><td><b>${X.dinero(f.total)}</b></td>
        <td>${f.etiquetas.map(e => `<span class="chip">${esc(e)}</span>`).join(' ')}</td><td>${esc(f.anuncio || '—')}</td></tr>`).join('')}</tbody></table>
      ${lista.length > 500 ? `<p class="ayuda">Se muestran 500 de ${lista.length}. Exporta para ver todo.</p>` : ''}` : '<div class="vacio"><b>Nada que mostrar</b>Cambia el periodo o los filtros.</div>';
    $('#reporte-resumen').textContent = `${lista.length} contactos · ${lista.filter(f => f.pagado).length} compradores · ${X.dinero(lista.reduce((a, f) => a + f.total, 0))} facturado`;
  }
  X.filtroReporte = (campo, valor) => { estado[campo] = valor; if (campo === 'filtro') X.ir(); else tablaReporte(); };
  X.exportarReporte = () => descargarCsv('reporte', [['Bot', 'Cliente', 'Telefono', 'Primer contacto', 'Estado', 'Compras', 'Total pagado', 'Etiquetas', 'Anuncio'],
    ...visibles().map(f => [f.bot, f.nombre, f.telefono, new Date(f.creado).toLocaleString('es'), f.pagado ? 'Pagado' : 'Pendiente', f.compras, f.total, f.etiquetas.join(', '), f.anuncio])]);

  X.vistas.reportes = {
    titulo: 'Reportes',
    async pintar(el) {
      const [desde, hasta] = rango();
      filas = await X.api(`/reporte?bots=${X.botId}&desde=${desde}&hasta=${hasta}`);
      el.innerHTML = `${barraPeriodo('periodoMetricas')}
        <div class="tarjeta"><div class="fila" style="margin-bottom:14px">
          ${[['todos', 'Todos'], ['compradores', 'Solo compradores'], ['pendientes', 'Solo pendientes']].map(([k, n]) => `<button class="chip${estado.filtro === k ? ' activo' : ''}" onclick="X.filtroReporte('filtro','${k}')">${n}</button>`).join('')}
          <input class="crece" placeholder="Buscar por nombre, teléfono o etiqueta…" value="${esc(estado.buscar)}" oninput="X.filtroReporte('buscar',this.value)">
          <button class="btn rojo" onclick="X.exportarReporte()">${X.ic('descargar')} Exportar a Excel (CSV)</button></div>
          <p class="ayuda" id="reporte-resumen" style="margin:0 0 10px"></p><div class="tabla-scroll" id="reporte-tabla"></div></div>`;
      tablaReporte();
    }
  };
})();
