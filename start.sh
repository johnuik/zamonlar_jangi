#!/bin/sh
# ZAMONLAR JANGI — serverni ishga tushirish (yakka va tarmoq rejimi)
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js topilmadi. O'rnating: https://nodejs.org (macOS: brew install node · Linux: sudo apt install nodejs)"
  exit 1
fi
PORT=${PORT:-8090}
# brauzerni ochish: macOS — open, Linux — xdg-open
[ -n "$ZJ_NO_BROWSER" ] || (sleep 1 && (open "http://localhost:$PORT" >/dev/null 2>&1 || xdg-open "http://localhost:$PORT" >/dev/null 2>&1 || true)) &
# O'yin kodi yangilansa, server jang bo'lmayotgan paytda o'zi 75 kodi bilan chiqadi va shu yerda
# qayta ishga tushadi — eski server bilan o'ynab qolmaslik uchun. Ctrl+C odatdagidek to'xtatadi.
# Boshqa xato bilan to'xtasa (masalan, kod aynan tahrirlanayotgan paytda qayta yuklangan bo'lsa) — bir necha marta qayta uriniladi:
# server jimgina o'chib qolib, o'yinchilar ulana olmay qolmasligi uchun. Ketma-ket 5 marta darhol yiqilsa — to'xtaydi.
fails=0
while :; do
  t0=$(date +%s)
  PORT=$PORT ZJ_AUTORESTART=1 node server.js
  code=$?
  if [ $code -eq 75 ]; then fails=0; sleep 1; continue; fi
  if [ $code -eq 0 ] || [ $code -eq 130 ] || [ $code -eq 143 ]; then break; fi   # odatdagi to'xtatish (Ctrl+C)
  if [ $(( $(date +%s) - t0 )) -lt 5 ]; then fails=$((fails + 1)); else fails=0; fi
  if [ $fails -ge 5 ]; then echo "  Server ketma-ket ishga tushmadi (kod $code) — to'xtatildi."; break; fi
  echo "  Server xato bilan to'xtadi (kod $code) — 3 soniyadan keyin qayta ishga tushadi (Ctrl+C — to'xtatish)"
  sleep 3
done
