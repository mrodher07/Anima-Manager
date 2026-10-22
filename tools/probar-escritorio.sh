#!/usr/bin/env bash
# Prueba el programa de escritorio en Linux, en una pantalla virtual: compila la versión de
# prueba, la abre con tauri-driver y la maneja con tools/probar-escritorio.mjs.
#
# Necesita Xvfb, xdotool, WebKitWebDriver (paquete webkit2gtk-driver) y tauri-driver
# (`cargo install tauri-driver --locked`). Los datos van a una carpeta temporal que se
# borra al acabar: las fichas que tengas en el programa no se tocan.
#
#   npm run escritorio:probar
#   SIN_COMPILAR=1 FOTOS=/ruta/capturas npm run escritorio:probar
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

if [ -z "${SIN_COMPILAR:-}" ]; then
  npx tauri build --debug --no-bundle
fi

TMP="$(mktemp -d -t anima-manager-prueba-XXXXXX)"
export XDG_DATA_HOME="$TMP/datos" XDG_CONFIG_HOME="$TMP/config" XDG_CACHE_HOME="$TMP/cache"
mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

export DISPLAY="${PANTALLA:-:97}"
Xvfb "$DISPLAY" -screen 0 1400x1000x24 >/dev/null 2>&1 &
XVFB=$!
tauri-driver --port 4444 >"$TMP/tauri-driver.log" 2>&1 &
DRIVER=$!
trap 'kill $DRIVER $XVFB 2>/dev/null || true; rm -rf "$TMP"' EXIT
sleep 2

node tools/probar-escritorio.mjs
