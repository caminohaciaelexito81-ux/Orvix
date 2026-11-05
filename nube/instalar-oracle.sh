#!/bin/bash
# ORVIX QR — instalador del servidor en Oracle Cloud (Ubuntu, Arm o AMD).
# La primera vez lo ejecuta Oracle al crear el servidor (cloud-init). Después queda como
# /usr/local/sbin/orvix-instalar y corre en cada arranque: trae la última versión de GitHub
# y reinicia el motor. Tus datos (WhatsApp, chats, ventas) viven en /var/lib/orvix y no se tocan.
# Lee su configuración de /etc/orvix.conf (REPO, TOKEN, CODIGO).
set -euo pipefail
exec > >(tee -a /var/log/orvix-instalacion.log) 2>&1
echo "===== ORVIX QR: instalación $(date) ====="

# Se copia a sí mismo para poder correr en cada arranque.
YO=$(readlink -f "$0")
if [ "$YO" != /usr/local/sbin/orvix-instalar ]; then
  install -m 755 "$YO" /usr/local/sbin/orvix-instalar
fi

# shellcheck disable=SC1091
. /etc/orvix.conf
TOKEN="${TOKEN:-}"
[ -n "${REPO:-}" ] || { echo "Falta REPO en /etc/orvix.conf"; exit 1; }

APP=/opt/orvix
DATOS=/var/lib/orvix
export DEBIAN_FRONTEND=noninteractive

# 1) Memoria extra (sobre todo si quedó en el servidor pequeño de 1 GB).
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
command -v netfilter-persistent >/dev/null || apt-get install -y iptables-persistent

# 3) Las imágenes de Ubuntu de Oracle traen un cortafuegos interno que solo deja el puerto 22.
#    Se abren el 80 y el 443 justo antes de la regla que rechaza todo, y se guarda.
for P in 80 443; do
  if ! iptables -C INPUT -p tcp --dport "$P" -m state --state NEW -j ACCEPT 2>/dev/null; then
    N=$(iptables -L INPUT --line-numbers -n | awk '$2=="REJECT" && !n {n=$1} END {print n}')
    if [ -n "$N" ]; then iptables -I INPUT "$N" -p tcp --dport "$P" -m state --state NEW -j ACCEPT
    else iptables -A INPUT -p tcp --dport "$P" -m state --state NEW -j ACCEPT; fi
  fi
done
netfilter-persistent save || true

# 4) Usuario sin permisos especiales para el motor, y carpeta de datos.
id orvix >/dev/null 2>&1 || useradd --system --home "$DATOS" --shell /usr/sbin/nologin orvix
mkdir -p "$DATOS"
chown -R orvix:orvix "$DATOS"

# 5) Código desde GitHub (la primera vez lo descarga; después lo actualiza).
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

# Memoria para Node según el servidor (Arm gratis: hasta 24 GB; AMD gratis: 1 GB).
MEM_MB=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
HEAP=$(( MEM_MB > 4000 ? 4096 : 700 ))

# 6) El motor como servicio: arranca solo y se reinicia si falla.
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
Environment=CODIGO_INSTALACION=${CODIGO:-}
Environment=NODE_OPTIONS=--max-old-space-size=$HEAP
ExecStart=/usr/bin/node $APP/motor/index.js
Restart=always
RestartSec=5
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
EOF

# En cada arranque: actualizar desde GitHub antes de seguir.
cat > /etc/systemd/system/orvix-actualizar.service <<EOF
[Unit]
Description=ORVIX QR (traer la última versión de GitHub)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/orvix-instalar
TimeoutStartSec=900

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable orvix orvix-actualizar >/dev/null 2>&1
systemctl restart orvix

# 7) Dirección con candado https: <tu-ip>.sslip.io (gratis, sin comprar dominio).
IP=$(curl -fsS -m 10 https://checkip.amazonaws.com || curl -fsS -m 10 https://api.ipify.org || true)
IP=$(echo "$IP" | tr -d '[:space:]')
if [ -n "$IP" ]; then
  DOMINIO="${IP//./-}.sslip.io"
  cat > /etc/caddy/Caddyfile <<EOF
$DOMINIO {
  encode gzip
  reverse_proxy 127.0.0.1:3900
}
EOF
  systemctl enable caddy >/dev/null 2>&1
  systemctl restart caddy
  echo "https://$DOMINIO" > "$DATOS/direccion.txt"
  echo "===== Listo: https://$DOMINIO ====="
else
  echo "No pude averiguar la IP pública; Caddy queda sin configurar."
fi
