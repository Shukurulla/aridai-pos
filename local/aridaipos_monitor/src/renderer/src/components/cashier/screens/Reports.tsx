"use client";

import { useState, useEffect, useCallback } from "react";
import {
  api,
  FullReport,
  FoodReportItem,
  CancelledItemsResponse,
} from "@/services/api";
import { PrinterAPI } from "@/services/printer";
import { T, NavIcon, fmt } from "@/lib/theme";
import { SubHeader, SectionTitle, MiniStat, CTA } from "../shell";
import { ScreenCtx } from "./types";

type Tab =
  | "general"
  | "waiters"
  | "cooks"
  | "categories"
  | "foods"
  | "cancelled";

export function ReportsScreen({ ctx }: { ctx: ScreenCtx }) {
  const restaurant = ctx.restaurant;
  const [tab, setTab] = useState<Tab>("general");
  const [report, setReport] = useState<FullReport | null>(null);
  const [cancelled, setCancelled] = useState<CancelledItemsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [cancelledLoading, setCancelledLoading] = useState(false);
  const [printing, setPrinting] = useState<string | null>(null);

  // Способы оплаты — ТОТ ЖЕ источник, что и шапка (ctx.summary), чтобы
  // Наличные+Карта+Перевод всегда сходились с «Итого выручка».
  // /api/hisobot (report) и /api/reports (шапка) считают наличные по-разному
  // (одно за вычетом расходов) → раньше суммы не совпадали. Берём summary;
  // если он пуст (0) — откатываемся к report.
  const _s = ctx.summary;
  const _useSummary = (_s?.totalRevenue || 0) > 0;
  const payCash = _useSummary
    ? _s.cashRevenue || 0
    : report?.paymentMethods.cash.total || 0;
  const payCard = _useSummary
    ? _s.cardRevenue || 0
    : report?.paymentMethods.card.total || 0;
  const payClick = _useSummary
    ? _s.clickRevenue || 0
    : report?.paymentMethods.click.total || 0;
  const payTotal = _useSummary
    ? _s.totalRevenue || 0
    : report?.sales.totalRevenue || 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await api.getFullReport(ctx.activeShift?._id));
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [ctx.activeShift?._id]);

  useEffect(() => {
    load();
  }, [load]);

  // #7: отчёты в реальном времени — тихий рефреш без спиннера:
  //  • при каждом socket-обновлении заказов (ctx.orders меняется в CashierApp),
  //  • и страховочный интервал каждые 10с.
  const shiftId = ctx.activeShift?._id;
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const r = await api.getFullReport(shiftId);
        if (alive) setReport(r);
      } catch {
        /* keep previous */
      }
      if (alive && tab === "cancelled") {
        try {
          const c = await api.getCancelledItems(shiftId);
          if (alive) setCancelled(c);
        } catch {
          /* keep previous */
        }
      }
    };
    refresh();
    const t = setInterval(refresh, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // ctx.orders — ссылка меняется на каждом socket-событии в CashierApp
  }, [ctx.orders, shiftId, tab]);

  useEffect(() => {
    if (tab === "cancelled" && !cancelled) {
      setCancelledLoading(true);
      api
        .getCancelledItems(shiftId)
        .then(setCancelled)
        .catch(() =>
          setCancelled({
            items: [],
            totalCancelledItems: 0,
            totalCancelledValue: 0,
          }),
        )
        .finally(() => setCancelledLoading(false));
    }
  }, [tab, cancelled, shiftId]);

  const reportDate = () => new Date().toLocaleDateString("ru-RU");
  const header = (title: string) => ({
    restaurantName: restaurant?.name || "РЕСТОРАН",
    date: reportDate(),
    title,
  });

  const runPrint = async (
    id: string,
    call: () => Promise<{ success: boolean; error?: string }>,
  ) => {
    setPrinting(id);
    try {
      const res = await call();
      if (!res.success) alert("Ошибка печати: " + (res.error || ""));
    } catch {
      alert("Ошибка принтера");
    } finally {
      setPrinting(null);
    }
  };

  const printGeneral = () =>
    runPrint("general", () =>
      PrinterAPI.printRevenue({
        printerName: "",
        currency: "₸",
        header: header("ОБЩАЯ ВЫРУЧКА"),
        sections: [
          {
            title: "СПОСОБЫ ОПЛАТЫ",
            rows: [
              {
                label: "Наличные",
                amount: payCash,
                count: report?.paymentMethods.cash.count || 0,
              },
              {
                label: "Карта",
                amount: payCard,
                count: report?.paymentMethods.card.count || 0,
              },
              {
                label: "Перевод",
                amount: payClick,
                count: report?.paymentMethods.click.count || 0,
              },
            ],
          },
          {
            title: "ИТОГИ",
            rows: [
              { label: "Блюда", amount: report?.sales.foodRevenue || 0 },
              ...(report?.sales.hourlyChargeRevenue
                ? [
                    {
                      label: "Занятость",
                      amount: report.sales.hourlyChargeRevenue,
                    },
                  ]
                : []),
              {
                label: "Кол-во чеков",
                value: String(report?.sales.totalChecks || 0),
              },
              { label: "Средний чек", amount: report?.sales.averageCheck || 0 },
            ],
          },
        ],
        grandTotal: payTotal,
      }),
    );

  const printWaiters = () =>
    runPrint("waiters", () =>
      PrinterAPI.printWaiters({
        printerName: "",
        currency: "₸",
        header: header("ПО ОФИЦИАНТАМ"),
        waiters: (report?.staff.waiters || []).map((w) => ({
          name: w.name,
          ordersCount: w.totalOrders,
          totalRevenue: w.totalRevenue,
          averageCheck: w.averageCheck,
        })),
        grandTotal: report?.sales.totalRevenue || 0,
      }),
    );

  const printCooks = () =>
    runPrint("cooks", () =>
      PrinterAPI.printRevenue({
        printerName: "",
        currency: "₸",
        header: header("ПО ПОВАРАМ"),
        sections: (report?.staff.cooks || []).map((ck) => ({
          title: `${ck.name} — ${ck.totalItems} блюд`,
          rows: ck.dishes.map((d) => ({
            label: `${d.name} (${d.categoryName})`,
            value: `x${d.quantity}`,
          })),
        })),
      }),
    );

  const printCategories = () =>
    runPrint("categories", () =>
      PrinterAPI.printByKitchen({
        printerName: "",
        currency: "₸",
        header: header("ПРОДАЖИ ПО КУХНЯМ"),
        kitchens: [
          {
            name: "",
            items: (report?.categories.items || []).map((c) => ({
              name: c.name,
              qty: c.totalQuantity,
              price: 0,
              total: c.totalRevenue,
            })),
            subtotal: report?.sales.foodRevenue || 0,
          },
        ],
        grandTotal: report?.sales.foodRevenue || 0,
      }),
    );

  const printFoods = () => {
    const groups = new Map<string, FoodReportItem[]>();
    (report?.foods.items || []).forEach((f) => {
      const k = f.categoryName || "Другое";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(f);
    });
    return runPrint("foods", () =>
      PrinterAPI.printSoldFoods({
        printerName: "",
        currency: "₸",
        header: header("ПРОДАННЫЕ БЛЮДА"),
        categories: Array.from(groups.entries()).map(([name, items]) => ({
          name,
          items: items.map((f) => ({
            name: f.name,
            qty: f.totalQuantity,
            price: f.price,
            total: f.totalRevenue,
          })),
          subtotal: items.reduce((s, f) => s + f.totalRevenue, 0),
        })),
        grandTotal: report?.sales.foodRevenue || 0,
      }),
    );
  };

  const printCancelled = () =>
    runPrint("cancelled", () =>
      PrinterAPI.printCancelled({
        printerName: "",
        currency: "₸",
        header: header("ОТМЕНЁННЫЕ"),
        items: (cancelled?.items || []).map((it) => ({
          time: "",
          tableName: `#${it.orderNumber}`,
          foodName: it.foodName,
          qty: it.quantity,
          total: it.total,
          reason: `${it.type === "order_cancelled" ? "[ЗАКАЗ]" : "[БЛЮДО]"} ${it.cancelReason || "-"}`,
          cancelledBy: it.cancelledBy,
        })),
        totalCount: cancelled?.totalCancelledItems || 0,
        grandTotal: cancelled?.totalCancelledValue || 0,
      }),
    );

  // АКТ РЕАЛ — to'liq smena akti (sotilgan + bekor manfiy) + Итоговый отчёт
  const printActReal = () =>
    runPrint("act-real", async () => {
      const sid = ctx.activeShift?._id;
      const rep = report || (await api.getFullReport(sid));
      const can = await api.getCancelledItems(sid);

      type Row = { name: string; qty: number; price: number; sum: number };
      const rows: Row[] = [];
      (rep?.foods.items || []).forEach((f) =>
        rows.push({ name: f.name, qty: f.totalQuantity, price: f.price, sum: f.totalRevenue }),
      );
      // Bekor (otkaz): foodName+narx bo'yicha agregatsiya — order VA item bekor.
      const cm = new Map<string, Row>();
      (can?.items || []).forEach((c) => {
        const key = `${c.foodName}@@${c.price}`;
        const e = cm.get(key) || { name: c.foodName, qty: 0, price: c.price, sum: 0 };
        e.qty -= c.quantity;
        e.sum -= c.total;
        cm.set(key, e);
      });
      cm.forEach((v) => rows.push(v));
      rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));

      const totQty = rows.reduce((s, r) => s + r.qty, 0);
      const totSum = rows.reduce((s, r) => s + r.sum, 0);
      const cancelledOrderIds = new Set((can?.items || []).map((c) => c.orderId));
      const refusalPositions = (can?.items || []).reduce((s, c) => s - c.quantity, 0);

      const pm = rep?.paymentMethods;
      const grand = rep?.sales.totalRevenue || 0;
      const payments: { name: string; sum: number }[] = [];
      if (pm) {
        const cardV = pm.card.total || 0;
        const clickV = pm.click.total || 0;
        // Наличные = всего − карта − перевод, чтобы способы оплаты ВСЕГДА
        // сходились с «ИТОГО» (как в шапке). /api/hisobot отдаёт наличные
        // за вычетом расходов → раньше акт не сходился.
        const cashV = Math.max(0, grand - cardV - clickV);
        if (cardV) payments.push({ name: "Картой", sum: cardV });
        if (cashV) payments.push({ name: "Наличными", sum: cashV });
        if (clickV) payments.push({ name: "Click/Перевод", sum: clickV });
      }
      const staff = (rep?.staff.waiters || []).map((w) => ({
        name: w.name,
        count: w.totalOrders,
        service: w.serviceRevenue || 0,
        sum: w.totalRevenue,
      }));
      const subs = (rep?.categories.items || []).map((c) => ({
        name: c.name,
        count: c.itemCount,
        service: 0,
        sum: c.totalRevenue,
      }));
      const subTotal = subs.reduce(
        (a, s) => ({ count: a.count + s.count, service: 0, sum: a.sum + s.sum }),
        { count: 0, service: 0, sum: 0 },
      );
      const orderPositions =
        rep?.foods.totalSold ||
        rows.filter((r) => r.qty > 0).reduce((s, r) => s + r.qty, 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sh = ctx.activeShift as any;
      const fmtDT = (d?: string) => (d ? new Date(d).toLocaleString("ru-RU") : "");

      return PrinterAPI.printActReal({
        printerName: "",
        currency: "₸",
        header: header("АКТ РЕАЛ"),
        shift: {
          from: fmtDT(sh?.openedAt || sh?.startTime || sh?.createdAt),
          to: fmtDT(sh?.closedAt || sh?.endTime),
        },
        items: rows,
        totals: { qty: totQty, sum: totSum },
        summary: {
          totalChecks: rep?.sales.totalChecks || 0,
          orderPositions,
          refusalChecks: cancelledOrderIds.size,
          refusalPositions,
          refusalSum: -(can?.totalCancelledValue || 0),
          guests: rep?.sales.totalChecks || 0,
          transfers: 0,
          unlocks: 0,
        },
        payments,
        paymentsTotal: grand,
        staff,
        subdivisions: subs,
        subTotal,
        clients: [
          {
            name: "Частное лицо",
            checks: rep?.sales.totalChecks || 0,
            orders: orderPositions,
            sum: grand,
            sumNoDiscount: grand,
          },
        ],
      });
    });

  const tabs: {
    id: Tab;
    label: string;
    icon: Parameters<typeof NavIcon>[0]["kind"];
  }[] = [
    { id: "general", label: "Общая выручка", icon: "money" },
    { id: "waiters", label: "По официантам", icon: "user" },
    { id: "cooks", label: "По поварам", icon: "user" },
    { id: "categories", label: "По кухням", icon: "pos" },
    { id: "foods", label: "Проданные блюда", icon: "receipt" },
    { id: "cancelled", label: "Отменённые", icon: "x" },
  ];

  const esc = (s: unknown) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
          c
        ] as string,
    );

  // Отчёт как настоящая HTML-таблица — открывается в новой вкладке,
  // можно распечатать на любом принтере или сохранить (Ctrl+S / "Сохранить").
  const openHtmlReport = () => {
    const rname = esc(restaurant?.name || "РЕСТОРАН");
    const date = new Date().toLocaleString("ru-RU");
    const tabLabel = esc(tabs.find((t) => t.id === tab)?.label || "Отчёт");
    const th = (cells: string[]) =>
      "<tr>" + cells.map((c) => `<th>${c}</th>`).join("") + "</tr>";
    const tr = (cells: string[]) =>
      "<tr>" + cells.map((c) => `<td>${c}</td>`).join("") + "</tr>";
    let bodyHtml = "";
    if (tab === "general" && report) {
      bodyHtml =
        `<table><thead>${th(["Показатель", "Сумма"])}</thead><tbody>` +
        tr(["Наличные", fmt(payCash)]) +
        tr(["Карта", fmt(payCard)]) +
        tr(["Перевод", fmt(payClick)]) +
        tr([
          "<b>ИТОГО выручка</b>",
          `<b>${fmt(payTotal)}</b>`,
        ]) +
        tr(["Кол-во чеков", String(report.sales.totalChecks || 0)]) +
        tr(["Средний чек", fmt(report.sales.averageCheck || 0)]) +
        "</tbody></table>";
    } else if (tab === "waiters" && report) {
      bodyHtml =
        `<table><thead>${th(["Официант", "Заказов", "Выручка", "Средний чек"])}</thead><tbody>` +
        (report.staff.waiters || [])
          .map((w) =>
            tr([
              esc(w.name),
              String(w.totalOrders),
              fmt(w.totalRevenue),
              fmt(w.averageCheck),
            ]),
          )
          .join("") +
        `</tbody><tfoot>${tr(["<b>ИТОГО</b>", "", `<b>${fmt(report.sales.totalRevenue || 0)}</b>`, ""])}</tfoot></table>`;
    } else if (tab === "cooks" && report) {
      bodyHtml = (report.staff.cooks || [])
        .map(
          (ck) =>
            `<h3>${esc(ck.name)} — ${ck.totalItems} блюд</h3><table><thead>${th(["Блюдо", "Категория", "Кол-во"])}</thead><tbody>` +
            ck.dishes
              .map((d) =>
                tr([esc(d.name), esc(d.categoryName), `×${d.quantity}`]),
              )
              .join("") +
            "</tbody></table>",
        )
        .join("");
    } else if (tab === "categories" && report) {
      bodyHtml =
        `<table><thead>${th(["Категория", "Кол-во", "Сумма"])}</thead><tbody>` +
        (report.categories.items || [])
          .map((c) =>
            tr([esc(c.name), String(c.totalQuantity), fmt(c.totalRevenue)]),
          )
          .join("") +
        `</tbody><tfoot>${tr(["<b>ИТОГО</b>", "", `<b>${fmt(report.sales.foodRevenue || 0)}</b>`])}</tfoot></table>`;
    } else if (tab === "foods" && report) {
      const g = new Map<string, FoodReportItem[]>();
      (report.foods.items || []).forEach((f) => {
        const k = f.categoryName || "Другое";
        if (!g.has(k)) g.set(k, []);
        g.get(k)!.push(f);
      });
      bodyHtml = Array.from(g.entries())
        .map(
          ([cat, items]) =>
            `<h3>${esc(cat)}</h3><table><thead>${th(["Блюдо", "Кол-во", "Цена", "Сумма"])}</thead><tbody>` +
            items
              .map((f) =>
                tr([
                  esc(f.name),
                  String(f.totalQuantity),
                  fmt(f.price),
                  fmt(f.totalRevenue),
                ]),
              )
              .join("") +
            tr([
              "<b>Итого</b>",
              "",
              "",
              `<b>${fmt(items.reduce((s, f) => s + f.totalRevenue, 0))}</b>`,
            ]) +
            "</tbody></table>",
        )
        .join("");
    } else if (tab === "cancelled") {
      bodyHtml =
        `<table><thead>${th(["№ заказа", "Блюдо", "Кол-во", "Сумма", "Причина"])}</thead><tbody>` +
        (cancelled?.items || [])
          .map((it) =>
            tr([
              `#${it.orderNumber}`,
              esc(it.foodName),
              `×${it.quantity}`,
              fmt(it.total),
              `${it.type === "order_cancelled" ? "[ЗАКАЗ]" : "[БЛЮДО]"} ${esc(it.cancelReason || "-")}`,
            ]),
          )
          .join("") +
        `</tbody><tfoot>${tr([
          "<b>ИТОГО</b>",
          "",
          `<b>${cancelled?.totalCancelledItems || 0} шт</b>`,
          `<b>${fmt(cancelled?.totalCancelledValue || 0)}</b>`,
          "",
        ])}</tfoot></table>`;
    }
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${rname} — ${tabLabel}</title>
<style>
*{font-family:Arial,Helvetica,sans-serif}
body{margin:24px;color:#0a0a0a}
h1{font-size:20px;margin:0 0 2px}.sub{color:#666;font-size:13px;margin:0 0 18px}
h3{margin:18px 0 6px;font-size:15px}
table{border-collapse:collapse;width:100%;margin-bottom:10px}
th,td{border:1px solid #999;padding:6px 10px;font-size:13px;text-align:left}
th{background:#eee}
td:last-child,th:last-child,tfoot td{text-align:right;font-weight:bold}
.toolbar{margin-bottom:16px}
button{padding:8px 16px;font-size:14px;cursor:pointer}
@media print{.toolbar{display:none}}
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨 Печать</button></div>
<h1>${rname}</h1><p class="sub">${tabLabel} · ${esc(date)}</p>
${bodyHtml || "<p>Нет данных</p>"}
</body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `report-${tab}.html`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  // Chek/hisobot HTML formatida AVTOMATIK chiqadi (Local Server printer-hub).
  // Foydalanuvchiga tanlash/tasdiqlash YO'Q — bitta "Распечатать" tugma.
  void openHtmlReport;
  const printBtn = (id: string, fn: () => void) => (
    <CTA height={56} fontSize={17} onClick={fn} disabled={printing !== null}>
      <NavIcon kind="printer" color="#fff" />{" "}
      {printing === id ? "Печать…" : "Распечатать"}
    </CTA>
  );

  const grouped = new Map<string, FoodReportItem[]>();
  report?.foods.items.forEach((f) => {
    const k = f.categoryName || "Другое";
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(f);
  });

  return (
    <div
      style={{
        flex: 1,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <SubHeader title="Отчёты по смене" onBack={() => ctx.go("orders")}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {ctx.activeShift && (
            <span style={{ fontSize: 15, color: T.textMuted, fontWeight: 700 }}>
              Смена №{ctx.activeShift.shiftNumber}
            </span>
          )}
          <CTA
            height={48}
            fontSize={16}
            onClick={printActReal}
            disabled={printing !== null || !report}
          >
            <NavIcon kind="printer" color="#fff" />{" "}
            {printing === "act-real" ? "Печать…" : "Отчёт (АКТ РЕАЛ)"}
          </CTA>
        </div>
      </SubHeader>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "230px 1fr",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: T.surface,
            borderRight: `1px solid ${T.border}`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {tabs.map((t) => {
            const a = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "20px 18px",
                  background: a ? T.cta : "transparent",
                  color: a ? "#fff" : T.text,
                  border: "none",
                  borderBottom: `1px solid ${T.borderSoft}`,
                  fontFamily: T.font,
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <NavIcon kind={t.icon} color={a ? "#fff" : T.text} size={22} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            overflow: "hidden",
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {loading ? (
            <div
              style={{
                padding: 60,
                textAlign: "center",
                color: T.textMuted,
                fontSize: 18,
              }}
            >
              Загрузка…
            </div>
          ) : tab === "general" ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                }}
              >
                <MiniStat
                  label="Наличные"
                  value={fmt(payCash)}
                  color={T.ready}
                  large
                />
                <MiniStat
                  label="Карта"
                  value={fmt(payCard)}
                  color={T.served}
                  large
                />
                <MiniStat
                  label="Перевод"
                  value={fmt(payClick)}
                  color={T.cta}
                  large
                />
              </div>
              <div
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  padding: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    textTransform: "uppercase",
                  }}
                >
                  Итого выручка
                </span>
                <span
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    fontVariantNumeric: "tabular-nums",
                    color: T.cta,
                  }}
                >
                  {fmt(payTotal)}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 12,
                }}
              >
                <MiniStat
                  label="Кол-во чеков"
                  value={report?.sales.totalChecks || 0}
                  color={T.text}
                  large
                />
                <MiniStat
                  label="Средний чек"
                  value={fmt(report?.sales.averageCheck || 0)}
                  color={T.text}
                  large
                />
              </div>
              {report?.sales.hourlyChargeRevenue ? (
                <MiniStat
                  label="Плата за занятость"
                  value={fmt(report.sales.hourlyChargeRevenue)}
                  color={T.hourly}
                  large
                />
              ) : null}
              <div style={{ flex: 1 }} />
              {printBtn("general", printGeneral)}
            </>
          ) : tab === "waiters" ? (
            <>
              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <SectionTitle>По официантам</SectionTitle>
                {(report?.staff.waiters || []).slice(0, 7).map((w) => (
                  <div
                    key={w._id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 14,
                      alignItems: "center",
                      padding: "12px 14px",
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <span style={{ fontSize: 17, fontWeight: 700 }}>
                      {w.name}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: T.textMuted,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {w.totalOrders} зак.
                    </span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmt(w.totalRevenue)}
                    </span>
                  </div>
                ))}
                {(!report?.staff.waiters ||
                  report.staff.waiters.length === 0) && (
                  <div
                    style={{
                      color: T.textMuted,
                      padding: 30,
                      textAlign: "center",
                    }}
                  >
                    Данные не найдены
                  </div>
                )}
              </div>
              {printBtn("waiters", printWaiters)}
            </>
          ) : tab === "cooks" ? (
            <>
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <SectionTitle>По поварам</SectionTitle>
                {(report?.staff.cooks || []).map((ck) => (
                  <div
                    key={ck._id}
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 14px",
                        background: T.panel,
                        borderBottom: `1px solid ${T.border}`,
                      }}
                    >
                      <span style={{ fontSize: 17, fontWeight: 800 }}>
                        {ck.name}
                      </span>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {ck.totalItems} блюд
                      </span>
                    </div>
                    {ck.dishes.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 14px",
                          fontSize: 15,
                          borderBottom:
                            i < ck.dishes.length - 1
                              ? `1px solid ${T.borderSoft}`
                              : "none",
                        }}
                      >
                        <span>
                          {d.name}
                          <span style={{ color: T.textMuted, fontSize: 12 }}>
                            {" "}
                            · {d.categoryName}
                          </span>
                        </span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          ×{d.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
                {(!report?.staff.cooks || report.staff.cooks.length === 0) && (
                  <div
                    style={{
                      color: T.textMuted,
                      padding: 30,
                      textAlign: "center",
                    }}
                  >
                    Данных нет (повара не назначены на категории)
                  </div>
                )}
              </div>
              {printBtn("cooks", printCooks)}
            </>
          ) : tab === "categories" ? (
            <>
              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <SectionTitle>По кухням</SectionTitle>
                {(report?.categories.items || []).slice(0, 8).map((c) => (
                  <div
                    key={c._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 13, color: T.textMuted }}>
                        {c.totalQuantity} шт продано
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmt(c.totalRevenue)}
                      </div>
                      <div style={{ fontSize: 13, color: T.textMuted }}>
                        {c.percentage}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {printBtn("categories", printCategories)}
            </>
          ) : tab === "foods" ? (
            <>
              <div
                style={{
                  flex: 1,
                  overflow: "scrol",
                  display: "flex",
                  with: "100%",
                  height: "90vh",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <SectionTitle>
                  Проданные блюда · {report?.foods.totalSold || 0} шт
                </SectionTitle>
                {Array.from(grouped.entries())
                  .slice(0, 4)
                  .map(([cat, foods]) => (
                    <div
                      key={cat}
                      style={{
                        background: T.surface,
                        border: `1px solid ${T.border}`,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 900,
                          color: T.cta,
                          borderBottom: `1px solid ${T.border}`,
                          paddingBottom: 6,
                          marginBottom: 6,
                        }}
                      >
                        {cat}
                      </div>
                      {foods.slice(0, 5).map((f) => (
                        <div
                          key={f._id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 14,
                            padding: "3px 0",
                          }}
                        >
                          <span>{f.name}</span>
                          <span
                            style={{
                              color: T.textMuted,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {f.totalQuantity} × {fmt(f.totalRevenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
              {printBtn("foods", printFoods)}
            </>
          ) : (
            <>
              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <SectionTitle>Отменённые</SectionTitle>
                {cancelledLoading ? (
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: T.textMuted,
                    }}
                  >
                    Загрузка…
                  </div>
                ) : !cancelled || cancelled.items.length === 0 ? (
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: T.ready,
                      fontWeight: 700,
                    }}
                  >
                    Отменённых заказов нет
                  </div>
                ) : (
                  cancelled.items.slice(0, 6).map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        background:
                          it.type === "order_cancelled"
                            ? T.cancelledBg
                            : T.preparingBg,
                        border: `1px solid ${T.border}`,
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                          #{it.orderNumber} · {it.tableName} — {it.foodName} ×
                          {it.quantity}
                        </div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>
                          {it.waiterName}
                          {it.cancelReason ? ` · ${it.cancelReason}` : ""}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: T.cancelled,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmt(it.total)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {cancelled && cancelled.items.length > 0 && (
                <div
                  style={{
                    background: T.cancelledBg,
                    color: T.cancelled,
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 900,
                  }}
                >
                  <span>ИТОГО: {cancelled.totalCancelledItems} шт</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmt(cancelled.totalCancelledValue)}
                  </span>
                </div>
              )}
              {printBtn("cancelled", printCancelled)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
