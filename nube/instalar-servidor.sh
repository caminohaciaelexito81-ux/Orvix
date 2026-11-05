#!/bin/bash
# ORVIX QR — instalador del servidor (Google Cloud, Ubuntu).
# Google lo ejecuta solo cada vez que el servidor arranca: la primera vez instala todo
# y las siguientes trae la última versión desde GitHub y reinicia el motor.
# Tus datos (WhatsApp, chats, ventas) viven en /var/lib/orvix y nunca se borran al actualizar.
set -euo pipefail
exec > >(tee -a /var/log/orvix-instalacion.log) 2>&1
echo "===== ORVIX QR: instalación $(date) ====="

META=http://metadata.google.internal/computeMetadata/v1/instance
meta() { curl -sf -H 'Metadata-Flavor: Google' "$META/$1" || true; }
REPO=$(meta attributes/orvix-repo)            # usuario/repositorio en GitHub
TOKEN=$(meta attributes/orvix-token)          # solo si el repositorio es privado
CODIGO=$(meta attributes/orvix-codigo)        # código para crear la primera contraseña
IP=$(meta network-interfaces/0/access-configs/0/external-ip)
[ -n "$REPO" ] || { echo "Falta el dato orvix-repo"; exit 1; }

APP=/opt/orvix
DATOS=/var/lib/orvix
export DEBIAN_FRONTEND=noninteractive

# 1) Memoria extra: el servidor gratis tiene 1 GB; la lectura de comprobantes necesita más.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2) Programas: Node.js 22, git y Caddy (pone https gratis).
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg git
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v git >/dev/null || apt-get install -y git
command -v caddy >/dev/null || { apt-get update -y; apt-get install -y caddy; }

# 3) Usuario sin permisos especiales para el motor, y carpeta de datos.
id orvix >/dev/null 2>&1 || useradd --system --home "$DATOS" --shell /usr/sbin/nologin orvix
mkdir -p "$DATOS"
chown -R orvix:orvix "$DATOS"

# 4) Código desde GitHub (la primera vez lo descarga; después lo actualiza).
URL="https://github.com/$REPO.git"
[ -n "$TOKEN" ] && URL="https://x-access-token:$TOKEN@github.com/$REPO.git"
if [ -d "$APP/.git" ]; then
  git -C "$APP" remote set-url origin "$URL"
  git -C "$APP" fetch --depth 1 origin
  git -C "$APP" reset --hard origin/HEAD
else
  rm -rf "$APP"
  git clone --depth 1 "$URL" "$APP"
fi
git -C "$APP" remote set-url origin "https://github.com/$REPO.git"   # no dejar el token guardado
cd "$APP/motor"
npm ci --omit=dev --no-audit --no-fund

# 5) El motor como servicio: arranca solo y se reinicia si falla.
cat > /etc/systemd/system/orvix.service <<EOF
[Unit]
Description=ORVIX QR (motor del CRM)
After=network-online.target
Wants=network-online.target

[Service]
User=orvix
WorkingDirectory=$DATOS
Environment=NODE_ENV=production
Environment=PORT=3900
Environment=HOST=127.0.0.1
Environment=DATOS_DIR=$DATOS
Environment=CODIGO_INSTALACION=$CODIGO
Environment=NODE_OPTIONS=--max-old-space-size=700
ExecStart=/usr/bin/node $APP/motor/index.js
Restart=always
RestartSec=5
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable orvix
systemctl restart orvix

# 6) Dirección con candado https: <tu-ip>.sslip.io (gratis, sin comprar dominio).
DOMINIO="${IP//./-}.sslip.io"
cat > /etc/caddy/Caddyfile <<EOF
$DOMINIO {
  encode gzip
  reverse_proxy 127.0.0.1:3900
}
EOF
systemctl enable caddy
systemctl restart caddy
echo "https://$DOMINIO" > "$DATOS/direccion.txt"

echo "===== Listo: https://$DOMINIO ====="
