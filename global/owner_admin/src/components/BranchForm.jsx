import { useState } from "react";
import { api, translateError } from "../api";

export default function BranchForm({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?._id);

  const [name, setName] = useState(initial?.name || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [receiptPrefix, setReceiptPrefix] = useState(initial?.receiptPrefix || "");
  const [posServerIp, setPosServerIp] = useState(initial?.posServerIp || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Введите название филиала");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        address: address.trim(),
        receiptPrefix: receiptPrefix.trim().toUpperCase().slice(0, 4),
      };
      if (isEdit) body.posServerIp = posServerIp.trim();

      if (isEdit) {
        await api.updateBranch(initial._id, body);
      } else {
        await api.createBranch(body);
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
            <h3>{isEdit ? "Редактировать филиал" : "Новый филиал"}</h3>
            <button type="button" className="x-btn" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="field">
              <label htmlFor="name">Название филиала</label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Центральный филиал"
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="address">Адрес</label>
              <input
                id="address"
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Улица, дом"
              />
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="prefix">Префикс чека</label>
                <input
                  id="prefix"
                  className="input"
                  value={receiptPrefix}
                  onChange={(e) => setReceiptPrefix(e.target.value)}
                  placeholder="MKZ"
                  maxLength={4}
                />
                <span className="hint">Отображается в номере чека (до 4 букв)</span>
              </div>

              {isEdit && (
                <div className="field">
                  <label htmlFor="posip">IP POS-сервера</label>
                  <input
                    id="posip"
                    className="input"
                    value={posServerIp}
                    onChange={(e) => setPosServerIp(e.target.value)}
                    placeholder="192.168.1.10"
                  />
                  <span className="hint">Адрес локального сервера</span>
                </div>
              )}
            </div>
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
