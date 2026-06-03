import { useState, useRef } from "react";
import { api, translateError } from "../api";
import PhoneInput from "./PhoneInput.jsx";

const CURRENCIES = [
  { value: "UZS", label: "UZS — сум (Узбекистан)" },
  { value: "KZT", label: "KZT — тенге (Казахстан)" },
];

// Если логотип — полный URL, показываем его; если /uploads — через прокси
function logoSrc(logo) {
  if (!logo) return null;
  if (logo.startsWith("http")) return logo;
  return logo; // /uploads/... — vite proxy
}

export default function RestaurantForm({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?._id);

  const [brand, setBrand] = useState(initial?.brand || "");
  const [currency, setCurrency] = useState(initial?.currency || "UZS");
  const [ownerName, setOwnerName] = useState(initial?.owner?.name || "");
  const [ownerPhone, setOwnerPhone] = useState(initial?.owner?.phone || "");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [isActive, setIsActive] = useState(
    initial?.isActive === undefined ? true : initial.isActive
  );

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(logoSrc(initial?.logo) || null);
  const fileRef = useRef(null);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function onPickLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function validate() {
    if (!brand.trim()) return "Введите название ресторана";
    if (!isEdit && !logoFile) return "Выберите логотип";
    if (!ownerName.trim()) return "Введите имя владельца";
    if (!ownerPhone.trim()) return "Введите телефон владельца";
    if (!isEdit && !ownerPassword) return "Введите пароль для владельца";
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
      fd.append("brand", brand.trim());
      if (!isEdit) fd.append("currency", currency); // валюта неизменна — только при создании
      if (logoFile) fd.append("logo", logoFile);
      if (isEdit) fd.append("isActive", String(isActive));

      const owner = { name: ownerName.trim(), phone: ownerPhone.trim() };
      if (ownerPassword) owner.password = ownerPassword;
      fd.append("owner", JSON.stringify(owner));

      if (isEdit) {
        await api.updateRestaurant(initial._id, fd);
      } else {
        await api.createRestaurant(fd);
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
            <h3>{isEdit ? "Редактировать ресторан" : "Новый ресторан"}</h3>
            <button type="button" className="x-btn" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>

          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="field">
              <label htmlFor="brand">Название ресторана</label>
              <input
                id="brand"
                className="input"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Например: Osh Markazi"
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="currency">Валюта</label>
                <select
                  id="currency"
                  className="select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={isEdit}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {isEdit && <span className="hint">Валюту изменить нельзя</span>}
              </div>

              <div className="field">
                <label>Логотип</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {logoPreview ? (
                    <img className="logo-preview" src={logoPreview} alt="logo" />
                  ) : (
                    <div className="logo-fallback" style={{ width: 64, height: 64 }}>
                      ?
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickLogo}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    Выбрать изображение
                  </button>
                </div>
              </div>
            </div>

            <div className="section-title">Владелец</div>

            <div className="field">
              <label htmlFor="ownerName">Имя</label>
              <input
                id="ownerName"
                className="input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Имя владельца"
              />
            </div>

            <div className="field">
              <label htmlFor="ownerPhone">Телефон</label>
              <PhoneInput id="ownerPhone" value={ownerPhone} onChange={setOwnerPhone} />
            </div>

            <div className="field">
              <label htmlFor="ownerPassword">
                Пароль {isEdit && <span className="hint">(оставьте пустым, чтобы не менять)</span>}
              </label>
              <input
                id="ownerPassword"
                className="input"
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {isEdit && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Активен (ресторан работает)
                </label>
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : isEdit ? "Сохранить" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
