---
tags: [nozik-nuqta, hardware]
created: 2026-05-29
---

# Hardware nozikliklari

## Muammo

POS tizimi fizik qurilmalar bilan ishlaydi: chek printer, pul yashigi (cash drawer), barkod skaneri. Bular ishlamay qolishi mumkin — tizim baribir ishlashi kerak.

## Chek printer

### Turlari
- **Termal printer** (ESC/POS) — eng keng tarqalgan (Xprinter, Epson TM)
- USB, Ethernet yoki Bluetooth ulanish
- 58mm yoki 80mm qog'oz

### Nozik nuqta 1: Printer offline (qog'oz tugadi, o'chgan)

Order tolandi, lekin chek bosilmadi (printer xato).

**Qaror:**
- Order tolovi **muvaffaqiyatli** (printer xatosi tolovni bekor qilmaydi)
- Chek **print queue**'ga tushadi
- POS UI: "Chek bosilmadi — printer tekshiring. [Qayta bosish]"
- Printer tuzalгач — qayta bosish

```javascript
async function printReceipt(order) {
  try {
    await printer.print(formatReceipt(order));
    await orderModel.updateOne({ _id: order._id }, { checkPrinted: true });
  } catch (err) {
    await printQueue.add(order._id);  // keyinroq qayta urinish
    emit('printer.error', { orderId: order._id, error: err.message });
    // Order tolovi baribir muvaffaqiyatli
  }
}
```

### Nozik nuqta 2: Ko'p printer (kitchen vs receipt)

Restoranda:
- **Receipt printer** — kassada, mijoz cheki
- **Kitchen printer** — oshxonada, oshpaz uchun order
- Ba'zan bar printer (ichimliklar uchun)

**Qaror:**
```javascript
// branch.printers config
printers: [
  { id: 'receipt', type: 'thermal', target: 'usb', role: 'receipt' },
  { id: 'kitchen', type: 'thermal', target: '192.168.1.50', role: 'kitchen' },
]
```

Order yaratilganda → kitchen printer'ga (oshpaz uchun). Tolovda → receipt printer'ga (mijoz cheki).

Kitchen printer — possiz/cook+waiter rejimida muhim emas (cook mobile ko'radi). Online rejimda — agar KDS yo'q bo'lsa, kitchen printer ovqat buyurtmasini chiqaradi.

### Nozik nuqta 3: Chek formati va valyuta

Chek printeri valyutani to'g'ri ko'rsatishi ([[pul-valyuta-yaxlitlash]]):
- UZS: "35 000 so'm"
- KZT: "35 000 ₸"

ESC/POS — kirill va lotin qo'llab-quvvatlashi (kodlash: CP866 yoki UTF-8, printer'ga qarab).

## Cash drawer (pul yashigi)

### Ulanish
Odatda printer orqali (RJ11 kabel printer'ga ulanadi). Printer ESC/POS buyruq bilan ochadi:
```javascript
// Kassa yashigi ochish (ESC/POS)
printer.write(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]));
```

### Nozik nuqta: svet yo'q yoki drawer ulanmagan
- Possiz rejimda svet yo'q → drawer ochilmaydi (qo'lda ochiladi — kalit bor)
- Naqd tolovda drawer avtomatik ochiladi (online/offline)
- Kaspi/karta tolovda — drawer **ochilmaydi** (naqd yo'q)

```javascript
if (paymentMethod === 'cash' || (paymentMethod === 'mixed' && mixed.cash > 0)) {
  await openCashDrawer();
}
```

## Barkod skaneri

Asosan **sklad** uchun (ingredient kelishi) yoki tez taom tanlash.
- USB HID — klaviatura sifatida ko'rinadi (input field'ga yozadi)
- Maxsus drayver kerak emas (keyboard wedge)

Nozik nuqta: skaner input fokusni o'g'irlashi mumkin — UI ehtiyot.

## Mijoz display (narx ko'rsatuvchi)

Ikkinchi ekran yoki LCD — mijozga narx ko'rsatadi. Kelajak. Hozircha yo'q.

## Hardware abstraktsiya qatlami

> [!important] Hardware abstraksiya
> Electron main process'da `hardware/` moduli — printer, drawer, scanner uchun yagona interfeys. Implementatsiya har xil bo'lishi mumkin (har xil printer modeli), lekin interfeys bir xil.

```javascript
// hardware/printer.interface.js
class PrinterInterface {
  async print(content) {}
  async openDrawer() {}
  async getStatus() {}  // online, paper, error
}

// hardware/escpos-printer.js — ESC/POS implementatsiya
class EscPosPrinter extends PrinterInterface { ... }
```

Yangi printer modeli qo'shilsa — yangi implementatsiya, interfeys o'zgarmaydi.

## Admin huquqi va hardware

Qarang: [[../02-arxitektura/local-backend-stack#Nima uchun Administrator huquqi kerak]]
- Ba'zi printer drayverlari admin huquqini talab qiladi
- USB device access
- Shuning uchun POS Electron — admin sifatida ochiladi

## Hardware test rejimi

Admin POS'da "Hardware test" sahifasi:
- "Test chek bosish"
- "Drawer ochish"
- "Printer holati" (online/paper/error)
- "Skaner test"

O'rnatish paytida hardware ulanishini tekshirish.

## Test rejasi

- [ ] Printer offline → tolov muvaffaqiyatli, queue'ga
- [ ] Print queue retry
- [ ] Kitchen vs receipt printer
- [ ] Valyuta chek'da to'g'ri
- [ ] Cash drawer faqat naqd tolovda
- [ ] Drawer Kaspi/karta'da ochilmaydi
- [ ] Hardware abstraction interface
- [ ] Hardware test sahifasi

## Bog'liq

- [[pul-valyuta-yaxlitlash]] — chek valyuta
- [[../02-arxitektura/local-backend-stack]] — admin huquqi
- [[../02-arxitektura/rejimlar/possiz-rejim]] — chek yo'q (PDF)
- [[chek-raqamlash]]
