#!/bin/sh
# ZAMONLAR JANGI — serverni ishga tushirish (yakka va tarmoq rejimi)
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js topilmadi. O'rnating: sudo apt install nodejs"
  exit 1
fi
PORT=${PORT:-8090}
[ -n "$ZJ_NO_BROWSER" ] || (sleep 1 && (xdg-open "http://localhost:$PORT" >/dev/null 2>&1 || true)) &
# O'yin kodi yangilansa, server jang bo'lmayotgan paytda o'zi 75 kodi bilan chiqadi va shu yerda
# qayta ishga tushadi — eski server bilan o'ynab qolmaslik uchun. Ctrl+C odatdagidek to'xtatadi.
while :; do
  PORT=$PORT ZJ_AUTORESTART=1 node server.js
  [ $? -eq 75 ] || break
  sleep 1
done
