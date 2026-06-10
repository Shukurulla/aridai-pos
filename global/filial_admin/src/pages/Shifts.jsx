import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useModal } from "../modal";
import { Icon } from "../icons";

const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
const dt = (d) => d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const shiftIdOf = (o) => (o.shift && (o.shift._id || o.shift)) ? String(o.shift._id || o.shift) : null;

export default function Shifts() {
  const { branchId } = useAuth();
  const modal = useModal();
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

  // Bitta filialda BIR nechta aktiv smena osilib qolishi mumkin (offline/online,
  // POS+admin) — HAMMASINI ko'rsatamiz va har birini yopish mumkin.
  const actives = shifts.filter((s) => s.isActive);
  const past = shifts.filter((s) => !s.isActive);

  // Smena uchun jonli totals (orderlardan)
  const liveFor = (shiftId) => {
    const mine = orders.filter((o) => shiftIdOf(o) === String(shiftId));
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
      open: live.filter((o) => o.paymentStatus !== "paid" && o.paymentStatus !== "refunded").length,
    };
  };

  const openShift = async () => {
    const cash = await modal.prompt({
      title: "Открыть смену",
      message: "Сумма в кассе на начало смены:",
      defaultValue: "0",
      numeric: true,
      suffix: "₸",
      okText: "Открыть",
    });
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
    // Shu smenaning orderlaridan jonli hisob
    const mine = orders.filter((o) => shiftIdOf(o) === String(s._id) && !o.isCancel);
    // refunded = yopiq (qaytarilgan) — ochiq sanalmaydi, force-close uni bekor qilmasin
    const openCount = mine.filter((o) => o.paymentStatus !== "paid" && o.paymentStatus !== "refunded").length;

    // Ochiq (to'lanmagan) orderlar bo'lsa — majburan yopishni so'raymiz (admin).
    // Tasdiqlasa: ochiq orderlar bekor qilinadi va smena yopiladi (force).
    let force = false;
    if (openCount > 0) {
      const ok = await modal.confirm({
        title: "Есть открытые заказы",
        message:
          `В этой смене ${openCount} открытых (неоплаченных) заказов.\n` +
          `Закрыть смену принудительно? Открытые заказы будут отменены.`,
        okText: "Отменить заказы и закрыть",
        danger: true,
      });
      if (!ok) return;
      force = true;
    }

    const paid = mine.filter((o) => o.paymentStatus === "paid");
    const revenue = paid.reduce((acc, o) => acc + (o.totalPrice || 0), 0);
    const cashRevenue = paid.reduce((acc, o) => {
      if (o.paymentMethod === "mixed") return acc + (o.mixed?.cash || 0);
      if (o.paymentMethod === "cash") return acc + (o.totalPrice || 0);
      return acc;
    }, 0);
    // Kutilayotgan kassa = ochilish naqdi + naqd tushum
    const expected = (s.openingCash || 0) + cashRevenue;

    const cash = await modal.prompt({
      title: `Закрыть смену${s.shiftNumber ? ` №${s.shiftNumber}` : ""}`,
      message: force
        ? `Открытые заказы (${openCount}) будут отменены.\n` +
          `Выручка (оплачено): ${fmt(revenue)} ₸ · Наличными: ${fmt(cashRevenue)} ₸\n\n` +
          `Сумма наличных в кассе:`
        : `Выручка за смену: ${fmt(revenue)} ₸\n` +
          `Наличными: ${fmt(cashRevenue)} ₸ · Касса на старте: ${fmt(s.openingCash)} ₸\n` +
          `Ожидается в кассе: ${fmt(expected)} ₸\n\n` +
          `Пересчитайте фактическую сумму наличных в кассе:`,
      defaultValue: String(expected),
      numeric: true,
      suffix: "₸",
      okText: "Закрыть смену",
    });
    if (cash === null) return;
    setBusy(true);
    setErr("");
    try {
      await api.shiftClose(s._id, { closingCash: cash, force });
      await load();
    } catch (e) {
      const msg = e.message || "Не удалось закрыть смену";
      await modal.alert({ title: "Ошибка", message: msg });
      setErr(msg);
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
          {actives.length === 0 && (
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
          {actives.length === 0 ? (
            <div className="card">
              <div className="empty">Нет открытой смены. Нажмите «Открыть смену», чтобы начать.</div>
            </div>
          ) : (
            <>
              {actives.length > 1 && (
                <div className="alert err" style={{ marginBottom: 12 }}>
                  Открыто несколько смен ({actives.length}) — так быть не должно. Закройте лишние.
                </div>
              )}
              {actives.map((a) => {
                const lt = liveFor(a._id);
                return (
                  <div className="shift-active" key={a._id} style={{ marginBottom: 12 }}>
                    <div className="shift-active-head">
                      <div>
                        <span className="live">
                          <span className="dot" /> Смена{a.shiftNumber ? ` №${a.shiftNumber}` : ""} открыта
                        </span>
                        <div className="muted" style={{ marginTop: 4 }}>
                          Открыта: {dt(a.openedAt)} · Касса на старте: {fmt(a.openingCash)} ₸
                        </div>
                      </div>
                      <button className="btn danger icon-btn" onClick={() => closeShift(a)} disabled={busy}>
                        <Icon name="stop" size={15} /> Закрыть смену
                      </button>
                    </div>
                    <div className="shift-stats">
                      <div><div className="v">{fmt(lt.revenue)} ₸</div><div className="l">Выручка</div></div>
                      <div><div className="v">{fmt(lt.ordersCount)}</div><div className="l">Заказов</div></div>
                      <div><div className="v">{fmt(lt.open)}</div><div className="l">Открытых</div></div>
                    </div>
                  </div>
                );
              })}
            </>
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
