---
tags: [moc, frontend]
created: 2026-05-29
---

# Frontend MOC

Tizimda **4 ta frontend** + 1 umumiy arxitektura.

## Hujjatlar

- [[umumiy-arxitektura|Umumiy frontend arxitekturasi]] — API client, socket client, state, offline-first patterns
- [[web-admin|Web admin panel]] — super_admin (React/Next)
- [[pos-electron|POS Electron]] — desktop POS (renderer)
- [[mobile-flutter|Mobile (Flutter)]] — barcha rollar bitta ilovada
- [[mijoz-qr-web|Mijoz QR web]] — stol QR menyu (public)

## Texnologiyalar xulosa

| Ilova | Texnologiya | Platforma | Ulanish |
|---|---|---|---|
| Web admin | React + Vite (yoki Next.js) | Brauzer | Global VPS REST + socket |
| POS Electron | React (renderer) + Electron main (local backend) | Windows desktop | Lokal backend (IPC) |
| Mobile | Flutter | iOS + Android | Global VPS (online), local (possiz) |
| Mijoz QR | React + Vite (yengil) | Brauzer (mijoz tel) | Global VPS public API |

## Umumiy printsiplar

1. **Server-side authority** — frontend hech qachon total/narx hisoblamaydi (faqat ko'rsatadi), server hisoblaydi
2. **Optimistic UI** — POS'da lokal darhol yangilanadi, sync fonda
3. **Feature-flag aware** — `features.X.enabled` bo'yicha conditional render
4. **Role-based UI** — bir mobile ilova, role'ga qarab interfeys
5. **Tilga moslashuvchan** — i18n ([[../02-arxitektura/lokalizatsiya]])

## Bog'liq

- [[../01-vizyon/roadmap]] — qaysi frontend qaysi Phase'da
- [[../02-arxitektura/socket-sinxronizatsiya]]
- [[../03-tool-strategiyasi/feature-toggle-tizimi]]
