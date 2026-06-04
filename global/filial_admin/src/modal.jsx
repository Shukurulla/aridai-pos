import { createContext, useContext, useState, useCallback, useMemo } from "react";

// Reusable modal — brauzer confirm/prompt/alert o'rniga (kepket dizayn).
// useModal() → { confirm, prompt, alert } — har biri Promise qaytaradi.
//   await modal.confirm({ title, message, danger, okText })  → boolean
//   await modal.prompt({ title, message, defaultValue, placeholder, suffix }) → string | null
//   await modal.alert("matn")  yoki  alert({ title, message })  → void

const ModalCtx = createContext(null);
export const useModal = () => useContext(ModalCtx);

const norm = (o) => (typeof o === "string" ? { message: o } : o || {});

export function ModalProvider({ children }) {
  const [m, setM] = useState(null); // { kind, ..., resolve }
  const [val, setVal] = useState("");

  const done = useCallback(
    (value) => {
      setM((cur) => {
        cur?.resolve?.(value);
        return null;
      });
    },
    [],
  );

  const apiRef = useMemo(
    () => ({
      confirm: (opts) =>
        new Promise((resolve) =>
          setM({
            kind: "confirm",
            okText: "Подтвердить",
            cancelText: "Отмена",
            danger: false,
            ...norm(opts),
            resolve,
          }),
        ),
      prompt: (opts) => {
        const o = norm(opts);
        setVal(o.defaultValue != null ? String(o.defaultValue) : "");
        return new Promise((resolve) =>
          setM({ kind: "prompt", okText: "Сохранить", cancelText: "Отмена", ...o, resolve }),
        );
      },
      alert: (opts) =>
        new Promise((resolve) =>
          setM({ kind: "alert", okText: "Понятно", ...norm(opts), resolve }),
        ),
    }),
    [],
  );

  const onOk = () =>
    done(m.kind === "confirm" ? true : m.kind === "prompt" ? val : undefined);
  const onCancel = () => done(m.kind === "confirm" ? false : m.kind === "prompt" ? null : undefined);

  return (
    <ModalCtx.Provider value={apiRef}>
      {children}
      {m && (
        <div
          className="modal-bg"
          onClick={() => onCancel()}
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            {m.title && <h2 style={{ marginBottom: m.message ? 10 : 16 }}>{m.title}</h2>}
            {m.message && (
              <p style={{ margin: "0 0 16px", color: "var(--mute, #7a7468)", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                {m.message}
              </p>
            )}
            {m.kind === "prompt" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <input
                  autoFocus
                  value={val}
                  inputMode={m.numeric ? "numeric" : undefined}
                  placeholder={m.placeholder || ""}
                  onChange={(e) => setVal(m.numeric ? e.target.value.replace(/[^\d]/g, "") : e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOk();
                    if (e.key === "Escape") onCancel();
                  }}
                  style={{
                    flex: 1,
                    padding: "11px 13px",
                    border: "1px solid var(--line2, #ddd7c8)",
                    borderRadius: 8,
                    fontSize: 15,
                    fontFamily: "inherit",
                    background: "#fff",
                  }}
                />
                {m.suffix && <span style={{ fontWeight: 800, color: "var(--mute, #7a7468)" }}>{m.suffix}</span>}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              {m.kind !== "alert" && (
                <button className="btn ghost" onClick={onCancel}>
                  {m.cancelText}
                </button>
              )}
              <button className={`btn ${m.danger ? "danger" : ""}`} onClick={onOk}>
                {m.okText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalCtx.Provider>
  );
}
