import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Icon } from "../icons";

const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
const dt = (d) => d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const shiftIdOf = (o) => (o.shift && (o.shift._id || o.shift)) ? String(o.shift._id || o.shift) : null;

export default function Shifts() {
  const { branchId } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([api.shifts(branchId), api.orders(branchId)]);
      const list = (s.data || []).slice().sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
      setShifts(list);
      setOrders(o.data || []);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);
  useEffect(() => { load(); }, [load]);

  const active = shifts.find((s) => s.isActive);
  const past = shifts.filter((s) => !s.isActive);

  // Aktiv smena uchun jonli totals (orderlardan)
  const liveTotals = (() => {
    if (!active) return null;
    const mine = orders.filter((o) => shiftIdOf(o) === String(active._id));
    const live = mine.filter((o) => !o.isCancel);
    const paid = live.filter((o) => o.paymentStatus === "paid");
    // Naqd tushum (mixed bo'lsa faqat naqd qismi) — kassada kutilayotgan summa uchun
    const cashRevenue = paid.reduce((s, o) => {
      if (o.paymentMethod === "mixed") return s + (o.mixed?.cash || 0);
      if (o.paymentMethod === "cash") return s + (o.totalPrice || 0);
      return s;
    }, 0);
    return {
      ordersCount: live.length,
      revenue: paid.reduce((s, o) => s + (o.totalPrice || 0), 0),
      cashRevenue,
      open: live.filter((o) => o.paymentStatus !== "paid").length,
    };
  })();

  const openShift = async () => {
    const cash = prompt("Открыть смену. Сумма в кассе на начало (₸):", "0");
    if (cash === null) return;
    setBusy(true);
    setErr("");
    try {
      await api.shiftCreate({ branch: branchId, openingCash: Number(cash) || 0 });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const closeShift = async (s) => {
    // Kutilayotgan kassa = ochilish naqdi + naqd tushum (default — tasdiqlaydi/o'zgartiradi)
    const expected = (s.openingCash || 0) + (liveTotals?.cashRevenue || 0);
    const cash = prompt("Закрыть смену. Сумма в кассе на конец (₸):", String(expected));
    if (cash === null) return;
    setBusy(true);
    setErr("");
    try {
      await api.shiftClose(s._id, { closingCash: cash });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Смена</h1>
        <div className="row">
          <button className="btn ghost btn-sm icon-btn" onClick={load} disabled={loading}>
            <Icon name="refresh" size={15} /> Обновить
          </button>
          {!active && (
            <button className="btn primary icon-btn" onClick={openShift} disabled={busy || loading}>
              <Icon name="play" size={16} /> Открыть смену
            </button>
          )}
        </div>
      </div>

      {err && <div className="alert err">{err}</div>}

      {loading ? (
        <div className="card"><div className="empty">Загрузка…</div></div>
      ) : (
        <>
          {active ? (
            <div className="shift-active">
              <div className="shift-active-head">
                <div>
                  <span className="live"><span className="dot" /> Смена открыта</span>
                  <div className="muted" style={{ marginTop: 4 }}>Открыта: {dt(active.openedAt)} · Касса на старте: {fmt(active.openingCash)} ₸</div>
                </div>
                <button className="btn danger icon-btn" onClick={() => closeShift(active)} disabled={busy}>
                  <Icon name="stop" size={15} /> Закрыть смену
                </button>
              </div>
              <div className="shift-stats">
                <div><div className="v">{fmt(liveTotals.revenue)} ₸</div><div className="l">Выручка</div></div>
                <div><div className="v">{fmt(liveTotals.ordersCount)}</div><div className="l">Заказов</div></div>
                <div><div className="v">{fmt(liveTotals.open)}</div><div className="l">Открытых</div></div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty">Нет открытой смены. Нажмите «Открыть смену», чтобы начать.</div>
            </div>
          )}

          <h2 className="sub-h">История смен</h2>
          <div className="card">
            {past.length === 0 ? (
              <div className="empty">Закрытых смен пока нет.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Открыта</th>
                    <th>Закрыта</th>
                    <th style={{ textAlign: "right" }}>Заказов</th>
                    <th style={{ textAlign: "right" }}>Выручка</th>
                    <th style={{ textAlign: "right" }}>Касса (расхождение)</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((s) => {
                    const disc = s.closingDiscrepancy;
                    return (
                      <tr key={s._id}>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{dt(s.openedAt)}</td>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{dt(s.closedAt)}</td>
                        <td style={{ textAlign: "right" }}>{fmt(s.totals?.ordersCount)}</td>
                        <td style={{ textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(s.totals?.revenue)} ₸</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {s.closingCash != null ? (
                            <>
                              {fmt(s.closingCash)} ₸{" "}
                              {disc != null && disc !== 0 && (
                                <span className={disc < 0 ? "disc-neg" : "disc-pos"}>
                                  ({disc > 0 ? "+" : ""}{fmt(disc)})
                                </span>
                              )}
                            </>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
