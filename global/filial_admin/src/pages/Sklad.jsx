import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useModal } from "../modal";
import { Icon } from "../icons";

// СКЛАД (inventory) — obsidian/04-toollar/sklad.md
// Toggle o'chiq bo'lsa backend 404 FEATURE_DISABLED → yoqish bo'yicha xabar.
const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
const dt = (d) =>
  d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const UNITS = ["kg", "g", "l", "ml", "dona"];
const REASON_RU = (m) => {
  const r = m.reason || "";
  if (r.startsWith("order:")) return "Заказ";
  if (r.startsWith("cancel:")) return "Отмена заказа";
  if (r === "inventory") return "Инвентаризация";
  if (r === "manual") return "Приход";
  return r;
};

export default function Sklad() {
  const modal = useModal();
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false); // feature toggle o'chiq
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Yangi ingredient formasi
  const [nName, setNName] = useState("");
  const [nUnit, setNUnit] = useState("kg");
  const [nThreshold, setNThreshold] = useState("10");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([api.skladStock(), api.skladMovements(50)]);
      setStock(s.data || []);
      setMovements(m.data || []);
      setDisabled(false);
      setErr("");
    } catch (e) {
      if (e.code === "FEATURE_DISABLED") setDisabled(true);
      else setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const lows = stock.filter((s) => s.low);

  const addIngredient = async (e) => {
    e.preventDefault();
    if (!nName.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await api.skladIngredientCreate({ name: nName.trim(), unit: nUnit, lowAlertThreshold: Number(nThreshold) || 10 });
      setNName("");
      setNThreshold("10");
      await load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const stockIn = async (row) => {
    const qty = await modal.prompt({
      title: `Приход — ${row.name}`,
      message: `Текущий остаток: ${fmt(row.balance)} ${row.unit}.\nСколько пришло?`,
      numeric: true,
      suffix: row.unit,
      okText: "Оприходовать",
    });
    if (qty === null || !(Number(qty) > 0)) return;
    setBusy(true);
    try {
      await api.skladStockIn({ ingredientId: row.ingredientId, quantity: Number(qty) });
      await load();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const adjust = async (row) => {
    const nb = await modal.prompt({
      title: `Инвентаризация — ${row.name}`,
      message: `В системе: ${fmt(row.balance)} ${row.unit}.\nВведите ФАКТИЧЕСКИЙ остаток (разница запишется как корректировка):`,
      defaultValue: String(row.balance || 0),
      numeric: true,
      suffix: row.unit,
      okText: "Сохранить",
    });
    if (nb === null) return;
    setBusy(true);
    try {
      await api.skladAdjust({ ingredientId: row.ingredientId, newBalance: Number(nb), reason: "inventory" });
      await load();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const threshold = async (row) => {
    const t = await modal.prompt({
      title: `Порог оповещения — ${row.name}`,
      message: "При остатке ниже порога ингредиент попадает в «мало на складе».",
      defaultValue: String(row.lowAlertThreshold ?? 10),
      numeric: true,
      suffix: row.unit,
      okText: "Сохранить",
    });
    if (t === null) return;
    try {
      await api.skladThreshold(row.ingredientId, Number(t) || 0);
      await load();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    }
  };

  const removeIngredient = async (row) => {
    const ok = await modal.confirm({
      title: `Скрыть «${row.name}»?`,
      message: "Ингредиент будет скрыт из склада и рецептов. История движений сохранится.",
      okText: "Скрыть",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.skladIngredientUpdate(row.ingredientId, { isActive: false });
      await load();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    }
  };

  if (disabled) {
    return (
      <div>
        <div className="page-head">
          <h1>Склад</h1>
        </div>
        <div className="card">
          <div className="empty">
            Модуль «Склад» выключен для вашего ресторана.
            <br />
            Включите его в панели владельца (Функции → Склад) — после этого здесь появятся
            ингредиенты, остатки и автоматическое списание по рецептам блюд.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>Склад</h1>
        <div className="row">
          <button className="btn ghost btn-sm icon-btn" onClick={load} disabled={loading}>
            <Icon name="refresh" size={15} /> Обновить
          </button>
        </div>
      </div>

      {err && <div className="alert err">{err}</div>}

      {lows.length > 0 && (
        <div className="alert err" style={{ marginBottom: 12 }}>
          Мало на складе: {lows.map((l) => `${l.name} (${fmt(l.balance)} ${l.unit})`).join(", ")}
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="empty">Загрузка…</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            {stock.length === 0 ? (
              <div className="empty">Ингредиентов пока нет. Добавьте первый ниже.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Ингредиент</th>
                    <th style={{ textAlign: "right" }}>Остаток</th>
                    <th style={{ textAlign: "right" }}>Порог</th>
                    <th>Последнее движение</th>
                    <th style={{ width: 280 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={String(s.ingredientId)}>
                      <td>
                        <b>{s.name}</b>
                        {s.low && (
                          <span className="disc-neg" style={{ marginLeft: 8, fontSize: 12 }}>
                            мало
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {fmt(s.balance)} {s.unit}
                      </td>
                      <td
                        style={{ textAlign: "right", cursor: "pointer" }}
                        className="muted"
                        title="Изменить порог"
                        onClick={() => threshold(s)}
                      >
                        {fmt(s.lowAlertThreshold)} {s.unit}
                      </td>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{dt(s.lastMovementAt)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-sm" onClick={() => stockIn(s)} disabled={busy}>
                          + Приход
                        </button>{" "}
                        <button className="btn btn-sm ghost" onClick={() => adjust(s)} disabled={busy}>
                          Инвент.
                        </button>{" "}
                        <button className="btn btn-sm ghost" onClick={() => removeIngredient(s)} disabled={busy} title="Скрыть">
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="sub-h">Новый ингредиент</h2>
          <div className="card" style={{ marginBottom: 14 }}>
            <form onSubmit={addIngredient} className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
                <label>Название</label>
                <input className="input" value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Мука, мясо, кола…" />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Ед. изм.</label>
                <select className="select" value={nUnit} onChange={(e) => setNUnit(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0, width: 140 }}>
                <label>Порог «мало»</label>
                <input
                  className="input"
                  value={nThreshold}
                  onChange={(e) => setNThreshold(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy || !nName.trim()}>
                Добавить
              </button>
            </form>
            <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
              Затем укажите расход на блюдо в «Меню (блюда)» → рецепт. При создании заказа склад
              списывается автоматически; если не хватает — заказ блокируется.
            </div>
          </div>

          <h2 className="sub-h">Журнал движений</h2>
          <div className="card">
            {movements.length === 0 ? (
              <div className="empty">Движений пока нет.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>Ингредиент</th>
                    <th style={{ textAlign: "right" }}>Изменение</th>
                    <th>Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m._id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{dt(m.createdAt)}</td>
                      <td>{m.ingredientId?.name || "—"}</td>
                      <td
                        style={{ textAlign: "right", fontWeight: 800 }}
                        className={m.delta < 0 ? "disc-neg" : "disc-pos"}
                      >
                        {m.delta > 0 ? "+" : ""}
                        {fmt(m.delta)} {m.unit || m.ingredientId?.unit || ""}
                      </td>
                      <td className="muted">{REASON_RU(m)}</td>
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
