import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useModal } from "../modal";
import { Icon } from "../icons";

// QR ЗАКАЗЫ — obsidian/04-toollar/qr-order.md
// Yuqorida: tasdiqlash kutayotgan mijoz so'rovlari (7s poll — kassir shu yerda
// Подтвердить/Отклонить bosadi). Pastda: stollar QR-kodlari (yaratish/chop etish).
const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
const dt = (d) => (d ? new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—");

export default function QrOrders() {
  const { branchId } = useAuth();
  const modal = useModal();
  const [pending, setPending] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrView, setQrView] = useState(null); // {table, url, png}
  const timer = useRef(null);

  const loadPending = useCallback(async () => {
    try {
      const r = await api.qrPending();
      setPending(r.data || []);
      setDisabled(false);
      setErr("");
    } catch (e) {
      if (e.code === "FEATURE_DISABLED") setDisabled(true);
      else setErr(e.message);
    }
  }, []);

  const loadTables = useCallback(async (bid) => {
    try {
      const r = await api.tables(bid);
      setTables(r.data || []);
    } catch {
      /* stollar ixtiyoriy */
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadPending();
      if (branchId) await loadTables(branchId);
      setLoading(false);
    })();
    timer.current = setInterval(loadPending, 7000); // yangi so'rovlar real-vaqtga yaqin
    return () => clearInterval(timer.current);
  }, [loadPending, loadTables, branchId]);

  const approve = async (r) => {
    setBusy(true);
    try {
      await api.qrApprove(r._id);
      await loadPending();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const reject = async (r) => {
    const ok = await modal.confirm({
      title: "Отклонить заказ?",
      message: `${r.tableId?.title || "Стол"} — клиент получит сообщение об отказе.`,
      okText: "Отклонить",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.qrReject(r._id);
      await loadPending();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const showQr = async (t, regenerate = false) => {
    setBusy(true);
    try {
      const r = await api.tableQr(t._id, { regenerate, enabled: true });
      setQrView({ table: t, ...r.data });
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const printQr = () => {
    if (!qrView) return;
    const w = window.open("", "_blank", "width=420,height=560");
    w.document.write(`<html><head><title>QR — ${qrView.table.title}</title></head>
      <body style="font-family:Arial;text-align:center;padding:30px;">
        <h2 style="margin-bottom:4px;">${qrView.table.title}</h2>
        <div style="color:#666;font-size:13px;margin-bottom:14px;">Отсканируйте — закажите со стола</div>
        <img src="${qrView.png}" style="width:300px;height:300px;"/>
        <div style="font-size:11px;color:#999;margin-top:10px;">${qrView.url}</div>
        <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  if (disabled) {
    return (
      <div>
        <div className="page-head"><h1>QR заказы</h1></div>
        <div className="card">
          <div className="empty">
            Модуль «QR заказ» выключен для вашего ресторана.
            <br />
            Включите его в панели владельца (Функции → QR заказ) — клиенты смогут
            заказывать со стола, отсканировав QR-код.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>QR заказы</h1>
        <div className="row">
          <button className="btn ghost btn-sm icon-btn" onClick={loadPending} disabled={loading}>
            <Icon name="refresh" size={15} /> Обновить
          </button>
        </div>
      </div>

      {err && <div className="alert err">{err}</div>}

      <h2 className="sub-h">Ожидают подтверждения {pending.length > 0 && `(${pending.length})`}</h2>
      <div className="card" style={{ marginBottom: 14 }}>
        {pending.length === 0 ? (
          <div className="empty">Новых запросов нет. Страница обновляется автоматически.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Стол</th>
                <th>Блюда</th>
                <th style={{ textAlign: "right" }}>Сумма</th>
                <th>Время</th>
                <th style={{ width: 230 }}></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => {
                const total = (r.items || []).reduce((s, i) => s + i.foodPrice * i.quantity, 0);
                return (
                  <tr key={r._id}>
                    <td style={{ fontWeight: 800 }}>{r.tableId?.title || "—"}</td>
                    <td>{(r.items || []).map((i) => `${i.foodName} ×${i.quantity}`).join(", ")}</td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{fmt(total)}</td>
                    <td className="muted">{dt(r.createdAt)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm btn-primary" onClick={() => approve(r)} disabled={busy}>
                        ✓ Подтвердить
                      </button>{" "}
                      <button className="btn btn-sm danger" onClick={() => reject(r)} disabled={busy}>
                        Отклонить
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="sub-h">QR-коды столов</h2>
      <div className="card">
        {tables.length === 0 ? (
          <div className="empty">Столы не найдены.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Стол</th>
                <th>QR</th>
                <th style={{ width: 260 }}></th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t._id}>
                  <td style={{ fontWeight: 800 }}>{t.title}</td>
                  <td className="muted">{t.qrSlug ? (t.qrEnabled === false ? "выключен" : "активен") : "не создан"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-sm" onClick={() => showQr(t)} disabled={busy}>
                      {t.qrSlug ? "Показать QR" : "Создать QR"}
                    </button>{" "}
                    {t.qrSlug && (
                      <button
                        className="btn btn-sm ghost"
                        title="Пересоздать (старые наклейки перестанут работать)"
                        onClick={() => showQr(t, true)}
                        disabled={busy}
                      >
                        ↻
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {qrView && (
        <div className="modal-overlay" onMouseDown={() => setQrView(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
            <div className="modal-head">
              <h3>QR — {qrView.table.title}</h3>
              <button className="x-btn" onClick={() => setQrView(null)}>×</button>
            </div>
            <div className="modal-body">
              <img src={qrView.png} alt="QR" style={{ width: 260, height: 260 }} />
              <div className="muted" style={{ fontSize: 12, marginTop: 8, wordBreak: "break-all" }}>{qrView.url}</div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setQrView(null)}>Закрыть</button>
              <button className="btn btn-primary" onClick={printQr}>Печать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
