import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { Icon } from "../icons";

// КЕШБЭК balanslari — obsidian/04-toollar/keshbek-tizimi.md
// Mijozlar (telefon) va qoldiqlari; telefon bo'yicha harakatlar jurnali.
const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
const dt = (d) =>
  d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default function Keshbek() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null); // tanlangan telefon
  const [moves, setMoves] = useState([]);
  const [movesLoading, setMovesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.keshbekBalances();
      setList(r.data || []);
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

  const openMoves = async (phone) => {
    setSel(phone);
    setMovesLoading(true);
    try {
      const r = await api.keshbekMovements(phone);
      setMoves(r.data || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setMovesLoading(false);
    }
  };

  if (disabled) {
    return (
      <div>
        <div className="page-head">
          <h1>Кешбэк</h1>
        </div>
        <div className="card">
          <div className="empty">
            Модуль «Кешбэк» выключен для вашего ресторана.
            <br />
            Включите его в панели владельца (Функции → Кешбэк) — на чеках появится QR,
            клиенты будут копить и тратить кешбэк.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>Кешбэк</h1>
        <div className="row">
          <button className="btn ghost btn-sm icon-btn" onClick={load} disabled={loading}>
            <Icon name="refresh" size={15} /> Обновить
          </button>
        </div>
      </div>

      {err && <div className="alert err">{err}</div>}

      {loading ? (
        <div className="card">
          <div className="empty">Загрузка…</div>
        </div>
      ) : (
        <div className="card">
          {list.length === 0 ? (
            <div className="empty">
              Пока нет клиентов с кешбэком. После оплаты на чеке печатается QR — клиент
              сканирует его и отправляет номер телефона, кешбэк зачисляется на баланс.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Телефон</th>
                  <th style={{ textAlign: "right" }}>Баланс</th>
                  <th style={{ textAlign: "right" }}>Начислено</th>
                  <th style={{ textAlign: "right" }}>Потрачено</th>
                  <th>Активность</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b._id}>
                    <td style={{ fontWeight: 800 }}>{b.clientPhone}</td>
                    <td style={{ textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(b.balance)}</td>
                    <td style={{ textAlign: "right" }} className="disc-pos">+{fmt(b.totalEarned)}</td>
                    <td style={{ textAlign: "right" }} className="disc-neg">−{fmt(b.totalSpent)}</td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{dt(b.lastActivityAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-sm ghost" onClick={() => openMoves(b.clientPhone)}>
                        История
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {sel && (
        <>
          <h2 className="sub-h">История — {sel}</h2>
          <div className="card">
            {movesLoading ? (
              <div className="empty">Загрузка…</div>
            ) : moves.length === 0 ? (
              <div className="empty">Движений нет.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>Операция</th>
                    <th style={{ textAlign: "right" }}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m._id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{dt(m.createdAt)}</td>
                      <td>{m.direction === "earn" ? "Начисление" : "Списание (оплата)"}</td>
                      <td style={{ textAlign: "right", fontWeight: 800 }} className={m.direction === "earn" ? "disc-pos" : "disc-neg"}>
                        {m.direction === "earn" ? "+" : "−"}
                        {fmt(m.amount)}
                      </td>
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
