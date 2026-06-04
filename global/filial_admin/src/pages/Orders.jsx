import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useModal } from "../modal";
import { Icon } from "../icons";

const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");

const TYPE_RU = { dineIn: "Зал", takeaway: "Собой", delivery: "Доставка" };
const METHOD_RU = {
  cash: "Наличные", card: "Карта", transfer: "Перевод",
  kaspi: "Kaspi", mixed: "Смешанная", cashback: "Кешбэк",
};

// Item effektiv miqdori (inc/dec cancels bilan) — 0 bo'lsa bekor qilingan
function effQty(item) {
  const c = Array.isArray(item.cancels) ? item.cancels : [];
  const inc = c.filter((x) => x.status === "inc").reduce((s, x) => s + x.changeVal, 0);
  const dec = c.filter((x) => x.status === "dec").reduce((s, x) => s + x.changeVal, 0);
  return Math.max(0, (item.quantity || 0) + inc - dec);
}

function statusOf(o) {
  if (o.isCancel) return { cls: "cancel", label: "Отменён" };
  switch (o.paymentStatus) {
    case "paid": return { cls: "paid", label: "Оплачен" };
    case "partiallyPaid": return { cls: "partial", label: "Частично" };
    case "refunded": return { cls: "refund", label: "Возврат" };
    default: return { cls: "pending", label: "Открыт" };
  }
}

function typeLabel(o) {
  const base = TYPE_RU[o.orderType] || o.orderType;
  if (o.orderType === "dineIn") {
    const t = o.table;
    const num = t && (t.number != null ? `Стол ${t.number}` : t.title);
    return num ? `${base} · ${num}` : base;
  }
  return base;
}

const timeFmt = (d) =>
  d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "open", label: "Открытые" },
  { id: "paid", label: "Оплаченные" },
  { id: "cancel", label: "Отменённые" },
];

export default function Orders() {
  const { branchId } = useAuth();
  const modal = useModal();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [shiftSel, setShiftSel] = useState("active"); // "active" | "all" | <shiftId>
  const [shifts, setShifts] = useState([]);
  const [open, setOpen] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(null); // cancel jarayonidagi order _id
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true);
    else setRefreshing(true);
    try {
      const r = await api.orders(branchId, shiftSel);
      const list = (r.data || []).slice().sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
      setOrders(list);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstLoad.current = false;
    }
  }, [branchId, shiftSel]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  // Smena ro'yxati (saralash tanlagichi uchun) — bir marta + 60s yangilanish
  useEffect(() => {
    let alive = true;
    const loadShifts = () =>
      api
        .shifts(branchId)
        .then((r) => {
          if (!alive) return;
          const list = (r.data || []).slice().sort(
            (a, b) => new Date(b.openedAt) - new Date(a.openedAt),
          );
          setShifts(list);
        })
        .catch(() => {});
    loadShifts();
    const t = setInterval(loadShifts, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [branchId]);

  // ===== Bekor qilish =====
  const cancelOrder = async (o) => {
    const reason = await modal.prompt({
      title: "Отмена заказа",
      message: `Заказ ${o.receiptNumber || ""} будет отменён. Укажите причину (необязательно):`,
      placeholder: "Причина отмены",
      okText: "Отменить заказ",
      danger: true,
    });
    if (reason === null) return;
    setActing(o._id);
    try {
      await api.orderCancel(o._id, { reason: reason || undefined });
      await load();
    } catch (e) {
      modal.alert(e.message);
    } finally {
      setActing(null);
    }
  };
  const cancelItem = async (o, item) => {
    const reason = await modal.prompt({
      title: "Отмена позиции",
      message: `«${item.foodName}» будет отменена. Укажите причину (необязательно):`,
      placeholder: "Причина",
      okText: "Отменить позицию",
      danger: true,
    });
    if (reason === null) return;
    setActing(o._id);
    try {
      await api.orderItemCancel(o._id, item._id, { reason: reason || undefined });
      await load();
    } catch (e) {
      modal.alert(e.message);
    } finally {
      setActing(null);
    }
  };
  // Item miqdorini o'zgartirish (kamaytirish/ko'paytirish, min 1)
  const changeQty = async (o, item, newQty) => {
    const q = Math.max(1, Math.floor(newQty));
    if (q === effQty(item)) return;
    setActing(o._id);
    try {
      await api.orderItemQty(o._id, item._id, q);
      await load();
    } catch (e) {
      modal.alert(e.message);
    } finally {
      setActing(null);
    }
  };

  const live = orders.filter((o) => !o.isCancel);
  const revenue = live.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + (o.totalPrice || 0), 0);
  const openCount = live.filter((o) => o.paymentStatus === "pending").length;

  const shown = orders.filter((o) => {
    if (filter === "open") return !o.isCancel && o.paymentStatus !== "paid";
    if (filter === "paid") return !o.isCancel && o.paymentStatus === "paid";
    if (filter === "cancel") return o.isCancel;
    return true;
  });

  const counts = {
    all: orders.length,
    open: live.filter((o) => o.paymentStatus !== "paid").length,
    paid: live.filter((o) => o.paymentStatus === "paid").length,
    cancel: orders.filter((o) => o.isCancel).length,
  };

  return (
    <div>
      <div className="page-head">
        <h1>Заказы</h1>
        <div className="row">
          <span className="live"><span className="dot" /> Обновляется автоматически</span>
          <button className="btn ghost btn-sm icon-btn" onClick={load} disabled={refreshing}>
            <Icon name="refresh" size={15} /> {refreshing ? "…" : "Обновить"}
          </button>
        </div>
      </div>

      {err && <div className="alert err">{err}</div>}

      <div className="stats">
        <div className="stat">
          <div className="v">{fmt(live.length)}</div>
          <div className="l">Заказов</div>
        </div>
        <div className="stat green">
          <div className="v">{fmt(revenue)} ₸</div>
          <div className="l">Выручка (оплачено)</div>
        </div>
        <div className="stat">
          <div className="v">{fmt(openCount)}</div>
          <div className="l">Открытых</div>
        </div>
      </div>

      <div className="chips">
        <select
          value={shiftSel}
          onChange={(e) => setShiftSel(e.target.value)}
          title="Фильтр по смене"
          style={{
            padding: "9px 14px",
            borderRadius: 999,
            border: "1px solid var(--line2, #ddd7c8)",
            background: "#fff",
            color: "var(--ink, #1a1a1a)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            marginRight: 6,
          }}
        >
          <option value="active">Текущая смена</option>
          <option value="all">Все смены</option>
          {shifts.map((s) => (
            <option key={s._id} value={s._id}>
              Смена №{s.shiftNumber ?? "—"} · {timeFmt(s.openedAt)}
              {s.isActive ? " · текущая" : ""}
            </option>
          ))}
        </select>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`chip ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label} <span className="n">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Загрузка…</div>
        ) : shown.length === 0 ? (
          <div className="empty">
            {orders.length === 0 ? "Заказов пока нет. Они появятся здесь после продаж на кассе (POS)." : "Нет заказов в этом фильтре."}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>№ чека</th>
                <th>Тип</th>
                <th>Официант</th>
                <th style={{ width: 90 }}>Позиции</th>
                <th style={{ textAlign: "right" }}>Сумма</th>
                <th style={{ width: 120 }}>Статус</th>
                <th style={{ width: 120 }}>Время</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const st = statusOf(o);
                const isOpen = open === o._id;
                const items = o.foods || [];
                const posCount = items.reduce((s, f) => s + effQty(f), 0);
                return (
                  <FragmentRow
                    key={o._id}
                    o={o}
                    st={st}
                    isOpen={isOpen}
                    items={items}
                    posCount={posCount}
                    acting={acting === o._id}
                    onToggle={() => setOpen(isOpen ? null : o._id)}
                    onCancelOrder={() => cancelOrder(o)}
                    onCancelItem={(item) => cancelItem(o, item)}
                    onChangeQty={(item, q) => changeQty(o, item, q)}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FragmentRow({ o, st, isOpen, items, posCount, acting, onToggle, onCancelOrder, onCancelItem, onChangeQty }) {
  // Faqat OCHIQ (pending, bekor qilinmagan) buyurtmani bekor qilish mumkin.
  // To'langan → faqat возврат (alohida oqim); bekor qilingan → qayta bekor qilinmaydi.
  const canCancel = !o.isCancel && o.paymentStatus !== "paid";
  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td><span className={`caret ${isOpen ? "open" : ""}`}><Icon name="chevron" size={14} /></span></td>
        <td style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{o.receiptNumber || "—"}</td>
        <td>{typeLabel(o)}</td>
        <td className="muted">{o.waiter?.name || "—"}</td>
        <td className="muted">{posCount} поз.</td>
        <td style={{ textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(o.totalPrice)} ₸</td>
        <td><span className={`st ${st.cls}`}>{st.label}</span></td>
        <td className="muted" style={{ whiteSpace: "nowrap" }}>{timeFmt(o.createdAt)}</td>
      </tr>
      {isOpen && (
        <tr className="ord-detail">
          <td colSpan={8}>
            <div className="inner">
              {items.map((f, i) => {
                const q = effQty(f);
                const cancelled = q <= 0;
                const editable = canCancel && !cancelled;
                return (
                  <div className={`ord-line ${cancelled ? "struck" : ""}`} key={f._id || i}>
                    <div>
                      <span className="nm">{f.foodName}</span>
                      {!editable && <span className="qty">× {cancelled ? f.quantity : q}</span>}
                      {f.note && <span className="muted" style={{ marginLeft: 8, fontStyle: "italic" }}>({f.note})</span>}
                      {cancelled && <span className="st cancel" style={{ marginLeft: 8 }}>отменена</span>}
                    </div>
                    <div className="row" style={{ gap: 12 }}>
                      {editable && (
                        <span className="qty-step">
                          <button title="Уменьшить" disabled={acting || q <= 1} onClick={() => onChangeQty(f, q - 1)}>−</button>
                          <span className="q">{q}</span>
                          <button title="Увеличить" disabled={acting} onClick={() => onChangeQty(f, q + 1)}>+</button>
                        </span>
                      )}
                      <span className="amt">{fmt((f.foodPrice || 0) * (cancelled ? 0 : q))} ₸</span>
                      {editable && (
                        <button
                          className="btn btn-sm danger icon-btn"
                          title="Отменить позицию"
                          disabled={acting}
                          onClick={() => onCancelItem(f)}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="ord-sums">
                <div className="ord-sum">
                  <span>Подытог</span>
                  <span className="a">{fmt(o.subTotal)} ₸</span>
                </div>
                {o.service?.amount > 0 && (
                  <div className="ord-sum">
                    <span>Обслуживание{o.service.percent ? ` (${o.service.percent}%)` : ""}</span>
                    <span className="a">{fmt(o.service.amount)} ₸</span>
                  </div>
                )}
                {o.discountAmount > 0 && (
                  <div className="ord-sum">
                    <span>Скидка</span>
                    <span className="a">− {fmt(o.discountAmount)} ₸</span>
                  </div>
                )}
                <div className="ord-sum total">
                  <span>Итого</span>
                  <span className="a">{fmt(o.totalPrice)} ₸</span>
                </div>
                {o.paymentStatus === "paid" && o.paymentMethod && (
                  <div className="ord-sum">
                    <span>Оплата</span>
                    <span className="a">{METHOD_RU[o.paymentMethod] || o.paymentMethod}</span>
                  </div>
                )}
                {o.isCancel && o.cancelReason && (
                  <div className="ord-sum">
                    <span>Причина отмены</span>
                    <span className="a">{o.cancelReason}</span>
                  </div>
                )}
              </div>

              {canCancel && (
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
                  <button className="btn danger icon-btn" disabled={acting} onClick={onCancelOrder}>
                    <Icon name="ban" size={16} /> {acting ? "…" : "Отменить заказ"}
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
