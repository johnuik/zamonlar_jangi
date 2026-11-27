# ZAMONLAR JANGI

Brauzerda ishlaydigan 3D jang o'yini (Three.js): yakka rejim va bitta tarmoqdagi (LAN) do'stlar bilan o'yin.
Modellar, tovushlar va effektlar kodda yaratiladi. Yuzalar (asfalt, g'isht, suvoq, beton, qum, qor ...) uchun `assets/tex` papkasida
bepul (CC0, Poly Haven) foto-teksturalar, `assets/models` da esa foto-skanerlangan mayda jismlar (bochka) bor; papka o'chirilsa yoki manzilga `?foto=0` qo'shilsa,
o'yin kodda chizilgan tekstura va shakllar bilan ishlaydi. Yangi modelni `tools/bakemodel.py` o'yin formatiga o'giradi (macOS: `sips` kerak).
`assets/models/chars` da askar va zombi modellari (suyakli glTF, CC BY — mualliflar: `assets/models/CREDITS.txt`): ular o'yindagi
harakat tizimiga ulanadi (`js/charskin.js`) — model yuklanmasa yoki `?foto=0` bo'lsa, kodda qurilgan askarlar ishlatiladi.
`assets/models/veh` da transport (tanklar, jiplar, Ural, Mi-24, Chinuk, dron — `js/vehskin.js`), `assets/models/guns` da qo'ldagi qurollar
(o'yinchining barcha qurollari, granatomyotlar, pichoq va askarlar qo'lidagi qurollar — `js/gunskin.js`) modellari: minora, parrak va g'ildiraklar
harakatlanadi, qurolning mo'ljal chizig'i modeldan avtomatik topiladi, magazin qayta o'qlashda chiqib-kiradi. Turel (DShK / Maksim pulemyoti:
taglik joyida, pulemyot aylanadi — `js/vehskin.js`, TURRET_DEFS) va dron ham modelda. Model topilmagan kvadrotsikl, zenit pushkasi va
transportdagi bort pulemyoti kodda qurilgan ko'rinishda qoladi.

## Ishga tushirish

```sh
./start.sh            # yoki: npm start
```

Server `http://localhost:8090` da ochiladi (boshqa port: `PORT=8081 ./start.sh`). Do'stlar terminalda ko'rsatilgan
manzilni brauzerda ochib, xona kodi bilan qo'shiladi. Node.js kerak.

## Nimalar bor

- **Davrlar:** 1944 «Qishki front» va 2026 «Cho'l bo'roni».
- **Xaritalar (har biri o'z tuzilishida):** Yangi shahar — zich kvartallar, ko'chalar «#» shaklida, markazi piyodalar hududi; Shaharcha — kichik chorraha qishlog'i;
  Aerodrom — ochiq uchish yo'lagi, angarlar, boshqaruv minorasi, dotlar; Karantin zonasi — 800 × 800 m: shaharcha, qishloqlar, ferma, o'rmon, temir yo'l, harbiy baza.
- **Yakka rejim:** 10 ta dushman to'lqini yoki Zombi rejimi (pastga qarang).
- **Tarmoq (8 kishigacha):** Bayroq, Deathmatch, Jamoaviy jang, Zombi. Transportli yoki transportsiz.
- **Zombi rejimi — Karantin zonasi:** 800 × 800 m xaritada besh bosqichli vazifa (qishloqqa yetish → uch joydan ratsiya qismlarini topish →
  radio minorani ushlab turish → harbiy bazaga o'tish → vertolyot maydonini himoya qilish). Shom tunga aylanadi; zombilar hamma joyda tentirab
  yuradi va ko'rish hamda shovqinga (o'q, portlash, transport, yugurish) qarab sezadi — cho'kkalab chetlab o'tsa bo'ladi. Qurol, o'q-dori va dori
  binolardan topiladi (o'q tanqis). Yakka o'yinda ikki marta qayta urinish mumkin; tarmoqda halok bo'lgan odam zombi bo'lib qaytadi.
- **Klasslar:** Avtomatchi, Injener, Snayper, Shturmchi, Pulemyotchi, Mergan. Daraja oshgan sari muqobil qurollar va
  qo'shimchalar (optika, so'ndirgich, tutqich, katta magazin, lazer) ochiladi.
- **Noyob qurollar:** bazuka/RPG (faqat ko'rib turgan transportni belgilaydi va quvadi), avtomatik turel, o'yinchi o'zi boshqaradigan dron (1 ta bomba, nishonga borib urilsa portlaydi, bitta o'q tegsa yo'q bo'ladi), tankbuzar miltiq.
- **Xonalardagi qurollar:** har jangda uylar, omborlar va dotlarda tasodifiy qurollar paydo bo'ladi (`E` — olish).
- **Harakat:** yugurish, cho'kkalash `C`, yotish `Z`, to'siq va deraza ustidan oshib o'tish `Probel`. Deraza oynalari o'q, portlash yoki oshib o'tishdan sinadi.
- **Torayuvchi zona (tarmoq):** xavfsiz doira bosqichma-bosqich kichrayadi; qayta tug'ilish doim doira ichida.
- **Vositalar:** aptechka, bint `H`, zirh nimcha, adrenalin, o'q-dori, granatalar. Jon o'zi tiklanmaydi — faqat shular orqali.
- **Transport:** vertolyot, Chinuk, jip, kvadrotsikl, ikki xil tank, Kamaz, zenit pushkasi.
- **Tarmoqda:** jamoa tanlash (lobbida), chat `T`, belgi qo'yish `X`, katta xarita `M`, kim o'ldirganini ko'rsatish, aloqa uzilsa qayta ulanish. Sheriklar uzoqdan va devor ortidan ham ko'k yozuv bilan ko'rinadi.

To'liq boshqaruv ro'yxati — o'yin menyusidagi «Boshqaruv» bo'limida.

## Kod tuzilishi

| Fayl | Vazifasi |
|---|---|
| `server.js` | Statik fayllar va WebSocket serveri: xonalar, hisob, rejimlar, qayta ulanish |
| `js/shared.mjs` | Server va brauzer uchun umumiy jadvallar (xaritalar, transport joylari, doimiylar) |
| `js/main.js` | Kirish nuqtasi: modullarni ulaydi, asosiy sikl |
| `js/core.js` | Umumiy holat (`G`), renderer, kamera, sozlamalar |
| `js/world.js` | Dunyo: binolar va pana joylar quruvchilari, to'qnashuv (to'r bilan tezlashtirilgan), botlar uchun yo'l topish; Shaharcha va Yangi shahar xaritalari |
| `js/wild.js`, `js/airfield.js` | Karantin zonasi (zombi rejimi xaritasi) va Aerodrom xaritalari |
| `js/movement.js`, `js/input.js` | O'yinchi harakati, yotish, oshib o'tish, kamera; klaviatura va sichqoncha |
| `js/arsenal.js`, `js/weapons.js`, `js/viewmodel.js`, `js/ordnance.js`, `js/turret.js`, `js/drone.js` | Qurollar, otish, granata/raketa, turel, boshqariladigan dron |
| `js/transport.js`, `js/vehicles.js` | Transport |
| `js/game.js`, `js/zmode.js`, `js/zombie.js`, `js/soldier.js` | Yakka rejim; zombi rejimi (vazifalar zanjiri, zombilar sezgisi va "rejissyori"); botlar |
| `js/mp.js`, `js/net.js`, `js/social.js` | Tarmoq mijozi, chat, belgilar |
| `js/items.js`, `js/progress.js` | Vositalar; tajriba, darajalar, qurol to'plami |
| `js/hud.js`, `js/menu.js` | Ekrandagi ko'rsatkichlar va menyular |
| `js/gfx.js`, `js/post.js`, `js/fx.js`, `js/scene.js` | Shaderlar, keyingi ishlov, zarrachalar, sahna |
| `js/charskin.js`, `js/vehskin.js`, `js/gunskin.js` | Haqiqiy 3D modellarni (askar, transport, qurol) o'yindagi harakat tizimiga ulash |
| `js/modes.js` | Jang maydoni (PUBG uslubi) va Gun game rejimlarining mijoz tomoni |

## Sinovlar

Sinovlar Chrome'ni fon rejimida boshqaradi (Chrome o'rnatilgan bo'lishi kerak; boshqa joyda bo'lsa `CHROME=/yo'l`).

```sh
npm test                          # hammasi (dasturiy chizish — sekin, har mashinada bir xil)
ZJ_GL=metal npm test              # haqiqiy videokartada (macOS) — bir necha baravar tez va barqaror
node tests/run.js features tank   # faqat tanlangan sinovlar
node tests/run.js smoke           # butun o'yinni "yurib chiqish": har bir davr × xarita × rejim, hamma qurol va transport (ZJ_SMOKE=quick — qisqasi)
```

Har bir sinov uchun alohida server ishga tushadi; to'liq chiqish `$TMPDIR/zj-test/<nom>.log` da, skrinshotlar ham shu papkada.
Sinovlar kichik «Shaharcha» xaritasida ishlaydi (`ZJ_MAP=town`, sahifada `?xarita=town`).
Qurollarning tasodifiy joylashuvi sinovlarda o'chirilgan (`ZJ_SEED=0`, sahifada `?urug=0`); oddiy o'yinda har jang yangi urug' bilan boshlanadi.
