import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, translateError } from "../api";
import { MODE_LABEL } from "../constants";
import BranchForm from "../components/BranchForm.jsx";

export default function Branches() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.listBranches();
      setItems(res.data || []);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onSaved() {
    setFormOpen(false);
    load();
  }

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="page-actions">
        <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
          + Новый филиал
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Филиал</th>
              <th>Адрес</th>
              <th>Префикс чека</th>
              <th>Режим</th>
              <th style={{ textAlign: "right" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>
                  <div className="state">
                    <span className="spinner" /> Загрузка…
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="state">Филиалов пока нет. Создайте первый.</div>
                </td>
              </tr>
            ) : (
              items.map((b) => {
                const mode = MODE_LABEL[b.currentMode] || MODE_LABEL.unknown;
                return (
                  <tr key={b._id}>
                    <td>
                      <button
                        className="link-cell"
                        onClick={() => navigate(`/branches/${b._id}`)}
                      >
                        {b.name}
                      </button>
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{b.address || "—"}</td>
                    <td>
                      {b.receiptPrefix ? <span className="badge badge-cur">{b.receiptPrefix}</span> : "—"}
                    </td>
                    <td>
                      <span className={`badge ${mode.cls}`}>{mode.text}</span>
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(`/branches/${b._id}`)}
                        >
                          Подробнее →
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <BranchForm initial={null} onClose={() => setFormOpen(false)} onSaved={onSaved} />
      )}
    </>
  );
}
