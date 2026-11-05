#!/bin/bash
# ORVIX QR — crea (o maneja) tu servidor GRATIS en Oracle Cloud. Se ejecuta en la Cloud Shell de Oracle.
#
#   Crear:       bash crear-en-oracle.sh TU_USUARIO/TU_REPOSITORIO [TOKEN_SI_ES_PRIVADO]
#   Actualizar:  bash crear-en-oracle.sh actualizar      (trae lo último de GitHub)
#   Ver datos:   bash crear-en-oracle.sh ver
#   Ver errores: bash crear-en-oracle.sh registro
#   Pasar datos: bash crear-en-oracle.sh subir-datos [respaldo.tar.gz]
#   (si al crear ya subiste orvix-respaldo.tar.gz a la Cloud Shell, se pasa solo)
#
# Usa la capa "Always Free": servidor Arm (2 núcleos, 12 GB) y, si Oracle no tiene cupo,
# el servidor AMD pequeño (1 GB). Disco de 50 GB. Todo dentro de lo gratuito.
set -euo pipefail

NOMBRE=orvix-crm
LLAVE="$HOME/.ssh/orvix"
CONOCIDOS="$HOME/.ssh/orvix_conocidos"
verde() { printf '\n\033[1;32m%s\033[0m\n' "$*"; }
rojo() { printf '\n\033[1;31m%s\033[0m\n' "$*"; }
nuevo_id() { jq -r '.data.id // empty' 2>/dev/null || true; }
crudo() { "$@" --raw-output 2>/dev/null | grep -v '^Query returned empty' || true; }

T="${OCI_TENANCY:-}"
if [ -z "$T" ]; then
  rojo "Esto se pega en la Cloud Shell de Oracle (el ícono >_ arriba a la derecha en cloud.oracle.com)."
  exit 1
fi
C="$T"   # se usa el compartimento principal (raíz) de tu cuenta

# Lo gratuito solo existe en tu región de origen (la que elegiste al crear la cuenta).
CASA=$(crudo oci iam region-subscription list --tenancy-id "$T" --query 'data[?"is-home-region"]|[0]."region-name"')
export OCI_CLI_REGION="${CASA:-${OCI_REGION:-}}"

instancia() { oci compute instance list -c "$C" --display-name "$NOMBRE" --all 2>/dev/null \
  | jq -r '[.data[]? | select(."lifecycle-state" != "TERMINATED" and ."lifecycle-state" != "TERMINATING")][0].id // empty' || true; }
ip() { crudo oci compute instance list-vnics --instance-id "$1" --query 'data[0]."public-ip"'; }
direccion() { echo "https://$(ip "$1" | tr . -).sslip.io"; }
codigo() { crudo oci compute instance get --instance-id "$1" --query 'data."freeform-tags"."orvix-codigo"'; }
entrar() { local i="$1"; shift; ssh -i "$LLAVE" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$CONOCIDOS" -o ConnectTimeout=20 "ubuntu@$(ip "$i")" "$@"; }

esperar() {
  local url; url=$(direccion "$1")
  printf 'Instalando en el servidor (de 5 a 10 minutos)'
  for _ in $(seq 1 100); do
    if curl -sf -m 5 "$url/api/estado" | grep xventas >/dev/null; then echo; return 0; fi
    printf '.'; sleep 10
  done
  echo
  rojo "Todavía no responde. Espera 5 minutos más y prueba la dirección. Si sigue sin abrir, pega:  bash $0 registro"
  return 1
}

mostrar() {
  verde "✅ TU CRM ESTÁ EN LA NUBE (Oracle, gratis)"
  echo "   Dirección del panel:   $(direccion "$1")"
  local c; c=$(codigo "$1")
  [ -n "$c" ] && echo "   Código de instalación: $c   (se pide solo si empiezas sin respaldo)"
  echo
  echo "   Guarda estos datos."
}

buscar_respaldo() { ls -t "$HOME"/orvix-respaldo*.tar.gz 2>/dev/null | head -n 1 || true; }

# Pasa el respaldo de tu PC al servidor: detiene el motor, guarda una copia de lo que había
# en /var/lib/orvix-anterior-FECHA, pone tus datos y vuelve a encender el motor.
subir_datos() {
  local i="$1" archivo="$2"
  [ -f "$archivo" ] || { rojo "No encuentro el respaldo. Súbelo a la Cloud Shell (menú ⚙ o ☰ de la ventana → Cargar / Upload) y vuelve a pegar el comando."; return 1; }
  if ! tar -tzf "$archivo" 2>/dev/null | grep -E '^(\./)?db\.json$' >/dev/null; then
    rojo "El archivo $(basename "$archivo") no parece un respaldo de ORVIX QR (no tiene db.json)."
    return 1
  fi
  verde "Pasando tus datos de la PC al servidor ($(du -h "$archivo" | cut -f1))…"
  scp -i "$LLAVE" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$CONOCIDOS" \
    "$archivo" "ubuntu@$(ip "$i"):/tmp/orvix-respaldo.tar.gz"
  entrar "$i" 'sudo bash -euc "
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
  ver|actualizar|registro|subir-datos)
    I=$(instancia)
    [ -n "$I" ] || { rojo "Todavía no has creado el servidor. Pega primero el comando para crearlo."; exit 1; }
    case "$1" in
      ver) mostrar "$I" ;;
      actualizar)
        verde "Trayendo la última versión de GitHub… (tus datos no se tocan)"
        entrar "$I" 'sudo /usr/local/sbin/orvix-instalar >/dev/null && echo "Listo, el motor ya usa la versión nueva."' ;;
      registro)
        entrar "$I" 'sudo tail -n 40 /var/log/cloud-init-output.log; echo; echo "----- instalación -----"; sudo tail -n 60 /var/log/orvix-instalacion.log; echo; echo "----- motor -----"; sudo journalctl -u orvix -n 40 --no-pager' ;;
      subir-datos)
        subir_datos "$I" "${2:-$(buscar_respaldo)}" || exit 1
        echo "   Dirección del panel:   $(direccion "$I")" ;;
    esac
    exit 0 ;;
esac

REPO="${1:-}"
TOKEN="${2:-}"
if [[ ! "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  rojo "Falta tu repositorio. Ejemplo:  bash $0 juanperez/orvix-crm"
  exit 1
fi

I=$(instancia)
if [ -n "$I" ]; then
  verde "Ya tienes el servidor $NOMBRE creado."
  mostrar "$I"
  echo "   Para traer cambios nuevos de GitHub usa:  bash $0 actualizar"
  exit 0
fi

# El instalador va junto a este archivo; si se ejecutó con curl, se descarga de GitHub.
DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd || pwd)
INSTALADOR="$DIR/instalar-oracle.sh"
if [ ! -f "$INSTALADOR" ]; then
  INSTALADOR=$(mktemp)
  AUT=(); [ -n "$TOKEN" ] && AUT=(-H "Authorization: Bearer $TOKEN")
  curl -fsSL "${AUT[@]}" "https://raw.githubusercontent.com/$REPO/HEAD/nube/instalar-oracle.sh?v=$(date +%s)" -o "$INSTALADOR" \
    || { rojo "No pude descargar nube/instalar-oracle.sh de github.com/$REPO. ¿Subiste la carpeta nube nueva?"; exit 1; }
fi

verde "1/5 Preparando la red (solo la primera vez)…"
V=$(crudo oci network vcn list -c "$C" --display-name orvix-red --query 'data[0].id')
if [ -z "$V" ]; then
  V=$(oci network vcn create -c "$C" --display-name orvix-red --cidr-blocks '["10.0.0.0/16"]' --dns-label orvixred \
      --wait-for-state AVAILABLE 2>/dev/null | nuevo_id)
fi
[ -n "$V" ] || { rojo "Oracle no dejó crear la red. Mándame una captura de esta ventana."; exit 1; }
G=$(crudo oci network internet-gateway list -c "$C" --vcn-id "$V" --query 'data[0].id')
if [ -z "$G" ]; then
  G=$(oci network internet-gateway create -c "$C" --vcn-id "$V" --is-enabled true --display-name orvix-internet \
      --wait-for-state AVAILABLE 2>/dev/null | nuevo_id)
fi
RT=$(crudo oci network vcn get --vcn-id "$V" --query 'data."default-route-table-id"')
SL=$(crudo oci network vcn get --vcn-id "$V" --query 'data."default-security-list-id"')
oci network route-table update --rt-id "$RT" --force \
  --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$G\"}]" >/dev/null

verde "2/5 Abriendo los puertos web (80 y 443)…"
REGLA() { echo "{\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"isStateless\":false,\"tcpOptions\":{\"destinationPortRange\":{\"min\":$1,\"max\":$1}}}"; }
oci network security-list update --security-list-id "$SL" --force \
  --ingress-security-rules "[$(REGLA 22),$(REGLA 80),$(REGLA 443),{\"source\":\"0.0.0.0/0\",\"protocol\":\"1\",\"isStateless\":false,\"icmpOptions\":{\"type\":3,\"code\":4}}]" \
  --egress-security-rules '[{"destination":"0.0.0.0/0","protocol":"all","isStateless":false}]' >/dev/null
S=$(crudo oci network subnet list -c "$C" --vcn-id "$V" --display-name orvix-subred --query 'data[0].id')
if [ -z "$S" ]; then
  S=$(oci network subnet create -c "$C" --vcn-id "$V" --cidr-block 10.0.0.0/24 --display-name orvix-subred \
      --dns-label orvixsub --wait-for-state AVAILABLE 2>/dev/null | nuevo_id)
fi
[ -n "$S" ] || { rojo "Oracle no dejó crear la subred. Mándame una captura de esta ventana."; exit 1; }

verde "3/5 Preparando la llave para entrar al servidor…"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
[ -f "$LLAVE" ] || ssh-keygen -q -t rsa -b 4096 -N '' -C orvix -f "$LLAVE"

CODIGO=""; ALFA=ABCDEFGHJKLMNPQRSTUVWXYZ23456789; for _ in 1 2 3 4 5 6 7 8; do CODIGO+=${ALFA:RANDOM%${#ALFA}:1}; done
DATOS_INICIO=$(mktemp)
{
  echo '#!/bin/bash'
  echo 'umask 077'
  echo "printf 'REPO=%q\nTOKEN=%q\nCODIGO=%q\n' $(printf '%q' "$REPO") $(printf '%q' "$TOKEN") $(printf '%q' "$CODIGO") > /etc/orvix.conf"
  echo "cat > /root/orvix-instalar.sh <<'ORVIX_FIN_DEL_INSTALADOR'"
  cat "$INSTALADOR"
  echo 'ORVIX_FIN_DEL_INSTALADOR'
  echo 'bash /root/orvix-instalar.sh'
} > "$DATOS_INICIO"

imagen() {   # Ubuntu (24.04 o 22.04, no "Minimal") compatible con el tipo de servidor
  local v id
  for v in 24.04 22.04; do
    id=$(crudo oci compute image list -c "$C" --operating-system "Canonical Ubuntu" --operating-system-version "$v" \
         --shape "$1" --sort-by TIMECREATED --sort-order DESC --all \
         --query 'data[?!contains("display-name", `Minimal`)]|[0].id')
    [ -n "$id" ] && { echo "$id"; return 0; }
  done
  return 0
}

verde "4/5 Creando el servidor gratis…"
ADS=$(oci iam availability-domain list -c "$C" 2>/dev/null | jq -r '.data[].name')
I=""
for FORMA in VM.Standard.A1.Flex VM.Standard.E2.1.Micro; do
  IMG=$(imagen "$FORMA")
  [ -n "$IMG" ] || continue
  EXTRA=(); [ "$FORMA" = VM.Standard.A1.Flex ] && EXTRA=(--shape-config '{"ocpus":2,"memoryInGBs":12}')
  for AD in $ADS; do
    echo "   Probando $FORMA en $AD…"
    if SALIDA=$(oci compute instance launch -c "$C" --availability-domain "$AD" --shape "$FORMA" "${EXTRA[@]}" \
        --image-id "$IMG" --subnet-id "$S" --assign-public-ip true --display-name "$NOMBRE" \
        --boot-volume-size-in-gbs 50 --ssh-authorized-keys-file "$LLAVE.pub" --user-data-file "$DATOS_INICIO" \
        --freeform-tags "{\"orvix-codigo\":\"$CODIGO\"}" \
        --wait-for-state RUNNING --max-wait-seconds 900 2>&1); then
      I=$(echo "$SALIDA" | grep -o 'ocid1\.instance\.[a-z0-9._-]*' | head -n 1 || true)
      [ -n "$I" ] && break 2
    fi
    if echo "$SALIDA" | grep -i 'capacity' >/dev/null; then echo "   (Oracle no tiene cupo ahí, pruebo otro)"
    elif echo "$SALIDA" | grep -iE 'LimitExceeded|limit' >/dev/null; then echo "   (tu cuenta no permite ese tipo, pruebo otro)"
    else echo "$SALIDA" | tail -n 5; fi
  done
done
rm -f "$DATOS_INICIO"
if [ -z "$I" ]; then
  rojo "Oracle no tiene servidores gratis disponibles en este momento. Es normal: vuelve a pegar el mismo comando en 1 o 2 horas (no crea nada repetido)."
  exit 1
fi
[ "$FORMA" = VM.Standard.E2.1.Micro ] && echo "   (Quedó en el servidor pequeño de 1 GB: aguanta 1 o 2 WhatsApp.)"

verde "5/5 Esperando a que se instale…"
sleep 30
esperar "$I" || exit 1

RESPALDO=$(buscar_respaldo)
if [ -n "$RESPALDO" ]; then
  subir_datos "$I" "$RESPALDO" || exit 1
  echo "   Dirección del panel:   $(direccion "$I")"
else
  mostrar "$I"
  echo "   (No subiste un respaldo de tu PC: empiezas con el CRM vacío."
  echo "    Si quieres pasar tus datos después:  bash $0 subir-datos)"
fi
