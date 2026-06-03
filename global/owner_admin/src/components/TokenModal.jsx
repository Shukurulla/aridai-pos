import { useState } from "react";

export default function TokenModal({ branchName, token, onClose }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard недоступен */
    }
  }
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>POS-токен — {branchName}</h3>
          <button className="x-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="alert alert-warn">
            Этот токен показывается <b>только сейчас</b>. Скопируйте и введите его в приложение
            кассы (POS). Повторно он не отображается.
          </div>
          <div className="token-box">{token}</div>
          <button className="btn btn-primary" onClick={copy} style={{ width: "100%" }}>
            {copied ? "Скопировано ✓" : "Скопировать"}
          </button>
        </div>
      </div>
    </div>
  );
}
