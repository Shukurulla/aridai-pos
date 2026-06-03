---
sana: 2026-06-02
mavzu: Услуга% revert bug — POS o'zgarishni global'ga push qilish
status: bajarildi
---

# Услуга% saqlanmay 10 ga qaytib qolardi (revert bug) — tuzatildi

## Muammo
POS Settings'da услуга'ni 30% qilib saqlasa: orderlar darhol 30% bilan hisoblanardi, LEKIN
~10s keyin Settings'ga qaytsa yana 10% bo'lib qolardi (revert).

## Sabab
- POS `PUT /api/restaurant/settings` faqat LOCAL serviceModel'ni 30 qiladi (orderlar shu sabab
  30% ishlatadi) va `syncStatus:"pending"` belgilaydi.
- LEKIN sync PUSH faqat **order/shift**'ni jo'natadi — **service'ni emas**. Ya'ni o'zgarish
  global'ga hech qachon yetib bormaydi.
- Sync PULL (bootstrap, har 10s) global'dan `services`'ni tortib local'ni `replaceOne` bilan
  **qayta yozadi** → local 30 → global'dagi eski 10 ga qaytadi.

## Yechim
- **Global**: yangi `PUT /api/sync/service` (branchAuth) — POS o'zgarishini global serviceModel'ga
  yozadi (branch bo'yicha topadi yoki `_id` bilan; tenant guard). 0 = o'chiq.
- **Local** `restaurant.routes.js` PUT /settings: local'ni yangilagach **global'ga push** qiladi
  (`fetch PUT /api/sync/service`, branchToken bilan, `_id` yuboradi — local↔global bir xil _id).
  Endi keyingi bootstrap PULL global'dan **30**'ni tortadi → local 30 qoladi (revert yo'q).
- Izoh aniqlashtirildi: услуга faqat **зал (dine-in)** orderlarga; Собой — услугаsiz.

## Sinov (verified)
- 30 saqlandi → LOCAL 30% → GLOBAL 30% (push bordi) → **12s keyin (sync sikli) LOCAL hali 30%** ✅.
- Asl 10% ga qaytarildi (endi u ham barqaror).

## Eslatma — Собой услуга
- Услуga faqat dineIn (зал) — bu avval saboy dizayni bo'yicha ataylab (saboy=stolsiz=услугаsiz).
- Agar kelajakda "barcha orderga (Собой ham) услуga" kerak bo'lsa — alohida o'zgarish:
  saboy create + pay mantiqи + izoh.
