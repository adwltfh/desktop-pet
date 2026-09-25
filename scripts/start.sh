#!/usr/bin/env bash
# Jalan lewat salinan Electron ber-identity sendiri (scripts/dev-app.js),
# bukan node_modules/electron/dist/Electron.app langsung -- supaya macOS
# kasih izin Notification (dan Accessibility/Automation) ke app ini secara
# konsisten antar-launch, bukan ke identity generik "Electron" yang dipakai
# bareng semua app Electron dev lain di mesin ini.
set -euo pipefail

cd "$(dirname "$0")/.."

app_path="$(node scripts/dev-app.js)"

exec "$app_path/Contents/MacOS/Electron" .
