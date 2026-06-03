import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

const emptyT = { number: "", title: "", type: "table" };

export default function Tables() {
  const { branchId, restaurantId } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.tables(branchId);
      setList(r.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [branchId]);
  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setErr("");
    setModal({ id: null, form: { ...emptyT } });
  };
  const openEdit = (t) => {
    setErr("");
    setModal({
      id: t._id,
      form: { number: String(t.number ?? ""), title: t.title || "", type: t.type || "table" },
    });
  };
  const setF = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  const save = async () => {
    const f = modal.form;
    const num = Number(f.number);
    if (!num) {
      setErr("Укажите номер");
      return;
    }
    const title = f.title.trim() || (f.type === "cabin" ? `Кабина ${num}` : `Стол ${num}`);
    setBusy(true);
    setErr("");
    const body = { number: num, title, type: f.type, branch: branchId, restaurantId };
    try {
      if (modal.id) await api.tableUpdate(modal.id, body);
      else await api.tableCreate(body);
      setModal(null);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const del = async (t) => {
    if (!confirm(`Удалить «${t.title}»?`)) return;
    try {
      await api.tableDelete(t._id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Столы и кабины</h1>
        <button className="btn primary" onClick={openNew}>+ Стол / кабина</button>
      </div>
      <div className="card">
        {loading ? (
          <div className="empty">Загрузка…</div>
        ) : list.length === 0 ? (
          <div className="empty">Нет столов. Добавьте первый.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 70 }}>№</th>
                <th>Название</th>
                <th style={{ width: 130 }}>Тип</th>
                <th style={{ width: 170, textAlign: "right" }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {[...list].sort((a, b) => (a.number || 0) - (b.number || 0)).map((t) => (
                <tr key={t._id}>
                  <td style={{ fontWeight: 800 }}>{t.number}</td>
                  <td style={{ fontWeight: 700 }}>{t.title}</td>
                  <td>
                    {t.type === "cabin" ? (
                      <span className="tag cabin">кабина</span>
                    ) : (
                      <span className="tag">стол</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm ghost" onClick={() => openEdit(t)}>Изм.</button>{" "}
                    <button className="btn btn-sm danger" onClick={() => del(t)}>Удал.</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => !busy && setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.id ? "Изменить" : "Новый стол / кабина"}</h2>
            {err && <div className="alert err">{err}</div>}
            <div className="field">
              <label>Тип</label>
              <select className="select" value={modal.form.type} onChange={(e) => setF("type", e.target.value)}>
                <option value="table">Стол</option>
                <option value="cabin">Кабина (VIP)</option>
              </select>
            </div>
            <div className="field">
              <label>Номер</label>
              <input className="input" type="number" inputMode="numeric" value={modal.form.number} autoFocus
                onChange={(e) => setF("number", e.target.value)} placeholder="1" />
            </div>
            <div className="field">
              <label>Название (необязательно)</label>
              <input className="input" value={modal.form.title}
                onChange={(e) => setF("title", e.target.value)}
                placeholder={modal.form.type === "cabin" ? "Кабина 1" : "Стол 1"} />
            </div>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn ghost" onClick={() => setModal(null)} disabled={busy}>Отмена</button>
              <button className="btn primary" onClick={save} disabled={busy}>{busy ? "…" : "Сохранить"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
