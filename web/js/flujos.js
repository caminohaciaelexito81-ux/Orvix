// Flujos avanzados: lista de flujos y constructor visual en forma de árbol.
(() => {
  const TIPOS = {
    texto: ['mensaje', 'Texto', '#3b82f6'], media: ['imagenes', 'Media', '#17a366'], pausa: ['reloj', 'Pausa', '#f59e0b'],
    condicion: ['ramaGit', 'Condición', '#0ea5b7'], distribuidor: ['mezclar', 'Distribuidor', '#e5484d'], etiqueta: ['etiqueta', 'Etiquetar', '#ec4899'],
    ia: ['bot', 'IA on/off', '#3b82f6'], remarketing: ['megafono', 'Remarketing', '#dc2626']
  };
  const AYUDA = {
    distribuidor: 'Reparte a los clientes por turnos entre las salidas. Sirve para variar los mensajes (menos bloqueos) y para comparar guiones.',
    condicion: 'Hace una pregunta y sigue por Sí, No u Otros según lo que responda el cliente.'
  };
  // Colores de las salidas del Distribuidor (se repiten si hay más).
  const COLORES_SALIDA = ['#e5484d', '#3b82f6', '#17a366', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5b7'];
  const MUESTRA_CHIPS = 4;
  const CON_RAMAS = ['condicion', 'distribuidor'];
  const UNIDADES = [['s', 'Segundos'], ['m', 'Minutos'], ['h', 'Horas'], ['d', 'Días']];
  const NUEVO = {
    texto: () => ({ texto: '' }),
    media: () => ({ archivoId: '', caption: '' }),
    pausa: () => ({ cantidad: 5, unidad: 's' }),
    condicion: () => ({
      pregunta: '', opcionA: ['si', 'claro', 'dale', 'ok', 'okay', 'por supuesto', 'quiero', 'lo quiero', 'quiero recibirlo', 'de una', 'listo', 'bueno', 'va'],
      opcionB: ['no', 'nel', 'nah', 'nop', 'no gracias', 'no quiero', 'ahora no', 'despues', 'luego'],
      espera: { cantidad: 30, unidad: 'm' }, ramas: { si: [], no: [], otros: [] }
    }),
    distribuidor: () => ({ salidas: [{ id: idCorto('s'), nombre: 'Salida 1', nodos: [] }, { id: idCorto('s'), nombre: 'Salida 2', nodos: [] }] }),
    etiqueta: () => ({ etiqueta: '' }),
    ia: () => ({ activar: true }),
    remarketing: () => ({ minutos: 15, desde: '07:00', hasta: '21:00', pasos: [{ tipo: 'texto', texto: '' }] })
  };
  const crear = tipo => ({ id: idCorto('n'), tipo, ...NUEVO[tipo]() });

  let flujo = null, reg = [], zoom = 1, copiado = null, sucio = false, reloj = null;

  function clonar(nodo) {
    const copia = JSON.parse(JSON.stringify(nodo));
    (function renovar(n) {
      n.id = idCorto('n');
      if (n.ramas) for (const k in n.ramas) n.ramas[k].forEach(renovar);
      if (n.salidas) n.salidas.forEach(s => { s.id = idCorto('s'); s.nodos.forEach(renovar); });
    })(copia);
    return copia;
  }
  const esRama = n => n && CON_RAMAS.includes(n.tipo);

  // ---------- Guardado ----------
  function marcar() {
    sucio = true;
    const e = $('#estado-guardado');
    if (e) e.textContent = 'Cambios sin guardar…';
    clearTimeout(reloj);
    reloj = setTimeout(guardar, 1500);
  }
  async function guardar(avisar) {
    clearTimeout(reloj);
    if (!flujo) return;
    try {
      await X.api('/flujos/' + flujo.id, { method: 'PUT', body: { nombre: flujo.nombre, nodos: flujo.nodos } });
      sucio = false;
      const e = $('#estado-guardado');
      if (e) e.textContent = 'Guardado';
      if (avisar) X.aviso('Flujo guardado');
    } catch (err) { X.aviso('No se pudo guardar: ' + err.message, true); }
  }

  // ---------- Dibujo ----------
  const attrs = (s, i, k, t) => `data-s="${s}" data-i="${i}" data-k="${k}"${t ? ` data-t="${t}"` : ''}`;
  const opciones = (lista, valor) => lista.map(([v, n]) => `<option value="${v}"${v === valor ? ' selected' : ''}>${n}</option>`).join('');
  const nombreArchivo = id => X.archivos.find(a => a.id === id)?.nombre;
  const botonArchivo = (s, i, k, id) => `<button class="btn chico" data-archivo="${k}" data-s="${s}" data-i="${i}" style="justify-content:flex-start;overflow:hidden">${X.ic('clip')} ${esc(nombreArchivo(id) || (id ? 'Archivo eliminado — elige otro' : 'Elegir archivo…'))}</button>`;

  function cuerpo(n, s, i) {
    switch (n.tipo) {
      case 'texto': return `<textarea ${attrs(s, i, 'texto')} placeholder="Escribe el mensaje…">${esc(n.texto)}</textarea>
        <div class="mini">${X.ic('lapiz', 11)} Doble clic para editar en grande</div>
        <div class="fila" style="gap:5px"><button class="chip" data-var="{nombre}">+ nombre</button><button class="chip" data-var="{telefono}">+ teléfono</button></div>`;
      case 'media': return `${botonArchivo(s, i, 'archivoId', n.archivoId)}<input ${attrs(s, i, 'caption')} value="${esc(n.caption)}" placeholder="Texto que acompaña (opcional)">`;
      case 'pausa': return `<div class="dupla"><input type="number" min="0" ${attrs(s, i, 'cantidad', 'num')} value="${n.cantidad}"><select ${attrs(s, i, 'unidad')}>${opciones(UNIDADES, n.unidad)}</select></div>`;
      case 'condicion': {
        const opcion = (k, clase, icono, titulo) => {
          const lista = n[k];
          return `<div class="opcion ${clase}"><div class="op-tit">${X.ic(icono, 14)} ${titulo} <span>(${lista.length} ${lista.length === 1 ? 'palabra' : 'palabras'})</span></div>
            <div class="op-caja" data-acc="editar-op" data-op="${k}" data-s="${s}" data-i="${i}" title="Clic para editar las palabras">
              <div class="op-chips">${lista.slice(0, MUESTRA_CHIPS).map(p => `<span>${esc(p)}</span>`).join('') || '<em>Sin palabras</em>'}</div>
              <div class="op-pie"><small>${lista.length > MUESTRA_CHIPS ? `+${lista.length - MUESTRA_CHIPS} más` : ''}</small><b>${X.ic('lapiz', 12)} editar</b></div></div></div>`;
        };
        return `<textarea ${attrs(s, i, 'pregunta')} placeholder="Mensaje de pregunta (ej: ¿Te interesa nuestro producto?)">${esc(n.pregunta)}</textarea>
          <div class="mini">${X.ic('lapiz', 11)} Doble clic para editar en grande</div>
          ${opcion('opcionA', 'a', 'checkCirculo', 'Opción A')}${opcion('opcionB', 'b', 'xCirculo', 'Opción B')}
          <div class="espera"><div class="esp-tit">${X.ic('reloj2', 15)} Tiempo máximo de espera</div>
            <div class="dupla"><input type="number" min="1" ${attrs(s, i, 'espera.cantidad', 'num')} value="${n.espera.cantidad}"><select ${attrs(s, i, 'espera.unidad')}>${opciones(UNIDADES, n.espera.unidad)}</select></div>
            <p>Si no coincide o se supera el tiempo, el flujo continúa por «Otros».</p></div>`;
      }
      case 'distribuidor': return `<div class="salidas">${n.salidas.map((sal, j) => `<div class="salida-fila"><span class="punto" style="background:${COLORES_SALIDA[j % COLORES_SALIDA.length]}"></span>
          <input class="plano" ${attrs(s, i, `salidas.${j}.nombre`)} value="${esc(sal.nombre)}" title="Clic para cambiar el nombre"><small class="leads">${flujo.leads?.[sal.id] || 0} leads</small>
          ${n.salidas.length > 1 ? `<button class="icono" data-acc="quitar-salida" data-s="${s}" data-i="${i}" data-j="${j}" title="Quitar salida">${X.ic('x', 14)}</button>` : ''}</div>`).join('')}</div>
        <button class="agregar-salida" data-acc="mas-salida" data-s="${s}" data-i="${i}">${X.ic('mas', 15)} Agregar salida</button>`;
      case 'etiqueta': return `<input ${attrs(s, i, 'etiqueta')} value="${esc(n.etiqueta)}" placeholder="Ej: No pagó, Recibió el producto…">`;
      case 'ia': return `<select ${attrs(s, i, 'activar', 'bool')}>${opciones([['true', 'Encender la IA para este cliente'], ['false', 'Apagar la IA para este cliente']], String(n.activar))}</select>
        <div class="mini">Ponlo al final del guion: así la IA solo responde dudas después de tu presentación.</div>`;
      case 'remarketing': return `<div class="dupla"><input type="number" min="0" ${attrs(s, i, 'minutos', 'num')} value="${n.minutos}"><span class="mini">minutos después de llegar aquí, si no ha pagado</span></div>
        <div><div class="mini">Enviar solo entre estas horas</div><div class="horas"><input type="time" ${attrs(s, i, 'desde')} value="${n.desde}"><span class="mini">y</span><input type="time" ${attrs(s, i, 'hasta')} value="${n.hasta}"></div></div>
        ${n.pasos.map((p, j) => `<div class="paso-rmk"><b>${{ texto: 'TEXTO', pausa: 'ESPERA', media: 'MEDIA' }[p.tipo]}</b><div class="crece">${
          p.tipo === 'texto' ? `<textarea ${attrs(s, i, `pasos.${j}.texto`)} placeholder="Mensaje de recordatorio…">${esc(p.texto)}</textarea>`
          : p.tipo === 'pausa' ? `<div class="dupla"><input type="number" min="1" ${attrs(s, i, `pasos.${j}.minutos`, 'num')} value="${p.minutos}"><span class="mini">minutos</span></div>`
          : botonArchivo(s, i, `pasos.${j}.archivoId`, p.archivoId)}</div>
          <button class="icono" data-acc="quitar-paso" data-s="${s}" data-i="${i}" data-j="${j}" title="Quitar">${X.ic('x', 15)}</button></div>`).join('')}
        <div class="fila" style="gap:5px">${[['texto', 'texto', 'Texto'], ['media', 'imagen', 'Media'], ['pausa', 'reloj', 'Espera']].map(([t, ic, n2]) => `<button class="btn chico" data-acc="mas-paso" data-p="${t}" data-s="${s}" data-i="${i}">${X.ic(ic, 14)} ${n2}</button>`).join('')}</div>
        <div class="mini">Se cancela solo en cuanto el cliente paga. Recomendado: 2 o 3 recordatorios como máximo.</div>`;
    }
    return '';
  }

  function union(s, i, permitirRamas) {
    return `<div class="union"><button class="mas" data-mas="${s},${i},${permitirRamas ? 1 : 0}" title="Agregar un paso aquí (o suelta aquí un paso que arrastras)">${X.ic('mas', 12)}</button></div>`;
  }
  function tarjeta(n, s, i) {
    const [icono, nombre, c] = TIPOS[n.tipo] || ['pregunta', n.tipo, '#888'];
    const acc = a => `data-acc="${a}" data-s="${s}" data-i="${i}"`;
    return `<div class="nodo${['condicion', 'remarketing', 'distribuidor'].includes(n.tipo) ? ' ancho' : ''}${esRama(n) ? ' con-ramas' : ''}" style="--c:${c}" data-nodo="${s},${i}">
      <header${AYUDA[n.tipo] ? ` title="${AYUDA[n.tipo]}"` : ''}><span class="nodo-ic">${X.ic(icono, 15)}</span><b class="crece">${nombre}</b>
      <span class="icono asa" draggable="true" data-arrastre="${s},${i}" title="Arrastra para mover este paso">${X.ic('agarre', 15)}</span>
      <button class="icono" ${acc('copiar')} title="Copiar (luego pega con el +)">${X.ic('copiar', 15)}</button><button class="icono" ${acc('quitar')} title="Eliminar">${X.ic('basura', 15)}</button></header>
      <div class="cuerpo">${cuerpo(n, s, i)}</div></div>`;
  }
  function ramasDe(n) {
    const lista = n.tipo === 'condicion'
      ? [['Sí', n.ramas.si, '#17a366', 'checkCirculo'], ['No', n.ramas.no, '#e5484d', 'xCirculo'], ['Otros', n.ramas.otros, '#f59e0b', 'pregunta']]
      : n.salidas.map((sal, j) => [sal.nombre, sal.nodos, COLORES_SALIDA[j % COLORES_SALIDA.length], '']);
    return `<div class="ramas">${lista.map(([titulo, nodos, c, icono]) => `<div class="rama"><div class="titulo" style="--c:${c}">${icono ? X.ic(icono, 13) : '<i class="punto"></i>'}${esc(titulo)}${nodos.length ? `<small>${nodos.length}</small>` : ''}</div>${secuencia(nodos)}</div>`).join('')}</div>`;
  }
  function secuencia(seq) {
    const s = reg.push(seq) - 1;
    const termina = esRama(seq.at(-1));
    let h = '<div class="sec">';
    seq.forEach((n, i) => { h += union(s, i, false) + tarjeta(n, s, i) + (esRama(n) ? ramasDe(n) : ''); });
    if (!termina) h += union(s, seq.length, true);
    return h + '</div>';
  }
  function dibujar() {
    const lienzo = $('#lienzo');
    if (!lienzo) return;
    const pos = [lienzo.scrollLeft, lienzo.scrollTop];
    reg = [];
    lienzo.innerHTML = `<div class="arbol" style="zoom:${zoom}"><div class="nodo inicio" style="--c:#17a366"><span class="nodo-ic">${X.ic('play', 13)}</span><b>Inicio</b></div>${secuencia(flujo.nodos)}</div>`;
    [lienzo.scrollLeft, lienzo.scrollTop] = pos;
    $('#zoom-valor').textContent = Math.round(zoom * 100) + '%';
  }

  // ---------- Interacción ----------
  function fijar(obj, ruta, valor) {
    const partes = ruta.split('.');
    const ultimo = partes.pop();
    partes.reduce((o, k) => o[k], obj)[ultimo] = valor;
  }
  function alEscribir(e) {
    const d = e.target.dataset;
    if (d.k === undefined) return;
    let v = e.target.value;
    if (d.t === 'num') v = Math.max(0, Number(v) || 0);
    else if (d.t === 'lista') v = v.split(';').map(x => x.trim()).filter(Boolean);
    else if (d.t === 'bool') v = v === 'true';
    fijar(reg[d.s][d.i], d.k, v);
    marcar();
  }
  function abrirMenu(boton) {
    $$('.menu-nodos').forEach(m => m.remove());
    const [s, i, ramas] = boton.dataset.mas.split(',').map(Number);
    const menu = document.createElement('div');
    menu.className = 'menu-nodos';
    menu.innerHTML = Object.entries(TIPOS).filter(([t]) => ramas || !CON_RAMAS.includes(t)).map(([t, [icono, nombre]]) => `<button data-tipo="${t}"><span style="color:${TIPOS[t][2]}">${X.ic(icono, 17)}</span>${nombre}</button>`).join('')
      + (copiado && (ramas || !esRama(copiado)) ? '<button data-tipo="pegar"><span>' + X.ic('portapapeles', 17) + '</span>Pegar lo copiado</button>' : '');
    menu.onclick = e => {
      const tipo = e.target.closest('button')?.dataset.tipo;
      if (!tipo) return;
      reg[s].splice(i, 0, tipo === 'pegar' ? clonar(copiado) : crear(tipo));
      marcar(); dibujar();
    };
    boton.parentElement.append(menu);
  }
  async function alPulsar(e) {
    const mas = e.target.closest('[data-mas]');
    if (mas) return abrirMenu(mas);
    if (!e.target.closest('.menu-nodos')) $$('.menu-nodos').forEach(m => m.remove());

    const variable = e.target.closest('[data-var]');
    if (variable) {
      const area = variable.closest('.cuerpo').querySelector('textarea');
      area.setRangeText(variable.dataset.var, area.selectionStart, area.selectionEnd, 'end');
      area.dispatchEvent(new Event('input', { bubbles: true }));
      return area.focus();
    }
    const adj = e.target.closest('[data-archivo]');
    if (adj) {
      const id = await X.elegirArchivo();
      if (id) { fijar(reg[adj.dataset.s][adj.dataset.i], adj.dataset.archivo, id); marcar(); dibujar(); }
      return;
    }
    const boton = e.target.closest('[data-acc]');
    if (!boton) return;
    const { acc, s, i, j, p } = boton.dataset, seq = reg[s], idx = Number(i), n = seq[idx];
    if (acc === 'editar-op') {
      const k = boton.dataset.op, titulo = k === 'opcionA' ? 'Opción A — respuestas que cuentan como «Sí»' : 'Opción B — respuestas que cuentan como «No»';
      const texto = await editorGrande(titulo, n[k].join('\n'), 'Una palabra o frase por línea (también puedes separarlas con ;). No importan mayúsculas ni tildes.');
      if (texto === null) return;
      n[k] = [...new Set(texto.split(/[\n;]/).map(x => x.trim()).filter(Boolean))];
      marcar(); return dibujar();
    }
    if (acc === 'quitar') {
      if (esRama(n) && !await X.confirmar('¿Eliminar este paso con todo lo que cuelga de él?', 'Sí, eliminar')) return;
      seq.splice(idx, 1);
    } else if (acc === 'subir' || acc === 'bajar') {
      const otro = idx + (acc === 'subir' ? -1 : 1);
      if (otro < 0 || otro >= seq.length || esRama(seq[otro])) return;
      [seq[idx], seq[otro]] = [seq[otro], seq[idx]];
    } else if (acc === 'copiar') { copiado = JSON.parse(JSON.stringify(n)); return X.aviso('Copiado. Pulsa un + y elige "Pegar lo copiado".'); }
    else if (acc === 'mas-salida') n.salidas.push({ id: idCorto('s'), nombre: 'Salida ' + (n.salidas.length + 1), nodos: [] });
    else if (acc === 'quitar-salida') {
      if (n.salidas[j].nodos.length && !await X.confirmar('¿Quitar esta salida con sus pasos?', 'Sí, quitar')) return;
      n.salidas.splice(j, 1);
    } else if (acc === 'mas-paso') n.pasos.push(p === 'texto' ? { tipo: 'texto', texto: '' } : p === 'pausa' ? { tipo: 'pausa', minutos: 60 } : { tipo: 'media', archivoId: '' });
    else if (acc === 'quitar-paso') n.pasos.splice(j, 1);
    marcar(); dibujar();
  }

  // Ventana grande para escribir con comodidad. Devuelve el texto o null si se cancela.
  const editorGrande = (titulo, valor, ayuda = '') => new Promise(ok => {
    const v = X.ventana(`<h3>${esc(titulo)}</h3>${ayuda ? `<p class="ayuda" style="margin:-8px 0 12px">${ayuda}</p>` : ''}
      <textarea style="min-height:300px;font-size:14px">${esc(valor)}</textarea>
      <div class="fila fin" style="margin-top:14px"><button class="btn" data-r="0">Cancelar</button><button class="btn rojo" data-r="1">${X.ic('check')} Aplicar</button></div>`, true);
    const area = $('textarea', v);
    area.focus(); area.setSelectionRange(area.value.length, area.value.length);
    v.addEventListener('click', e => { const r = e.target.closest('[data-r]')?.dataset.r; if (r !== undefined) { v.remove(); ok(r === '1' ? area.value : null); } });
  });
  async function alDobleClic(e) {
    const area = e.target.closest('textarea[data-k]');
    if (!area) return;
    const texto = await editorGrande('Editar mensaje', area.value, 'Para negrita escribe el texto entre *asteriscos*. Usa {nombre} para saludar al cliente por su nombre.');
    if (texto === null) return;
    area.value = texto;
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---------- Arrastrar y soltar pasos ----------
  // Se arrastra desde el asa (⠿) y se suelta sobre cualquier botón +.
  let arrastrando = null;
  const contiene = (n, seq) => n === undefined ? false : (n.ramas && Object.values(n.ramas).some(r => r === seq || r.some(x => contiene(x, seq))))
    || (n.salidas && n.salidas.some(sal => sal.nodos === seq || sal.nodos.some(x => contiene(x, seq))));
  function alEmpezarArrastre(e) {
    const asa = e.target.closest('[data-arrastre]');
    if (!asa) return;
    const [s, i] = asa.dataset.arrastre.split(',').map(Number);
    arrastrando = { s, i };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'paso');
    const nodo = asa.closest('.nodo');
    e.dataTransfer.setDragImage(nodo, 20, 20);
    requestAnimationFrame(() => { nodo.classList.add('moviendo'); $('#lienzo').classList.add('arrastrando'); });
  }
  function alTerminarArrastre() {
    arrastrando = null;
    $$('.nodo.moviendo').forEach(n => n.classList.remove('moviendo'));
    $$('.mas.destino').forEach(b => b.classList.remove('destino'));
    $('#lienzo')?.classList.remove('arrastrando');
  }
  function alPasarArrastre(e) {
    const mas = e.target.closest('[data-mas]');
    $$('.mas.destino').forEach(b => b !== mas && b.classList.remove('destino'));
    if (!mas || !arrastrando) return;
    e.preventDefault();
    mas.classList.add('destino');
  }
  function alSoltar(e) {
    const mas = e.target.closest('[data-mas]');
    if (!mas || !arrastrando) return;
    e.preventDefault();
    const [s2, i2, ramas] = mas.dataset.mas.split(',').map(Number);
    const { s, i } = arrastrando, origen = reg[s], destino = reg[s2], n = origen[i];
    alTerminarArrastre();
    if (esRama(n) && !ramas) return X.aviso('La Condición y el Distribuidor solo pueden ir al final de un camino.', true);
    if (contiene(n, destino)) return X.aviso('No puedes mover un paso dentro de sus propias ramas.', true);
    let destinoIdx = i2;
    if (origen === destino) { if (i2 === i || i2 === i + 1) return; if (i2 > i) destinoIdx--; }
    origen.splice(i, 1);
    destino.splice(destinoIdx, 0, n);
    marcar(); dibujar();
  }

  X.zoomFlujo = d => { zoom = d ? Math.min(1.4, Math.max(.4, +(zoom + d).toFixed(1))) : 1; dibujar(); };
  X.guardarFlujo = () => guardar(true);
  X.duplicarFlujo = async () => {
    await guardar();
    const copia = await X.intentar(() => X.api(`/flujos/${flujo.id}/duplicar`, { method: 'POST' }), 'Flujo duplicado');
    if (copia) location.hash = '#/flujos/' + copia.id;
  };
  X.eliminarFlujo = async () => {
    if (!await X.confirmar(`¿Eliminar el flujo "${flujo.nombre}"?`, 'Sí, eliminar')) return;
    clearTimeout(reloj); sucio = false;
    await X.intentar(() => X.api('/flujos/' + flujo.id, { method: 'DELETE' }), 'Flujo eliminado');
    flujo = null; location.hash = '#/flujos';
  };
  X.nuevoFlujo = async () => {
    const nombre = await X.pedir('Nuevo flujo', '', 'Nombre (por ejemplo: Guion principal)');
    if (!nombre) return;
    const f = await X.intentar(() => X.api(`/bots/${X.botId}/flujos`, { body: { nombre } }));
    if (f) location.hash = '#/flujos/' + f.id;
  };

  async function pintarLista(el) {
    const flujos = await X.api(`/bots/${X.botId}/flujos`);
    el.innerHTML = `<div class="fila" style="margin-bottom:16px"><p class="crece sub" style="margin:0;color:var(--suave)">Aquí construyes tus guiones de venta: textos, audios, pausas, preguntas, variaciones y recordatorios.</p>
      <button class="btn rojo" onclick="X.nuevoFlujo()">${X.ic('mas')} Nuevo flujo</button></div>
      ${flujos.length ? `<div class="lista-flujos">${flujos.map(f => `<a class="flujo-item" href="#/flujos/${f.id}" style="color:inherit"><h3><span class="flujo-ic">${X.ic('red', 20)}</span>${esc(f.nombre)}</h3>
        <p class="ayuda">${f.nodos} ${f.nodos === 1 ? 'nodo' : 'nodos'} · editado ${X.cuando(f.actualizado)}</p></a>`).join('')}</div>`
        : '<div class="tarjeta vacio"><b>Todavía no tienes flujos</b>Crea el primero con el botón "+ Nuevo flujo".</div>'}`;
  }

  async function pintarEditor(el, id) {
    flujo = await X.api('/flujos/' + id);
    X.archivos = await X.api('/archivos');
    sucio = false;
    el.innerHTML = `<div class="fila" style="margin-bottom:12px">
        <a class="btn" href="#/flujos">${X.ic('atras')} Volver</a>
        <input id="nombre-flujo" value="${esc(flujo.nombre)}" style="max-width:280px;font-weight:650">
        <span class="ayuda" id="estado-guardado" style="margin:0;white-space:nowrap;flex:1 0 auto">Guardado</span>
        <div class="fila" style="gap:4px"><button class="btn chico" onclick="X.zoomFlujo(-.1)">−</button><button class="btn chico" id="zoom-valor" onclick="X.zoomFlujo(0)">100%</button><button class="btn chico" onclick="X.zoomFlujo(.1)">+</button></div>
        <button class="btn" onclick="X.duplicarFlujo()">${X.ic('copiar')} Duplicar</button><button class="btn peligro" title="Eliminar flujo" onclick="X.eliminarFlujo()">${X.ic('basura')}</button><button class="btn rojo" onclick="X.guardarFlujo()">${X.ic('guardar')} Guardar</button></div>
      <div class="lienzo-flujo" id="lienzo"></div>`;
    $('#nombre-flujo').oninput = e => { flujo.nombre = e.target.value; marcar(); };
    const lienzo = $('#lienzo');
    lienzo.addEventListener('input', alEscribir);
    lienzo.addEventListener('click', alPulsar);
    lienzo.addEventListener('dblclick', alDobleClic);
    lienzo.addEventListener('dragstart', alEmpezarArrastre);
    lienzo.addEventListener('dragend', alTerminarArrastre);
    lienzo.addEventListener('dragover', alPasarArrastre);
    lienzo.addEventListener('drop', alSoltar);
    dibujar();
    lienzo.scrollLeft = (lienzo.scrollWidth - lienzo.clientWidth) / 2;
    X.alSalir = () => { if (sucio && flujo) guardar(); };
  }

  X.vistas.flujos = { titulo: 'Flujos avanzados', pintar: (el, id) => id ? pintarEditor(el, id) : pintarLista(el) };
})();
