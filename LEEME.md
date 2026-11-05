# ORVIX QR — CRM y chatbot de ventas por WhatsApp

Conecta tu WhatsApp por código QR y deja que el bot presente tu producto, valide los comprobantes de pago, entregue el acceso y haga remarketing.

## Cómo está hecho (2 piezas)

| Pieza | Carpeta | Qué hace | Dónde vive |
|---|---|---|---|
| **Panel** | `web/` | Las pantallas (analíticas, chat, flujos, pagos…) | Vercel o tu PC |
| **Motor** | `motor/` | Mantiene WhatsApp conectado, corre los flujos y guarda los datos | Tu PC o un servidor encendido 24/7 |

> **Importante:** Vercel solo sirve para el panel. La conexión por QR necesita un programa encendido todo el tiempo, y Vercel no permite eso. Por eso el motor va en tu PC (para probar) o en un servidor como Railway (para vender de verdad).

## Probar en tu PC

1. Doble clic en **`INICIAR.bat`**.
2. Se abre `http://localhost:3900`. La primera vez te pide **crear una contraseña**.
3. Menú **Guía paso a paso** → sigue los pasos en orden.

Mientras la ventana negra esté abierta, el bot funciona. Si la cierras, se apaga.

Tus datos (sesión de WhatsApp, chats, ventas, claves) quedan en la carpeta **`datos/`**. Haz copia de esa carpeta de vez en cuando y **nunca la subas a GitHub**.

## Subir a GitHub

1. Doble clic en **`PREPARAR-PARA-GITHUB.bat`**. Crea la carpeta `para-github` solo con lo que se debe subir.
2. En GitHub crea un repositorio **privado** y sube todo lo que hay **dentro** de `para-github`.

## Publicar en Google Cloud (recomendado)

Abre **`GUIA-NUBE.html`** y sigue los 3 pasos. Un solo comando en Cloud Shell crea el servidor gratis (e2-micro), instala todo desde GitHub, deja el motor encendido 24/7 con candado https y te da la dirección y el código de instalación. Los scripts están en la carpeta `nube/`.

Para llevar lo que ya tienes en tu PC (WhatsApp vinculado, flujos, chats, ventas, archivos y contraseña): cierra el CRM, haz doble clic en **`HACER-RESPALDO-PARA-LA-NUBE.bat`** y sube el archivo `orvix-respaldo.tar.gz` a Cloud Shell (⋮ → Subir) antes de pegar el comando. Ese archivo es privado: nunca va a GitHub.

## Publicar en otros servicios

**Motor (Railway u otro servidor con Node.js):**
1. Nuevo proyecto → *Deploy from GitHub repo* → elige tu repositorio.
2. Agrega un **Volume** montado en `/app/datos` (ahí se guarda todo; sin esto se borra en cada actualización).
3. En *Settings → Networking* pulsa **Generate Domain**. Esa dirección `https://…` es la de tu motor.
4. Ábrela una vez y **crea tu contraseña de inmediato**.

**Panel (Vercel):**
1. *Add New → Project* → elige el mismo repositorio.
2. En **Root Directory** escribe `web`. En *Framework Preset* deja **Other**. Pulsa **Deploy**.
3. Abre tu página de Vercel: te pedirá la **dirección del motor** (la de Railway) y luego tu contraseña.

El motor también muestra el panel por sí solo, así que Vercel es opcional: puedes usar directamente la dirección de Railway.

## Variables opcionales del motor

| Variable | Para qué |
|---|---|
| `PORT` | Puerto (por defecto 3900; Railway lo pone solo) |
| `DATOS_DIR` | Carpeta donde guardar los datos |
| `CLAVE_PANEL` | Fija la contraseña del panel desde el servidor |
