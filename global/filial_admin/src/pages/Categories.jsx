import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useModal } from "../modal";

export default function Categories() {
  const { branchId, restaurantId } = useAuth();
  const dlg = useModal();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | {} (new) | category (edit)
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.categories(branchId);
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
    setModal({});
    setTitle("");
    setErr("");
  };
  const openEdit = (c) => {
    setModal(c);
    setTitle(c.title);
    setErr("");
  };
  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setErr("");
    try {
      if (modal._id) await api.categoryUpdate(modal._id, { title: title.trim() });
      else await api.categoryCreate({ title: title.trim(), branch: branchId, restaurantId });
      setModal(null);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const del = async (c) => {
    if (!(await dlg.confirm({ title: "Удалить категорию?", message: `«${c.title}» будет удалена.`, danger: true, okText: "Удалить" }))) return;
    try {
      await api.categoryDelete(c._id);
      await load();
    } catch (e) {
      dlg.alert(e.message);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Категории</h1>
        <button className="btn primary" onClick={openNew}>+ Категория</button>
      </div>
      <div className="card">
        {loading ? (
          <div className="empty">Загрузка…</div>
        ) : list.length === 0 ? (
          <div className="empty">Нет категорий. Создайте первую.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Название</th>
                <th style={{ width: 170, textAlign: "right" }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c._id}>
                  <td style={{ fontWeight: 700 }}>{c.title}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm ghost" onClick={() => openEdit(c)}>
                      Изм.
                    </button>{" "}
                    <button className="btn btn-sm danger" onClick={() => del(c)}>
                      Удал.
                    </button>
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
            <h2>{modal._id ? "Изменить категорию" : "Новая категория"}</h2>
            {err && <div className="alert err">{err}</div>}
            <div className="field">
              <label>Название</label>
              <input
                className="input"
                value={title}
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder="Горячие блюда"
              />
            </div>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn ghost" onClick={() => setModal(null)} disabled={busy}>
                Отмена
              </button>
              <button className="btn primary" onClick={save} disabled={busy || !title.trim()}>
                {busy ? "…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
