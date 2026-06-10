import { useState } from "react";
import { api, translateError } from "../api";
import { BRANCH_ROLES } from "../constants";
import PhoneInput from "./PhoneInput.jsx";

export default function StaffForm({ initial, branchId, onClose, onSaved }) {
  const isEdit = Boolean(initial?._id);

  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [role, setRole] = useState(initial?.role || "cashier");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState(""); // Manager PIN (отмена/возврат на POS)
  const [isActive, setIsActive] = useState(
    initial?.isActive === undefined ? true : initial.isActive
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function validate() {
    if (!name.trim()) return "Введите имя сотрудника";
    if (!isEdit && !phone.trim()) return "Введите номер телефона";
    if (!isEdit && !password) return "Введите пароль";
    if (pin && !/^\d{4,6}$/.test(pin.trim())) return "PIN — 4-6 цифр";
    return "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setSaving(true);

    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("role", role);
      if (password) fd.append("password", password);
      if (pin.trim()) fd.append("pin", pin.trim());

      if (isEdit) {
        fd.append("isActive", String(isActive));
        await api.updateStaff(initial._id, fd);
      } else {
        fd.append("phone", phone.trim());
        fd.append("branch", branchId);
        await api.createStaff(fd);
      }
      onSaved();
    } catch (err) {
      setError(translateError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <form onSubmit={onSubmit}>
          <div className="modal-head">
            <h3>{isEdit ? "Редактировать сотрудника" : "Новый сотрудник"}</h3>
            <button type="button" className="x-btn" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="field">
              <label htmlFor="sname">Имя</label>
              <input
                id="sname"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя и фамилия"
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="sphone">Телефон</label>
              <PhoneInput id="sphone" value={phone} onChange={setPhone} disabled={isEdit} />
              {isEdit && <span className="hint">Телефон изменить нельзя</span>}
            </div>

            <div className="field">
              <label htmlFor="srole">Роль</label>
              <select
                id="srole"
                className="select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {BRANCH_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="spass">
                Пароль {isEdit && <span className="hint">(оставьте пустым, чтобы не менять)</span>}
              </label>
              <input
                id="spass"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {role === "branch_admin" && (
              <div className="field">
                <label htmlFor="spin">
                  PIN менеджера{" "}
                  <span className="hint">
                    (4-6 цифр — подтверждение отмен/возвратов на POS{isEdit ? "; пусто — не менять" : ""})
                  </span>
                </label>
                <input
                  id="spin"
                  className="input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  autoComplete="off"
                />
              </div>
            )}

            {isEdit && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Активен (может входить в систему)
                </label>
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : isEdit ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
