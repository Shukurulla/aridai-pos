---
tags: [changelog, mobile, admin, crud, menyu, kategoriya, stol]
created: 2026-06-04
modul: aridai-pos-app · branch_admin
---

# Admin mobil CRUD — Menyu / Kategoriya / Stollar

> Mobil ilovada filial admin endi faqat **koʻrish** emas, balki **boshqarish** ham qila oladi:
> Blyuda (taom), Kategoriya va Stol/kabina'larni qoʻshish · tahrirlash · oʻchirish.

## Nima qilindi

`aridai-pos-app` filial admin home'iga **5-tab «Меню»** qoʻshildi. Ichida 3 boʻlimli
segment (SegmentedControl): **Блюда · Категории · Столы**. Har boʻlimda roʻyxat +
qoʻshish (FAB) + tahrirlash (tap) + oʻchirish (long-press / swipe).

### 1. Блюда (taom) — toʻliq CRUD + rasm
- Roʻyxat: kategoriya boʻyicha guruhlangan, rasm thumbnail + nom + narx.
- Forma (alohida sahifa `admin_food_form.dart`): nom, narx, kategoriya (dropdown),
  rasm (image_picker — galereya/kamera), `isHourly` (soatlik) toggle, tavsif.
- Rasm `multipart/form-data` orqali `POST /foods/create` ga yuboriladi.

### 2. Категории — CRUD (dialog)
- Roʻyxat: nom + ichidagi taomlar soni.
- Dialog: faqat `title`. Oʻchirishda ogohlantirish (taomlar bogʻlangan boʻlishi mumkin).

### 3. Столы — CRUD (dialog)
- Roʻyxat: raqam + nom + tur (stol/kabina/bilyard…).
- Dialog: `number`, `title`, `type` (chip tanlov: normal/vip/billiard).

## Backend oʻzgarishi (ishonchlilik)

`category` va `food` modellari `restaurantId` ni **required** qiladi, lekin
`POST /create` route'lari uni faqat `req.body` dan olardi. Mobil klient adashmasligi
uchun **`table` route'i kabi token-fallback** qoʻshildi:

```js
const branch = req.body.branch || String(req.userData.branch);
const restaurantId = req.body.restaurantId || req.userData.restaurantId;
```

→ Web filial_admin paneliga taʼsir yoʻq (u allaqachon body'da yuboradi); fallback
faqat body boʻsh boʻlsa ishlaydi. Mobil klient endi faqat `title`/`name`/`price`/
`category` yuborsa kifoya.

## Yangi/oʻzgargan fayllar

**Backend**
- `routes/category.routes.js` — POST /create token-fallback (branch + restaurantId)
- `routes/food.routes.js` — POST /create token-fallback (branch + restaurantId)

**Flutter (aridai-pos-app)**
- `pubspec.yaml` — `image_picker` qoʻshildi
- `lib/models/food.dart` — `description` maydoni qoʻshildi (tahrir formasi uchun)
- `lib/services/api_service.dart` — createCategory/updateCategory/deleteCategory,
  createTable/updateTable/deleteTable, createFood/updateFood/deleteFood (+`_writeMultipart`, `_deletePath`)
- `lib/screens/admin/admin_menu_tab.dart` — YANGI (3 boʻlimli segment)
- `lib/screens/admin/admin_food_form.dart` — YANGI (taom qoʻshish/tahrir + rasm)
- `lib/screens/home/admin_home.dart` — 5-tab «Меню» (bottom-nav)

## Choziluvchanlik (toggle)

Bu modul mavjud `branch_admin` rolining tabiiy davomi — alohida feature toggle
talab qilmaydi (menyu boshqaruvi adminning asosiy vazifasi). Lekin kelajakda
«faqat owner menyuni oʻzgartiradi» rejimi kerak boʻlsa — `menuManageBy` toggle
qoʻshiladi (owner | branch_admin).

## Bogʻliq
- [[aridai-pos-app-reja]]
- [[2026-06-04-fcm-push]] (oldingi qadam)
