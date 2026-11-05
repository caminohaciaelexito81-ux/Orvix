#!/bin/bash
# ORVIX QR — crea (o actualiza) tu servidor en Google Cloud. Se ejecuta en Cloud Shell.
#
#   Crear:       bash crear-en-google-cloud.sh TU_USUARIO/TU_REPOSITORIO [TOKEN_SI_ES_PRIVADO]
#   Actualizar:  bash crear-en-google-cloud.sh actualizar
#   Ver datos:   bash crear-en-google-cloud.sh ver
#   Ver errores: bash crear-en-google-cloud.sh registro
#   Pasar datos: bash crear-en-google-cloud.sh subir-datos [respaldo.tar.gz]
#   (si al crear ya subiste orvix-respaldo.tar.gz a Cloud Shell, se pasa solo)
#
# Usa el servidor gratis de Google (e2-micro en Iowa, disco estándar de 30 GB).
set -euo pipefail

NOMBRE=orvix-crm
ZONA=us-central1-a
verde() { printf '\n\033[1;32m%s\033[0m\n' "$*"; }
rojo() { printf '\n\033[1;31m%s\033[0m\n' "$*"; }

PROYECTO=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROYECTO" ]; then
  rojo "No hay un proyecto elegido. Arriba en la consola elige tu proyecto y vuelve a pegar el comando."
  exit 1
fi
gcloud config set compute/zone "$ZONA" >/dev/null 2>&1

existe() { gcloud compute instances describe "$NOMBRE" --zone "$ZONA" >/dev/null 2>&1; }
dato() { gcloud compute instances describe "$NOMBRE" --zone "$ZONA" --format=json | jq -r --arg k "$1" '.metadata.items[]? | select(.key==$k) | .value'; }
ip() { gcloud compute instances describe "$NOMBRE" --zone "$ZONA" --format='get(networkInterfaces[0].accessConfigs[0].natIP)'; }
direccion() { echo "https://$(ip | tr . -).sslip.io"; }

# Espera hasta que el panel responda (la primera instalación tarda unos 5 minutos).
esperar() {
  local url; url=$(direccion)
  printf 'Instalando en el servidor (unos 5 minutos)'
  for _ in $(seq 1 90); do
    if curl -sf -m 5 "$url/api/estado" | grep -q xventas; then echo; return 0; fi
    printf '.'; sleep 10
  done
  echo
  rojo "Todavía no responde. Espera 5 minutos más y prueba la dirección. Si sigue sin abrir, pega:  bash $0 registro"
  return 1
}

mostrar() {
  verde "✅ TU CRM ESTÁ EN LA NUBE"
  echo "   Dirección del panel:   $(direccion)"
  local codigo; codigo=$(dato orvix-codigo)
  [ -n "$codigo" ] && echo "   Código de instalación: $codigo   (se pide solo la primera vez)"
  echo
  echo "   Guarda estos dos datos. Abre la dirección, escribe el código y crea tu contraseña."
}

# Busca el respaldo que subiste a Cloud Shell (el más nuevo, aunque se llame "orvix-respaldo (1).tar.gz").
buscar_respaldo() { ls -t "$HOME"/orvix-respaldo*.tar.gz 2>/dev/null | head -n 1 || true; }

# Pasa el respaldo de tu PC al servidor: detiene el motor, guarda una copia de lo que había
# en /var/lib/orvix-anterior-FECHA, pone tus datos y vuelve a encender el motor.
subir_datos() {
  local archivo="$1"
  [ -f "$archivo" ] || { rojo "No encuentro el respaldo. Súbelo a Cloud Shell (⋮ → Subir) y vuelve a pegar el comando."; return 1; }
  if ! tar -tzf "$archivo" 2>/dev/null | grep -qE '^(\./)?db\.json$'; then
    rojo "El archivo $(basename "$archivo") no parece un respaldo de ORVIX QR (no tiene db.json)."
    return 1
  fi
  verde "Pasando tus datos de la PC al servidor ($(du -h "$archivo" | cut -f1))…"
  gcloud compute scp "$archivo" "$NOMBRE:/tmp/orvix-respaldo.tar.gz" --zone "$ZONA" --quiet
  gcloud compute ssh "$NOMBRE" --zone "$ZONA" --quiet --command 'sudo bash -euc "
    systemctl stop orvix
    if [ -d /var/lib/orvix ] && [ -n \"\$(ls -A /var/lib/orvix)\" ]; then
      cp -a /var/lib/orvix /var/lib/orvix-anterior-\$(date +%Y%m%d-%H%M%S)
    fi
    DIR=\$(cat /var/lib/orvix/direccion.txt 2>/dev/null || true)
    find /var/lib/orvix -mindepth 1 -delete
    tar -xzf /tmp/orvix-respaldo.tar.gz -C /var/lib/orvix --no-same-owner
    [ -n \"\$DIR\" ] && echo \"\$DIR\" > /var/lib/orvix/direccion.txt
    rm -f /var/lib/orvix/EN-LA-NUBE.txt /tmp/orvix-respaldo.tar.gz
    chown -R orvix:orvix /var/lib/orvix
    systemctl start orvix
  "'
  sleep 8
  verde "✅ Tus datos ya están en la nube"
  echo "   Entra con la MISMA contraseña que usabas en tu PC."
  echo "   WhatsApp se vuelve a conectar solo (si en 2 minutos no conecta, escanea el QR otra vez)."
  echo "   No abras el CRM de tu PC: con el mismo WhatsApp en dos lugares se desconectan los dos."
}

case "${1:-}" in
  subir-datos)
    existe || { rojo "Primero crea el servidor con el comando del paso 3 de la guía."; exit 1; }
    subir_datos "${2:-$(buscar_respaldo)}" || exit 1
    echo "   Dirección del panel:   $(direccion)"
    exit 0 ;;
  ver)
    existe || { rojo "Todavía no has creado el servidor."; exit 1; }
    mostrar; exit 0 ;;
  actualizar)
    existe || { rojo "Todavía no has creado el servidor."; exit 1; }
    verde "Reiniciando el servidor para traer la última versión de GitHub…"
    echo "(WhatsApp se vuelve a conectar solo; tus datos no se tocan)"
    gcloud compute instances reset "$NOMBRE" --zone "$ZONA" --quiet
    sleep 30; esperar && mostrar; exit 0 ;;
  registro)
    gcloud compute instances get-serial-port-output "$NOMBRE" --zone "$ZONA" 2>/dev/null | grep -E 'startup-script|ORVIX|rror' | tail -n 60
    exit 0 ;;
esac

REPO="${1:-}"
TOKEN="${2:-}"
if [[ ! "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  rojo "Falta tu repositorio. Ejemplo:  bash $0 juanperez/orvix-crm"
  exit 1
fi

if existe; then
  verde "Ya tienes el servidor $NOMBRE creado."
  mostrar
  echo "   Para traer cambios nuevos de GitHub usa:  bash $0 actualizar"
  exit 0
fi

# El instalador va junto a este archivo; si se ejecutó con curl, se descarga de GitHub.
DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd || pwd)
INSTALADOR="$DIR/instalar-servidor.sh"
if [ ! -f "$INSTALADOR" ]; then
  INSTALADOR=$(mktemp)
  AUT=(); [ -n "$TOKEN" ] && AUT=(-H "Authorization: Bearer $TOKEN")
  curl -fsSL "${AUT[@]}" "https://raw.githubusercontent.com/$REPO/HEAD/nube/instalar-servidor.sh" -o "$INSTALADOR" \
    || { rojo "No pude descargar nube/instalar-servidor.sh de github.com/$REPO. ¿Subiste la carpeta nube?"; exit 1; }
fi

verde "1/4 Activando el servicio de servidores (Compute Engine)…"
if ! gcloud services enable compute.googleapis.com; then
  rojo "Google no dejó activarlo. Casi siempre es porque falta la facturación: en el menú ☰ → Facturación, vincula una tarjeta al proyecto (el servidor e2-micro es gratis)."
  exit 1
fi

verde "2/4 Abriendo los puertos web (80 y 443)…"
gcloud compute firewall-rules describe orvix-web >/dev/null 2>&1 || \
  gcloud compute firewall-rules create orvix-web --allow tcp:80,tcp:443 --target-tags orvix-web --description "Panel de ORVIX QR"

CODIGO=$(tr -dc 'A-HJ-NP-Z2-9' </dev/urandom | head -c 8)
verde "3/4 Creando el servidor gratis (e2-micro, Iowa)…"
META="orvix-repo=$REPO,orvix-codigo=$CODIGO"
[ -n "$TOKEN" ] && META="$META,orvix-token=$TOKEN"
gcloud compute instances create "$NOMBRE" \
  --zone "$ZONA" --machine-type e2-micro \
  --image-family ubuntu-2404-lts-amd64 --image-project ubuntu-os-cloud \
  --boot-disk-size 30GB --boot-disk-type pd-standard \
  --tags orvix-web \
  --metadata "$META" \
  --metadata-from-file startup-script="$INSTALADOR"

verde "4/4 Esperando a que se instale…"
sleep 20
esperar || exit 1

RESPALDO=$(buscar_respaldo)
if [ -n "$RESPALDO" ]; then
  subir_datos "$RESPALDO" || exit 1
  echo "   Dirección del panel:   $(direccion)"
else
  mostrar
  echo "   (No subiste un respaldo de tu PC: empiezas con el CRM vacío."
  echo "    Si quieres pasar tus datos después:  bash $0 subir-datos)"
fi
