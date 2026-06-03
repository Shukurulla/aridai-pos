import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, translateError } from "../api";
import { MODE_LABEL, ROLE_LABEL } from "../constants";
import BranchForm from "../components/BranchForm.jsx";
import StaffForm from "../components/StaffForm.jsx";
import TokenModal from "../components/TokenModal.jsx";

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "—";
  }
}

function InfoRow({ label, children }) {
  return (
    <div className="info-row">
      <div className="info-k">{label}</div>
      <div className="info-v">{children}</div>
    </div>
  );
}

export default function BranchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [branch, setBranch] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [staffForm, setStaffForm] = useState(null); // {mode:'create'|'edit', data}
  const [tokenInfo, setTokenInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [staffBusyId, setStaffBusyId] = useState(null);

  const loadBranch = useCallback(async () => {
    // GET /branches/:id требует user-токен; владелец берёт филиал из общего списка
    const res = await api.listBranches();
    const found = (res.data || []).find((b) => b._id === id);
    if (!found) throw new Error("Филиал не найден");
    setBranch(found);
    return found;
  }, [id]);

  const loadStaff = useCallback(async () => {
    const res = await api.listStaff(id);
    setStaff(res.data || []);
  }, [id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadBranch();
      await loadStaff();
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  }, [loadBranch, loadStaff]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function onBranchSaved() {
    setEditOpen(false);
    try {
      await loadBranch();
    } catch (err) {
      setError(translateError(err));
    }
  }

  async function onStaffSaved() {
    setStaffForm(null);
    await loadStaff();
  }

  async function genToken() {
    if (!window.confirm(`Создать новый POS-токен для «${branch.name}»?\n\nСтарый токен (если был) перестанет работать.`)) return;
    setBusy(true);
    try {
      const res = await api.issueBranchToken(branch._id);
      setTokenInfo(res.branchToken);
    } catch (err) {
      alert(translateError(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteBranch() {
    if (!window.confirm(`Удалить филиал «${branch.name}»?\n\n(Мягкое удаление — POS-токен будет отозван)`)) return;
    setBusy(true);
    try {
      await api.deleteBranch(branch._id);
      navigate("/branches");
    } catch (err) {
      alert(translateError(err));
      setBusy(false);
    }
  }

  async function deleteStaff(u) {
    if (!window.confirm(`Удалить сотрудника «${u.name}»?`)) return;
    setStaffBusyId(u._id);
    try {
      await api.deleteStaff(u._id);
      await loadStaff();
    } catch (err) {
      alert(translateError(err));
    } finally {
      setStaffBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="state">
        <span className="spinner" /> Загрузка…
      </div>
    );
  }

  if (error && !branch) {
    return (
      <>
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-ghost" onClick={() => navigate("/branches")}>
          ← К филиалам
        </button>
      </>
    );
  }

  const mode = MODE_LABEL[branch.currentMode] || MODE_LABEL.unknown;

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="detail-head">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/branches")}>
          ← Филиалы
        </button>
        <div className="detail-actions">
          <button className="btn btn-ghost btn-sm" onClick={genToken} disabled={busy}>
            POS-токен
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}>
            Редактировать
          </button>
          <button className="btn btn-danger btn-sm" onClick={deleteBranch} disabled={busy}>
            Удалить
          </button>
        </div>
      </div>

      {/* Информация о филиале */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>{branch.name}</h3>
          <span className={`badge ${mode.cls}`}>{mode.text}</span>
        </div>
        <div className="panel-body">
          <div className="info-grid">
            <InfoRow label="Адрес">{branch.address || "—"}</InfoRow>
            <InfoRow label="Префикс чека">
              {branch.receiptPrefix ? <span className="badge badge-cur">{branch.receiptPrefix}</span> : "—"}
            </InfoRow>
            <InfoRow label="IP POS-сервера">{branch.posServerIp || "—"}</InfoRow>
            <InfoRow label="Создан">{formatDate(branch.createdAt)}</InfoRow>
            {Array.isArray(branch.allowedIps) && branch.allowedIps.length > 0 && (
              <InfoRow label="Разрешённые IP">{branch.allowedIps.join(", ")}</InfoRow>
            )}
          </div>
        </div>
      </div>

      {/* Сотрудники */}
      <div className="panel">
        <div className="panel-head">
          <h3>Сотрудники {staff.length > 0 && <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>({staff.length})</span>}</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setStaffForm({ mode: "create" })}>
            + Добавить сотрудника
          </button>
        </div>

        {staff.length === 0 ? (
          <div className="state">В этом филиале пока нет сотрудников</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Роль</th>
                <th>Статус</th>
                <th style={{ textAlign: "right" }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong></td>
                  <td style={{ color: "var(--text-dim)" }}>{u.phone}</td>
                  <td>
                    <span className="badge badge-role">{ROLE_LABEL[u.role] || u.role}</span>
                  </td>
                  <td>
                    {u.isActive === false ? (
                      <span className="badge badge-off">Неактивен</span>
                    ) : (
                      <span className="badge badge-on">Активен</span>
                    )}
                  </td>
                  <td>
                    <div className="cell-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setStaffForm({ mode: "edit", data: u })}
                      >
                        Изменить
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteStaff(u)}
                        disabled={staffBusyId === u._id}
                      >
                        {staffBusyId === u._id ? <span className="spinner" /> : "Удалить"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editOpen && (
        <BranchForm initial={branch} onClose={() => setEditOpen(false)} onSaved={onBranchSaved} />
      )}
      {staffForm && (
        <StaffForm
          initial={staffForm.mode === "edit" ? staffForm.data : null}
          branchId={branch._id}
          onClose={() => setStaffForm(null)}
          onSaved={onStaffSaved}
        />
      )}
      {tokenInfo && (
        <TokenModal branchName={branch.name} token={tokenInfo} onClose={() => setTokenInfo(null)} />
      )}
    </>
  );
}
