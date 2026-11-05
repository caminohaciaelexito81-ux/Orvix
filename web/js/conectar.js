// Conectar WhatsApp (QR o código) y Meta Pixel / API de conversiones.
(() => {
  let modo = 'qr', reloj = null, ultimo = '';

  async function refrescar() {
    let c;
    try { c = await X.api(`/bots/${X.botId}/conexion`); } catch { return; }
    const b = X.bot();
    if (b) b.conexion = c;
    const firma = JSON.stringify(c);
    if (firma === ultimo) return;
    ultimo = firma;
    X.pintarBarra();
    const caja = $('#qr-caja');
    if (!caja) return;
    if (c.estado === 'conectado') caja.innerHTML = `<div><div style="color:var(--verde)">${X.ic('checkCirculo', 48)}</div><h3 style="margin:8px 0">¡WhatsApp conectado!</h3>Número: <b>+${esc(c.numero)}</b></div>`;
    else if (c.estado === 'qr') caja.innerHTML = `<div><img src="${c.qr}" alt="Código QR"><p>En tu celular: <b>WhatsApp → ⋮ o Ajustes → Dispositivos vinculados → Vincular un dispositivo</b> y apunta la cámara aquí.<br><span class="ayuda">El código se renueva solo.</span></p></div>`;
    else if (c.estado === 'codigo') caja.innerHTML = `<div><p>Escribe este código en tu celular:</p><div class="codigo-vinculo">${esc(c.codigo.replace(/(.{4})/, '$1-'))}</div><p><b>WhatsApp → Dispositivos vinculados → Vincular un dispositivo → Vincular con el número de teléfono</b></p></div>`;
    else if (c.estado === 'iniciando') caja.innerHTML = `<div>${X.ic('cargando')} Preparando la conexión…</div>`;
    else caja.innerHTML = `<div>${c.error ? `<p style="color:var(--peligro)">${esc(c.error)}</p>` : ''}Aquí aparecerá el ${modo === 'qr' ? 'código QR' : 'código'} cuando pulses <b>Iniciar bot</b>.</div>`;
    $('#btn-iniciar').disabled = c.estado !== 'desconectado';
    $('#btn-detener').disabled = c.estado === 'desconectado';
  }

  X.modoConexion = m => { modo = m; X.ir(); };
  X.iniciarBot = async () => {
    const telefono = $('#tel-vinculo')?.value.replace(/\D/g, '');
    if (modo === 'codigo' && (!telefono || telefono.length < 8)) return X.aviso('Escribe el número completo con el indicativo del país (ej: 573001234567).', true);
    ultimo = '';
    await X.intentar(() => X.api(`/bots/${X.botId}/iniciar`, { body: { modo, telefono } }));
    refrescar();
  };
  X.detenerBot = async () => { await X.intentar(() => X.api(`/bots/${X.botId}/detener`, { method: 'POST' }), 'Bot detenido'); ultimo = ''; refrescar(); };
  X.desvincularBot = async () => {
    if (!await X.confirmar('¿Desvincular este WhatsApp? Tendrás que escanear el QR otra vez para volver a conectarlo.', 'Sí, desvincular')) return;
    await X.intentar(() => X.api(`/bots/${X.botId}/desvincular`, { method: 'POST' }), 'WhatsApp desvinculado');
    ultimo = ''; refrescar();
  };
  X.guardarPixel = async () => {
    await X.guardarBot({ pixel: { id: $('#px-id').value.trim(), token: $('#px-token').value.trim(), activo: $('#px-activo').checked } }, 'Pixel guardado');
    X.ir();
  };

  X.vistas.conectar = {
    titulo: 'Conectar',
    pintar(el) {
      const b = X.bot(), px = b.pixel;
      el.innerHTML = `<div class="tarjeta"><h3>${X.ic('qr')} Conectar WhatsApp</h3><p class="sub">Vincula el número que va a atender a tus clientes. Funciona igual que WhatsApp Web.</p>
        <div class="pestanas"><button class="${modo === 'qr' ? 'activo' : ''}" onclick="X.modoConexion('qr')">Vincular con QR</button><button class="${modo === 'codigo' ? 'activo' : ''}" onclick="X.modoConexion('codigo')">Vincular con código</button></div>
        ${modo === 'codigo' ? `<label class="campo" style="margin-top:14px;max-width:340px"><span>Número de WhatsApp (con indicativo, sin +)</span><input id="tel-vinculo" inputmode="numeric" placeholder="573001234567"></label>` : ''}
        <div class="qr" id="qr-caja">Cargando…</div>
        <div class="fila"><button class="btn rojo" id="btn-iniciar" onclick="X.iniciarBot()">${X.ic('play')} Iniciar bot</button><button class="btn" id="btn-detener" onclick="X.detenerBot()">${X.ic('detener')} Detener bot</button><button class="btn peligro" onclick="X.desvincularBot()">${X.ic('desvincular')} Desvincular</button></div>
        <p class="ayuda" style="margin-top:12px">Consejo: usa un número con algunos días de uso normal y deja el celular con internet. Un número recién creado que envía muchos mensajes es el que más se bloquea.</p></div>

      <div class="tarjeta"><h3>${X.ic('pulso')} Meta Pixel y API de conversiones <span class="chip${px.activo && px.id ? ' verde' : ''}">${px.activo && px.id ? 'Activo' : 'Sin configurar'}</span></h3>
        <p class="sub">Cada venta validada se envía a Meta como evento <b>Compra</b> para que tus campañas optimicen con ventas reales.</p>
        <div class="rejilla2"><label class="campo"><span>ID del píxel (identificador del conjunto de datos)</span><input id="px-id" value="${esc(px.id)}" placeholder="123456789012345"></label>
          <label class="campo"><span>Token de acceso de la API de conversiones</span><input id="px-token" value="${esc(px.token)}" placeholder="EAAB…"></label></div>
        <div class="fila"><label class="fila" style="cursor:pointer"><input type="checkbox" id="px-activo" ${px.activo ? 'checked' : ''}> Enviar las ventas a Meta</label><span class="crece"></span><button class="btn rojo" onclick="X.guardarPixel()">${X.ic('guardar')} Guardar configuración</button></div>
        <details style="margin-top:12px"><summary style="cursor:pointer;color:var(--suave)">¿De dónde saco estos dos datos?</summary><ol class="ayuda" style="line-height:1.9">
          <li>En Meta entra a <b>Configuración del negocio → Orígenes de datos → Conjuntos de datos y píxeles</b> y crea uno (o usa el que ya tienes).</li>
          <li>Asígnale tu cuenta publicitaria (<b>Activos conectados</b>) y dale acceso total a tu usuario (<b>Personas</b>).</li>
          <li>Ábrelo en el <b>Administrador de eventos → Configuración</b>. Copia el <b>identificador</b> y pégalo arriba.</li>
          <li>Más abajo, en <b>API de conversiones → Configurar integración directa</b>, pulsa <b>Generar token de acceso</b>, cópialo y pégalo arriba.</li>
          <li>Marca "Enviar las ventas a Meta" y guarda.</li></ol></details></div>`;
      ultimo = '';
      refrescar();
      reloj = setInterval(refrescar, 2000);
      X.alSalir = () => clearInterval(reloj);
    }
  };
})();
