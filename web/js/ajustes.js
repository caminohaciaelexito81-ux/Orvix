// Archivos, Disparadores, Pagos y accesos, Bloqueo por país, Configurar IA y Guía.
(() => {
  const copia = o => JSON.parse(JSON.stringify(o));
  const tamano = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const iconoDe = t => X.ic(t.startsWith('image/') ? 'imagen' : t.startsWith('video/') ? 'video' : t.startsWith('audio/') ? 'musica' : 'documento', 34);

  // ---------- Archivos ----------
  async function subir(lista) {
    if (!lista?.length) return [];
    const datos = new FormData();
    for (const a of lista) datos.append('archivos', a);
    const nuevos = await X.intentar(() => X.api('/archivos', { method: 'POST', body: datos }), 'Archivo subido');
    if (nuevos) X.archivos.push(...nuevos);
    return nuevos || [];
  }
  const miniatura = a => `<div class="mini-vista">${a.tipo.startsWith('image/') ? `<img src="${X.urlArchivo('/archivo/' + a.id)}" loading="lazy">` : iconoDe(a.tipo)}</div>`;

  // Ventana para escoger un archivo de la biblioteca (o subir uno nuevo). Devuelve su id.
  X.elegirArchivo = () => new Promise(async ok => {
    X.archivos = await X.api('/archivos');
    const v = X.ventana('', true);
    const pintar = () => {
      $('.ventana', v).innerHTML = `<h3>${X.ic('clip')} Elige un archivo</h3>
        <div class="fila" style="margin-bottom:12px"><label class="btn rojo">${X.ic('subir')} Subir nuevo<input type="file" multiple class="oculto"></label><span class="ayuda">Imágenes, videos, audios, PDF… hasta 50 MB.</span></div>
        ${X.archivos.length ? `<div class="archivos">${X.archivos.slice().reverse().map(a => `<div class="archivo" data-id="${a.id}" style="cursor:pointer">${miniatura(a)}<div class="info"><b title="${esc(a.nombre)}">${esc(a.nombre)}</b>${tamano(a.tam)}</div></div>`).join('')}</div>` : '<div class="vacio">Aún no has subido archivos.</div>'}
        <div class="fila fin" style="margin-top:14px"><button class="btn" data-cerrar>Cancelar</button></div>`;
      $('input[type=file]', v).onchange = async e => { const n = await subir(e.target.files); if (n.length === 1) { v.remove(); ok(n[0].id); } else pintar(); };
    };
    pintar();
    v.addEventListener('click', e => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (id) { v.remove(); ok(id); } else if (e.target.closest('[data-cerrar]')) { v.remove(); ok(null); }
    });
  });

  X.renombrarArchivo = async id => {
    const a = X.archivos.find(x => x.id === id);
    const nombre = await X.pedir('Renombrar archivo', a.nombre, 'Así lo verá el cliente si es un documento');
    if (nombre) { await X.intentar(() => X.api('/archivos/' + id, { method: 'PATCH', body: { nombre } }), 'Nombre cambiado'); X.ir(); }
  };
  X.borrarArchivo = async id => {
    if (!await X.confirmar('¿Eliminar este archivo? Los flujos que lo usen dejarán de enviarlo.', 'Sí, eliminar')) return;
    await X.intentar(() => X.api('/archivos/' + id, { method: 'DELETE' }), 'Archivo eliminado'); X.ir();
  };
  X.vistas.archivos = {
    titulo: 'Archivos',
    async pintar(el) {
      X.archivos = await X.api('/archivos');
      el.innerHTML = `<label class="soltar" id="soltar"><span class="soltar-ic">${X.ic('nube', 32)}</span><b>Arrastra y suelta tus archivos aquí</b>
          <span class="soltar-tipos">Imágenes, videos, audios, PDF, Office y ZIP · máximo 50 MB por archivo</span>
          <span class="btn rojo">${X.ic('subir')} Seleccionar archivos</span><input type="file" multiple class="oculto"></label>
        ${X.seccion('imagenes', `Archivos disponibles <span class="chip">${X.archivos.length}</span>`, 'Ponles un nombre claro: así los encuentras rápido al armar tus flujos.', `
        ${X.archivos.length ? `<div class="archivos">${X.archivos.slice().reverse().map(a => `<div class="archivo">${miniatura(a)}<div class="info"><b title="${esc(a.nombre)}">${esc(a.nombre)}</b>${tamano(a.tam)}
          <div class="fila" style="gap:4px;margin-top:6px"><a class="btn chico" href="${X.urlArchivo('/archivo/' + a.id)}" target="_blank" rel="noopener" title="Ver">${X.ic('ojo')}</a><button class="btn chico" title="Renombrar" onclick="X.renombrarArchivo('${a.id}')">${X.ic('lapiz')}</button><button class="btn chico peligro" title="Eliminar" onclick="X.borrarArchivo('${a.id}')">${X.ic('basura')}</button></div></div></div>`).join('')}</div>`
          : '<div class="vacio"><b>No hay archivos subidos</b>Sube aquí los PDF, audios, imágenes y videos de tu producto.</div>'}`)}`;
      const zona = $('#soltar');
      $('input', zona).onchange = async e => { await subir(e.target.files); X.ir(); };
      zona.ondragover = e => { e.preventDefault(); zona.classList.add('encima'); };
      zona.ondragleave = () => zona.classList.remove('encima');
      zona.ondrop = async e => { e.preventDefault(); zona.classList.remove('encima'); await subir(e.dataTransfer.files); X.ir(); };
    }
  };

  // ---------- Disparadores ----------
  let disparadores = [], flujos = [];
  const guardarDisparadores = () => X.guardarBot({ disparadores }, 'Disparadores guardados').then(X.ir);
  X.masDisparador = () => {
    const clave = $('#d-clave').value.trim(), flujoId = $('#d-flujo').value;
    if (!flujoId) return X.aviso('Elige el flujo que se va a activar.', true);
    disparadores.push({ id: idCorto('d'), clave, flujoId, default: !disparadores.some(d => d.default) });
    guardarDisparadores();
  };
  X.defaultDisparador = id => { disparadores.forEach(d => { d.default = d.id === id ? !d.default : false; }); guardarDisparadores(); };
  X.quitarDisparador = id => { disparadores = disparadores.filter(d => d.id !== id); guardarDisparadores(); };
  X.vistas.disparadores = {
    titulo: 'Disparadores',
    async pintar(el) {
      flujos = await X.api(`/bots/${X.botId}/flujos`);
      disparadores = copia(X.bot().disparadores);
      el.innerHTML = `${X.intro('Conecta palabras clave con tus flujos: cuando un cliente escriba la palabra o frase, se activa el flujo que elijas.')}
        ${X.seccion('rayo', 'Nuevo disparador', 'Une una palabra o frase con el flujo que debe empezar.', `
          <div class="fila-rapida">
            ${X.campo('llave', 'Palabra o frase clave', '<input id="d-clave" placeholder="Ej: quiero información">')}
            ${X.campo('red', 'Activar el flujo', `<select id="d-flujo"><option value="">— Elige un flujo —</option>${flujos.map(f => `<option value="${f.id}">${esc(f.nombre)}</option>`).join('')}</select>`)}
            <button class="btn rojo" style="margin-bottom:2px" onclick="X.masDisparador()">${X.ic('mas')} Añadir</button></div>
          ${flujos.length ? '' : X.pista('Primero crea un flujo en <a href="#/flujos">Flujos avanzados</a>.')}`)}
        ${X.seccion('estrella', `Disparadores activos <span class="chip">${disparadores.length}</span>`, 'Marca con la estrella el disparador por defecto: su flujo se envía como bienvenida a toda persona que te escriba por primera vez, diga lo que diga.', `
          ${X.cajaLista('Lista de disparadores', disparadores.map(d => `<div class="item-lista"><button class="icono" style="color:${d.default ? '#f59e0b' : 'var(--tenue)'}" title="Usar como bienvenida" onclick="X.defaultDisparador('${d.id}')">${X.ic(d.default ? 'estrellaLlena' : 'estrella', 20)}</button>
            <div class="crece"><b>${esc(d.clave || '(sin palabra)')} ${d.default ? '<span class="chip activo">POR DEFECTO</span>' : ''}</b><span>${X.ic('red', 12)} ${esc(flujos.find(f => f.id === d.flujoId)?.nombre || 'Flujo eliminado')}</span></div>
            <button class="icono peligro" title="Eliminar" onclick="X.quitarDisparador('${d.id}')">${X.ic('basura', 16)}</button></div>`).join(''), 'Aún no tienes disparadores.')}`)}`;
    }
  };

  // ---------- Pagos y accesos ----------
  let pagos = null;
  const leerMensajes = () => { pagos.msgConfirmacion = $('#p-confirmacion').value; pagos.msgInvalido = $('#p-invalido').value; };
  const guardarPagos = (texto = 'Configuración de pagos guardada') => { leerMensajes(); return X.guardarBot({ pagos }, texto).then(X.ir); };
  X.guardarPagos = () => guardarPagos();
  X.masRegla = () => {
    const regla = { id: idCorto('r'), montos: $('#r-montos').value.trim(), contextos: $('#r-contextos').value.trim(), minContexto: Number($('#r-min').value) || 1, valor: Number($('#r-valor').value) || 0, mensaje: $('#r-mensaje').value, archivos: [...X.archivosRegla] };
    if (!regla.montos && !regla.contextos) return X.aviso('Escribe al menos palabras de monto o de contexto.', true);
    pagos.reglas.push(regla); X.archivosRegla = [];
    guardarPagos('Regla de acceso añadida');
  };
  X.quitarRegla = id => { pagos.reglas = pagos.reglas.filter(r => r.id !== id); guardarPagos('Regla eliminada'); };
  X.archivosRegla = [];
  X.adjuntarRegla = async () => {
    const id = await X.elegirArchivo();
    if (id && !X.archivosRegla.includes(id)) X.archivosRegla.push(id);
    pintarArchivosRegla();
  };
  X.soltarArchivoRegla = id => { X.archivosRegla = X.archivosRegla.filter(a => a !== id); pintarArchivosRegla(); };
  const pintarArchivosRegla = () => {
    $('#r-archivos').innerHTML = X.archivosRegla.length
      ? X.archivosRegla.map(a => `<button type="button" class="chip activo" title="Quitar" onclick="X.soltarArchivoRegla('${a}')">${X.ic('clip', 13)} ${esc(X.archivos.find(x => x.id === a)?.nombre || a)} ${X.ic('x', 12)}</button>`).join('')
      : 'No hay archivos seleccionados';
  };
  X.masRapida = () => {
    const claves = $('#q-claves').value.trim(), respuesta = $('#q-respuesta').value.trim();
    if (!claves || !respuesta) return X.aviso('Escribe las palabras clave y la respuesta.', true);
    pagos.rapidas.push({ id: idCorto('q'), claves, respuesta });
    guardarPagos('Respuesta rápida añadida');
  };
  X.quitarRapida = id => { pagos.rapidas = pagos.rapidas.filter(r => r.id !== id); guardarPagos('Respuesta eliminada'); };
  X.guardarPost = () => {
    pagos.post = { activo: $('#post-activo').checked, flujoId: $('#post-flujo').value, minutos: Number($('#post-min').value) || 0 };
    guardarPagos('Disparador post-compra guardado');
  };

  X.vistas.pagos = {
    titulo: 'Pagos y accesos',
    async pintar(el) {
      flujos = await X.api(`/bots/${X.botId}/flujos`);
      X.archivos = await X.api('/archivos');
      const b = X.bot();
      pagos = copia(b.pagos);
      const borrar = fn => `<button class="icono peligro" title="Eliminar" onclick="${fn}">${X.ic('basura', 16)}</button>`;
      el.innerHTML = `${X.intro('Configura los mensajes generales de pago y las reglas para entregar el acceso después de validar cada comprobante.')}
        ${X.seccion('mensaje', 'Mensajes generales de pago', 'Respuestas automáticas para confirmaciones y rechazos.', `
          ${X.campo('checkCirculo', 'Mensaje de confirmación de pago', `<textarea id="p-confirmacion" placeholder="Ej: ¡Recibimos tu comprobante! Estamos validando tu pago…">${esc(pagos.msgConfirmacion)}</textarea>`, 'Se envía cuando se detecta un posible pago (antes de la validación final).', 'verde')}
          ${X.campo('xCirculo', 'Mensaje de comprobante no válido', `<textarea id="p-invalido" placeholder="Ej: Tu comprobante no pudo ser validado, por favor verifica…">${esc(pagos.msgInvalido)}</textarea>`, 'Se envía si la validación del pago falla.', 'gris')}
          <div class="sec-pie"><button class="btn rojo" onclick="X.guardarPagos()">${X.ic('guardar')} Guardar mensajes</button></div>`)}

        ${X.seccion('llave', 'Reglas de acceso por palabras clave', 'Define combinaciones de palabras clave (monto y contexto) que entregarán un acceso específico tras validar el pago.', `
          ${X.consejo('El separador es <code>;</code> — puedes usar valores como <code>15000; 15.000; 15,000</code> y <code>Pedro Jaramillo; Pedro J.; Nequi</code>.')}
          <div class="rejilla2">
            ${X.campo('dinero', 'Palabras clave de monto', '<input id="r-montos" placeholder="Ej: 50000; 50.000; 50000,00">', 'Los precios tal como salen en el comprobante. Separadas por punto y coma (;).')}
            ${X.campo('etiqueta', 'Palabras clave de contexto', '<input id="r-contextos" placeholder="Ej: Pedro Jaramillo; Pedro J.; Nequi">', 'Titular, banco, número de cuenta… Separadas por punto y coma (;).')}
            ${X.campo('escudo', 'Mínimo de palabras de contexto', '<input id="r-min" type="number" min="1" value="2">', 'Más alto = más difícil que cuele un comprobante falso.')}
            ${X.campo('recibo', `Valor de la venta (${esc(b.moneda)}) — opcional`, '<input id="r-valor" type="number" min="0" step="any" placeholder="Si lo dejas vacío se toma del monto detectado">', 'Es el valor que se suma en tus métricas.')}
          </div>
          ${X.campo('cadena', 'Enlace / mensaje de acceso al curso', '<textarea id="r-mensaje" placeholder="Ej: ¡Listo, {nombre}! Gracias por tu pago. Aquí te dejo tu acceso: https://…"></textarea>', 'Escribe <code>{nombre}</code> para saludar al cliente por su nombre.')}
          <div class="campo2">${X.etiqueta('carpeta', 'Archivos del curso')}
            <div class="zona-archivos" id="r-archivos">No hay archivos seleccionados</div>
            <button type="button" class="btn btn-archivos" onclick="X.adjuntarRegla()">${X.ic('carpeta', 18)} Seleccionar archivos…</button>
            ${X.pista('Haz clic en un archivo elegido para quitarlo. Se envían junto con el mensaje de acceso.')}</div>
          <button class="btn rojo" onclick="X.masRegla()">${X.ic('mas')} Añadir regla de acceso</button>
          ${X.cajaLista('Lista de reglas de acceso', pagos.reglas.map(r => `<div class="item-lista"><div class="crece"><b>${X.ic('dinero', 13)} ${esc(r.montos || '—')} &nbsp;·&nbsp; ${X.ic('etiqueta', 13)} ${esc(r.contextos || '—')} <span class="chip">mín. ${r.minContexto || 1}</span></b>
              <span>${esc((r.mensaje || '').slice(0, 140)) || '(sin mensaje)'}${r.archivos?.length ? ` · ${X.ic('clip', 12)} ${r.archivos.length} archivo(s)` : ''}</span></div>${borrar(`X.quitarRegla('${r.id}')`)}</div>`).join(''),
            'No hay reglas definidas. Mientras no haya ninguna, el bot no trata las imágenes como comprobantes.')}
          ${X.pista(`Si alguien reenvía un comprobante que ya se usó, se rechaza automáticamente. ${b.ia.apiKey ? 'Lectura con IA activada (más precisa).' : 'Lectura básica gratuita; con una clave de IA en «Configurar IA» lee mucho mejor.'}`)}`)}

        ${X.seccion('rayo', 'Respuestas rápidas — medios de pago', 'Define palabras clave y respuestas automáticas para consultas sobre medios de pago.', `
          ${X.consejo('El separador es <code>;</code> — puedes usar valores como <code>nequi; Neqi; Neki</code>.')}
          <div class="fila-rapida">
            ${X.campo('llave', 'Palabras clave', '<textarea id="q-claves" placeholder="Ej: nequi; bancolombia…"></textarea>')}
            ${X.campo('respuesta', 'Respuesta', '<textarea id="q-respuesta" placeholder="Ej: Nequi # 312…"></textarea>')}
            <button class="btn rojo" style="margin-bottom:4px" onclick="X.masRapida()">${X.ic('mas')} Añadir</button></div>
          ${X.cajaLista('Lista de respuestas rápidas', pagos.rapidas.map(r => `<div class="item-lista"><div class="crece"><b>${esc(r.claves)}</b><span>${esc(r.respuesta)}</span></div>${borrar(`X.quitarRapida('${r.id}')`)}</div>`).join(''), 'No hay respuestas rápidas definidas.')}`)}

        ${X.seccion('cohete', 'Disparador post-compra', 'Lanza un flujo en cuanto se valida la primera compra del cliente: ideal para ofrecer un producto adicional (upsell o downsell).', `
          <label class="interruptor"><input type="checkbox" id="post-activo" ${pagos.post.activo ? 'checked' : ''}> Habilitar el flujo post-compra</label>
          <div class="rejilla2">
            ${X.campo('red', 'Flujo a iniciar', `<select id="post-flujo"><option value="">— Selecciona un flujo —</option>${flujos.map(f => `<option value="${f.id}"${f.id === pagos.post.flujoId ? ' selected' : ''}>${esc(f.nombre)}</option>`).join('')}</select>`)}
            ${X.campo('reloj', 'Esperar antes de enviarlo (minutos)', `<input id="post-min" type="number" min="0" value="${pagos.post.minutos || 0}">`, '0 = se envía de inmediato.')}
          </div>
          <div class="sec-pie"><button class="btn rojo" onclick="X.guardarPost()">${X.ic('guardar')} Guardar configuración</button></div>`)}`;
      if (X.archivosRegla.length) pintarArchivosRegla();
    }
  };

  // ---------- Bloqueo por país ----------
  const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Banderas en imagen (Windows no dibuja los emojis de banderas).
  const bandera = iso => `<img class="bandera" src="https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/${iso.toLowerCase()}.svg" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'bandera txt',textContent:'${iso}'}))">`;
  X.marcarPaises = modo => { $$('.pais input').forEach(c => { if (!c.closest('.pais').classList.contains('oculto')) c.checked = modo === 'todos'; }); X.contarPaises(); };
  X.marcarRegion = boton => {
    const casillas = $$('.pais:not(.oculto) input', boton.closest('.region'));
    const todas = casillas.every(c => c.checked);
    casillas.forEach(c => { c.checked = !todas; });
    X.contarPaises();
  };
  X.contarPaises = () => {
    const marcados = $$('.pais input:checked');
    $('#paises-n').textContent = marcados.length;
    $$('.region').forEach(r => {
      const total = $$('.pais input', r).length, n = $$('.pais input:checked', r).length;
      $('.region-n', r).textContent = `${n}/${total}`;
      $('.region-n', r).classList.toggle('activo', n > 0);
      $('.region-btn', r).textContent = n === total ? 'Desmarcar región' : 'Marcar región';
    });
    $('#paises-resumen').innerHTML = marcados.length
      ? marcados.map(c => `<button type="button" class="chip-pais" onclick="X.quitarPais('${c.value}')" title="Quitar">${bandera(c.value)}${esc(c.dataset.nombre)} ${X.ic('x', 12)}</button>`).join('')
      : '<span class="tenue">Ningún país bloqueado: el bot responde a todo el mundo.</span>';
  };
  X.quitarPais = iso => { const c = $(`.pais input[value="${iso}"]`); if (c) { c.checked = false; X.contarPaises(); } };
  X.filtrarPaises = q => {
    const q2 = sinTildes(q);
    $$('.pais').forEach(l => l.classList.toggle('oculto', Boolean(q2) && !sinTildes(l.textContent).includes(q2)));
    $$('.region').forEach(r => r.classList.toggle('oculto', !$$('.pais:not(.oculto)', r).length));
    $('#paises-nada').classList.toggle('oculto', Boolean($$('.region:not(.oculto)').length));
  };
  X.guardarPaises = () => X.guardarBot({ paisesBloqueados: $$('.pais input:checked').map(c => c.value) }, 'Bloqueo guardado');
  X.vistas.paises = {
    titulo: 'Bloqueo por país',
    pintar(el) {
      const bloqueados = X.bot().paisesBloqueados, regiones = [...new Set(X.opciones.paises.map(p => p.region))];
      el.innerHTML = `<div class="banner">
          <span class="sec-ic">${X.ic('mundo', 22)}</span>
          <div><h3>Ignora mensajes de países específicos</h3><p>Selecciona los países cuyos mensajes serán ignorados por completo: no se guardan en el historial ni activan flujos ni la IA. Así nadie entra a copiar tu embudo desde otros países.</p></div>
        </div>
        <div class="paises-cab">
          <h3>${X.ic('bandera', 18)} Países bloqueados <span class="cuenta-pais" id="paises-n">${bloqueados.length}</span></h3>
          <label class="buscador chico">${X.ic('buscar', 15)}<input placeholder="Filtrar países…" oninput="X.filtrarPaises(this.value)"></label>
        </div>
        <div class="tarjeta paises-caja">
          <div class="paises-barra">
            ${X.consejo('Truco: pulsa <b>Marcar todos</b> y luego desmarca solo el país (o países) donde vendes.')}
            <div class="fila"><button class="btn chico" onclick="X.marcarPaises('todos')">${X.ic('checkCirculo', 15)} Marcar todos</button><button class="btn chico" onclick="X.marcarPaises('ninguno')">${X.ic('xCirculo', 15)} Ninguno</button></div>
          </div>
          <div class="paises-resumen" id="paises-resumen"></div>
          <div class="paises-lista" onchange="X.contarPaises()">
            ${regiones.map(r => `<div class="region"><div class="region-cab"><h4>${X.ic('mundo', 14)} ${esc(r)}</h4><span class="region-n">0/0</span><button type="button" class="region-btn" onclick="X.marcarRegion(this)">Marcar región</button></div>
              <div class="region-paises">${X.opciones.paises.filter(p => p.region === r).sort((a, z) => a.nombre.localeCompare(z.nombre, 'es')).map(p => `<label class="pais"><input type="checkbox" value="${p.iso}" data-nombre="${esc(p.nombre)}" ${bloqueados.includes(p.iso) ? 'checked' : ''}>${bandera(p.iso)}<span>${esc(p.nombre)}</span></label>`).join('')}</div></div>`).join('')}
            <div class="vacio oculto" id="paises-nada"><b>Ningún país coincide</b>Prueba con otro nombre.</div>
          </div>
        </div>
        <div class="paises-pie"><span class="ayuda" style="margin:0">${X.ic('info', 13)} Los cambios se aplican al guardar.</span><button class="btn rojo" onclick="X.guardarPaises()">${X.ic('guardar')} Guardar bloqueo</button></div>`;
      X.contarPaises();
    }
  };

  // ---------- Configurar IA ----------
  X.guardarIA = () => X.guardarBot({ ia: { activo: $('#ia-activo').checked, apiKey: $('#ia-clave').value.trim(), modelo: $('#ia-modelo').value, instrucciones: $('#ia-texto').value } }, 'Configuración de IA guardada').then(X.ir);
  X.vistas.ia = {
    titulo: 'Configurar IA',
    pintar(el) {
      const ia = X.bot().ia;
      el.innerHTML = `${X.intro('La IA responde las dudas del cliente después de tu guion y lee los comprobantes de pago con mucha más precisión.')}
        ${X.seccion('bot', 'Asistente con IA', 'Se enciende para cada cliente con el nodo «IA on/off» al final del flujo, o a mano desde el Chat en vivo.', `
          <label class="interruptor"><input type="checkbox" id="ia-activo" ${ia.activo ? 'checked' : ''}> Permitir que la IA responda en este bot</label>
          <div class="rejilla2">
            ${X.campo('llave', 'Clave de la API de Claude (Anthropic)', `<input id="ia-clave" value="${esc(ia.apiKey)}" placeholder="sk-ant-…" autocomplete="off">`, 'Se crea en <a href="https://platform.claude.com/" target="_blank" rel="noopener">platform.claude.com</a> → API keys. Se guarda solo en tu motor.')}
            ${X.campo('cohete', 'Modelo', `<select id="ia-modelo">${X.opciones.modelos.map(m => `<option value="${m.id}"${m.id === ia.modelo ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select>`, 'Los modelos más capaces responden mejor pero cuestan más por mensaje.')}
          </div>
          ${X.campo('documento', 'Información de tu negocio', `<textarea id="ia-texto" style="min-height:260px" placeholder="Ejemplo:&#10;Producto: Recetario '60 postres sin horno' en PDF.&#10;Precio: 15.000 COP (pago único).&#10;Medios de pago: Nequi 300 123 4567 a nombre de Pedro J.&#10;Entrega: inmediata por este chat al enviar el comprobante.&#10;Garantía: 7 días.&#10;Preguntas frecuentes: …">${esc(ia.instrucciones)}</textarea>`, 'Es lo único que la IA puede usar para responder. Escribe precios, medios de pago, entrega y preguntas frecuentes.')}
          <div class="sec-pie"><button class="btn rojo" onclick="X.guardarIA()">${X.ic('guardar')} Guardar configuración</button></div>`)}`;
    }
  };

  // ---------- Guía ----------
  X.vistas.guia = {
    titulo: 'Guía paso a paso',
    pintar(el) {
      const pasos = [
        ['conectar', 'Conecta tu WhatsApp', 'Pulsa "Iniciar bot" y escanea el código QR con el celular del número que va a vender.'],
        ['archivos', 'Sube tus archivos', 'Los PDF, audios, imágenes y videos que vas a enviar. Ponles nombres claros.'],
        ['flujos', 'Arma tu guion de ventas', 'Crea un flujo y agrega pasos con el botón +: textos, audios, pausas, preguntas… Empieza con un Distribuidor si quieres variar los mensajes.'],
        ['disparadores', 'Crea el disparador', 'Une una palabra clave con tu flujo y márcalo con la estrella para que sea la bienvenida.'],
        ['pagos', 'Configura pagos y accesos', 'Escribe tus precios y las palabras de tus comprobantes (tu nombre, tu banco) y el mensaje con el acceso al producto.'],
        ['pagos', 'Activa el post-compra (opcional)', 'Crea un flujo corto con una oferta adicional y actívalo abajo en "Pagos y accesos".'],
        ['paises', 'Bloquea los países donde no vendes', 'Marca todos y desmarca solo tu país.'],
        ['ia', 'Enciende la IA (opcional)', 'Pega tu clave y escribe la información de tu negocio para que responda dudas.'],
        ['conectar', 'Conecta el Pixel de Meta (opcional)', 'Para que cada venta se registre en tus campañas.'],
        ['chat', 'Haz una prueba real', 'Escríbele al bot desde otro número, recorre el guion, envía un comprobante y mira todo en "Chat en vivo".']
      ];
      el.innerHTML = `<div class="nota gris">Sigue estos pasos en orden y tu bot queda vendiendo solo. Puedes volver aquí cuando quieras.</div>
        <div class="pasos-guia">${pasos.map(([v, t, d]) => `<a href="#/${v}"><div><b>${t}</b><p>${d}</p></div></a>`).join('')}</div>
        <div class="tarjeta" style="margin-top:16px"><h3>${X.ic('escudo')} Para que no te bloqueen el número</h3><ul class="ayuda" style="line-height:1.9;font-size:13px">
          <li>Usa el <b>Distribuidor</b> con 3 a 6 versiones del mismo mensaje dichas con otras palabras.</li>
          <li>Deja <b>pausas</b> de 5 a 10 segundos entre mensajes.</li>
          <li>Máximo <b>2 o 3 recordatorios</b> de remarketing, y solo de día.</li>
          <li>No uses un número recién creado: que tenga unos días de uso normal.</li></ul></div>`;
    }
  };
})();
