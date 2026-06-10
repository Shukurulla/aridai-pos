---
sana: 2026-06-10
mavzu: Keldi-ketti moduli + 30-agentlik adversarial review → 23 bug tuzatildi
status: bajarildi
---

# Keldi-ketti (4-modul) + PRO review

## Keldi-ketti ✅
salary_rule (5 tip) + attendance (kechikish/shtraf/tungi, 1 kun unique) + payroll
(idempotent hisob, breakdown). Mobil "Я ПРИШЁЛ/УШЁЛ" (Профиль), filial_admin
"Сотрудники" (davomat + Оплата modal + Зарплата → Выплатить).

## Adversarial review (ultracode): 6 yo'nalish × 2 skeptik = 24 topilma, 23 REAL
Eng muhimlari va tuzatishlar:
- **Partial→full deadlock**: server услугаni waive qilgan, POS filial %' fallback
  qo'shib mixed to'lovni umuman o'tkazmasdi / naqdda ortiqcha undirardi →
  partiallyPaid'da barcha fallbacklar o'chirildi (Payment/chek/prechek).
- **partiallyPaid cancel** yig'ilgan pulni hisobotdan yo'qotardi (firibgarlik
  teshigi) → cancel/pos-cancel/force-close blok.
- **Keshbek spend retry'da 2x** → orderId idempotent; **refund** endi spend'ni
  qaytaradi + earn sessiyani o'chiradi; refunded chekdan earn yo'q.
- **Sklad**: global'da yaratilgan order POS'da cancel bo'lsa qaytmasdi →
  retsept-fallback restore; push applied-flag (yarim qo'llanish).
- **Global hourly** flat narx yozardi → itemLineAmount parity; pos pay freeze.
- **QR approve** parallel 2x order → atomik claim.
- Qisman chek chiqmasdi (paymentSession shakli), manfiy split, refunded
  guardlari, React hook crash, Personal UTC sana.

## QAROR
Refund SKLADGA QAYTARMAYDI (taom tayyor/berilgan); cancel — qaytaradi.
