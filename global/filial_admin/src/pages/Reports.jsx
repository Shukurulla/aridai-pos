import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Icon } from "../icons";

const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");

const TYPE_RU = { dineIn: "Зал", takeaway: "Собой", delivery: "Доставка" };
const METHODS = [
  { id: "cash", label: "Наличные" },
  { id: "card", label: "Карта" },
  { id: "transfer", label: "Перевод" },
  { id: "kaspi", label: "Kaspi" },
];

const PERIODS = [
  { id: "today", label: "Сегодня" },
  { id: "7d", label: "7 дней" },
  { id: "all", label: "Всё время" },
];

function effQty(item) {
  const c = Array.isArray(item.cancels) ? item.cancels : [];
  const inc = c.filter((x) => x.status === "inc").reduce((s, x) => s + x.changeVal, 0);
  const dec = c.filter((x) => x.status === "dec").reduce((s, x) => s + x.changeVal, 0);
  return Math.max(0, (item.quantity || 0) + inc - dec);
}

export default function Reports() {
  const { branchId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  // Default — "7 дней" (so'nggi hafta deyarli har doim ma'lumotli; "Сегодня" sotuvgacha bo'sh)
  const [period, setPeriod] = useState("7d");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Расходы/Авансы — sync orqali POS'dan keladi; bo'lmasa hisobot baribir ishlaydi
      const [o, e, a] = await Promise.all([
        api.orders(branchId),
        api.expenses(branchId).catch(() => ({ data: [] })),
        api.advances(branchId).catch(() => ({ data: [] })),
      ]);
      setOrders(o.data || []);
      setExpenses(e.data || []);
      setAdvances(a.data || []);
    } catch {
      setOrders([]);
      setExpenses([]);
      setAdvances([]);
    } finally {
      setLoading(false);
    }
  }, [branchId]);
  useEffect(() => { load(); }, [load]);

  const report = useMemo(() => {
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const from =
      period === "today" ? startToday.getTime() :
      period === "7d" ? now - 7 * 86400000 : 0;

    const inRange = orders.filter((o) => new Date(o.createdAt).getTime() >= from);
    const live = inRange.filter((o) => !o.isCancel);
    const paid = live.filter((o) => o.paymentStatus === "paid");

    const revenue = paid.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const avg = paid.length ? Math.round(revenue / paid.length) : 0;
    const serviceTotal = paid.reduce((s, o) => s + (o.service?.amount || 0), 0);
    const discountTotal = paid.reduce((s, o) => s + (o.discountAmount || 0), 0);

    // To'lov usuli bo'yicha (mixed → tarkibiy qismlarga bo'linadi)
    const byMethod = { cash: 0, card: 0, transfer: 0, kaspi: 0 };
    paid.forEach((o) => {
      if (o.paymentMethod === "mixed" && o.mixed) {
        byMethod.cash += o.mixed.cash || 0;
        byMethod.card += o.mixed.card || 0;
        byMethod.transfer += o.mixed.transfer || 0;
        byMethod.kaspi += o.mixed.kaspi || 0;
      } else if (byMethod[o.paymentMethod] !== undefined) {
        byMethod[o.paymentMethod] += o.totalPrice || 0;
      }
    });

    // Buyurtma turi bo'yicha
    const byType = {};
    live.forEach((o) => {
      const k = o.orderType || "—";
      if (!byType[k]) byType[k] = { count: 0, sum: 0 };
      byType[k].count++;
      byType[k].sum += o.totalPrice || 0;
    });

    // TOP blyuda (bekor qilinmagan orderlardan)
    const foodMap = new Map();
    live.forEach((o) => {
      (o.foods || []).forEach((f) => {
        const q = effQty(f);
        if (q <= 0) return;
        const cur = foodMap.get(f.foodName) || { qty: 0, sum: 0 };
        cur.qty += q;
        cur.sum += (f.foodPrice || 0) * q;
        foodMap.set(f.foodName, cur);
      });
    });
    const topFoods = [...foodMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    // ===== Расходы / Авансы (kassa harakati — sync'dan) =====
    const sumBy = (arr, pred) => arr.filter(pred).reduce((s, x) => s + (x.amount || 0), 0);
    const expIn = expenses.filter((e) => new Date(e.createdAt).getTime() >= from);
    const advIn = advances.filter((a) => new Date(a.createdAt).getTime() >= from);
    const expenseCash = sumBy(expIn, (e) => e.type !== "income" && e.paymentType === "cash");
    const expenseClick = sumBy(expIn, (e) => e.type !== "income" && e.paymentType === "click");
    const incomeCash = sumBy(expIn, (e) => e.type === "income" && e.paymentType === "cash");
    const advanceCash = sumBy(advIn, (a) => a.paymentType === "cash");
    const advanceClick = sumBy(advIn, (a) => a.paymentType === "click");
    // Kassada qolishi kerak bo'lgan naqd: naqd tushum + прих − rasxod − avans
    const cashInDrawer = (byMethod.cash || 0) + incomeCash - expenseCash - advanceCash;

    return {
      revenue, avg, serviceTotal, discountTotal,
      ordersCount: live.length,
      cancelledCount: inRange.filter((o) => o.isCancel).length,
      byMethod, byType, topFoods,
      expenseCash, expenseClick, incomeCash, advanceCash, advanceClick,
      expenseCount: expIn.length, advanceCount: advIn.length,
      cashInDrawer,
    };
  }, [orders, expenses, advances, period]);

  const fmtD = (d) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const rangeText =
    period === "all" ? "За всё время" :
    period === "today" ? `Сегодня · ${fmtD(Date.now())}` :
    `${fmtD(Date.now() - 6 * 86400000)} — ${fmtD(Date.now())}`;

  return (
    <div>
      <div className="page-head">
        <h1>Отчёты</h1>
        <button className="btn ghost btn-sm icon-btn" onClick={load} disabled={loading}>
          <Icon name="refresh" size={15} /> Обновить
        </button>
      </div>

      <div className="chips">
        {PERIODS.map((p) => (
          <button key={p.id} className={`chip ${period === p.id ? "active" : ""}`} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="muted" style={{ marginTop: -6, marginBottom: 16, fontSize: 13, fontWeight: 700 }}>{rangeText}</div>

      {loading ? (
        <div className="card"><div className="empty">Загрузка…</div></div>
      ) : (
        <>
          <div className="stats">
            <div className="stat green">
              <div className="v">{fmt(report.revenue)} ₸</div>
              <div className="l">Выручка</div>
            </div>
            <div className="stat">
              <div className="v">{fmt(report.ordersCount)}</div>
              <div className="l">Заказов</div>
            </div>
            <div className="stat">
              <div className="v">{fmt(report.avg)} ₸</div>
              <div className="l">Средний чек</div>
            </div>
            <div className="stat red">
              <div className="v">{fmt(report.cancelledCount)}</div>
              <div className="l">Отменено</div>
            </div>
          </div>

          <div className="rep-grid">
            <div className="card rep-card">
              <div className="rep-head">Оплата по способам</div>
              {METHODS.map((m) => (
                <div className="rep-row" key={m.id}>
                  <span>{m.label}</span>
                  <span className="a">{fmt(report.byMethod[m.id])} ₸</span>
                </div>
              ))}
              <div className="rep-row sub"><span>Обслуживание</span><span className="a">{fmt(report.serviceTotal)} ₸</span></div>
              <div className="rep-row sub"><span>Скидки</span><span className="a">− {fmt(report.discountTotal)} ₸</span></div>
            </div>

            <div className="card rep-card">
              <div className="rep-head">По типу заказа</div>
              {Object.keys(report.byType).length === 0 ? (
                <div className="rep-row muted"><span>Нет данных</span><span /></div>
              ) : (
                Object.entries(report.byType).map(([k, v]) => (
                  <div className="rep-row" key={k}>
                    <span>{TYPE_RU[k] || k} <span className="muted">· {v.count}</span></span>
                    <span className="a">{fmt(v.sum)} ₸</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rep-grid" style={{ marginTop: 18 }}>
            <div className="card rep-card">
              <div className="rep-head">Касса (наличные)</div>
              <div className="rep-row"><span>Наличная выручка</span><span className="a">{fmt(report.byMethod.cash)} ₸</span></div>
              {report.incomeCash > 0 && (
                <div className="rep-row"><span>Приход (нал.)</span><span className="a">+ {fmt(report.incomeCash)} ₸</span></div>
              )}
              <div className="rep-row sub"><span>Расходы (нал.)</span><span className="a">− {fmt(report.expenseCash)} ₸</span></div>
              <div className="rep-row sub"><span>Авансы (нал.)</span><span className="a">− {fmt(report.advanceCash)} ₸</span></div>
              <div className="rep-row" style={{ borderTop: "2px solid var(--line2, #ddd7c8)", marginTop: 6, paddingTop: 10, fontWeight: 900 }}>
                <span>В кассе (нал.)</span>
                <span className="a">{fmt(report.cashInDrawer)} ₸</span>
              </div>
            </div>

            <div className="card rep-card">
              <div className="rep-head">Расходы / Авансы</div>
              <div className="rep-row"><span>Расходы <span className="muted">· {report.expenseCount}</span></span><span className="a">{fmt(report.expenseCash + report.expenseClick)} ₸</span></div>
              <div className="rep-row sub"><span>наличными</span><span className="a">{fmt(report.expenseCash)} ₸</span></div>
              <div className="rep-row sub"><span>перевод</span><span className="a">{fmt(report.expenseClick)} ₸</span></div>
              <div className="rep-row" style={{ marginTop: 4 }}><span>Авансы <span className="muted">· {report.advanceCount}</span></span><span className="a">{fmt(report.advanceCash + report.advanceClick)} ₸</span></div>
              <div className="rep-row sub"><span>наличными</span><span className="a">{fmt(report.advanceCash)} ₸</span></div>
              <div className="rep-row sub"><span>перевод</span><span className="a">{fmt(report.advanceClick)} ₸</span></div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="rep-head" style={{ padding: "14px 18px 0" }}>ТОП блюд</div>
            {report.topFoods.length === 0 ? (
              <div className="empty">Нет продаж за период.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Блюдо</th>
                    <th style={{ width: 120, textAlign: "right" }}>Кол-во</th>
                    <th style={{ width: 160, textAlign: "right" }}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topFoods.map((f, i) => (
                    <tr key={f.name}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{f.name}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(f.qty)}</td>
                      <td style={{ textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(f.sum)} ₸</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
