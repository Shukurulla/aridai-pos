import { useState, useEffect, useCallback, useRef } from "react";
import { api, translateError } from "../api";
import { useAuth } from "../auth.jsx";
import RestaurantForm from "../components/RestaurantForm.jsx";

const LIMIT = 20;

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function LogoCell({ restaurant }) {
  const { logo, brand } = restaurant;
  const [broken, setBroken] = useState(false);
  const src = logo?.startsWith("http") ? logo : logo;
  return (
    <div className="logo-cell">
      {logo && !broken ? (
        <img className="logo-thumb" src={src} alt={brand} onError={() => setBroken(true)} />
      ) : (
        <div className="logo-fallback">{(brand || "?").charAt(0).toUpperCase()}</div>
      )}
      <strong>{brand}</strong>
    </div>
  );
}

export default function Restaurants() {
  const { admin, logout } = useAuth();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const debounceRef = useRef(null);

  const load = useCallback(async (opts = {}) => {
    const p = opts.page ?? page;
    const s = opts.search ?? search;
    setLoading(true);
    setError("");
    try {
      const res = await api.listRestaurants({ search: s, page: p, limit: LIMIT });
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load({ page: 1, search: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearchChange(value) {
    setSearch(value);
    setPage(1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load({ page: 1, search: value });
    }, 350);
  }

  function goPage(p) {
    setPage(p);
    load({ page: p });
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(r) {
    setEditing(r);
    setFormOpen(true);
  }

  function onSaved() {
    setFormOpen(false);
    setEditing(null);
    load();
  }

  async function confirmDelete(r) {
    if (!window.confirm(`Удалить ресторан «${r.brand}»?\n\n(Мягкое удаление — можно восстановить позже)`)) {
      return;
    }
    setDeletingId(r._id);
    try {
      await api.deleteRestaurant(r._id);
      const remaining = items.length - 1;
      const newPage = remaining === 0 && page > 1 ? page - 1 : page;
      setPage(newPage);
      await load({ page: newPage });
    } catch (err) {
      alert(translateError(err));
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="dot" /> AridaiPos
        </div>
        <div className="user">
          <span>{admin?.name || admin?.username || "admin"}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Выйти
          </button>
        </div>
      </div>

      <div className="page">
        <div className="page-head">
          <h2>Рестораны {total > 0 && <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>({total})</span>}</h2>
          <div className="toolbar">
            <div className="search">
              <input
                className="input"
                type="search"
                placeholder="Поиск по названию, телефону, владельцу…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={openCreate}>
              + Новый ресторан
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ресторан</th>
                <th>Владелец</th>
                <th>Телефон</th>
                <th>Валюта</th>
                <th>Статус</th>
                <th>Создан</th>
                <th style={{ textAlign: "right" }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="state">
                      <span className="spinner" /> Загрузка…
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="state">
                      {search ? "Ничего не найдено" : "Ресторанов пока нет. Создайте первый."}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <LogoCell restaurant={r} />
                    </td>
                    <td>{r.owner?.name || "—"}</td>
                    <td>{r.owner?.phone || "—"}</td>
                    <td>
                      <span className="badge badge-cur">{r.currency}</span>
                    </td>
                    <td>
                      {r.isActive === false ? (
                        <span className="badge badge-off">Неактивен</span>
                      ) : (
                        <span className="badge badge-on">Активен</span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{formatDate(r.createdAt)}</td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>
                          Изменить
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => confirmDelete(r)}
                          disabled={deletingId === r._id}
                        >
                          {deletingId === r._id ? <span className="spinner" /> : "Удалить"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <span>
              Страница {page} / {totalPages}
            </span>
            <div className="pages">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => goPage(page - 1)}
                disabled={page <= 1 || loading}
              >
                ← Назад
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => goPage(page + 1)}
                disabled={page >= totalPages || loading}
              >
                Вперёд →
              </button>
            </div>
          </div>
        )}
      </div>

      {formOpen && (
        <RestaurantForm
          initial={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
