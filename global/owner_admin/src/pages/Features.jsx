import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { api, translateError } from "../api";
import { FEATURE_META, featuresToObject } from "../features";

export default function Features() {
  const { restaurant, refreshRestaurant } = useAuth();
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const features = featuresToObject(restaurant?.features);

  async function toggle(meta, nextEnabled) {
    setError("");
    setNotice("");

    // Предупреждение о зависимостях на стороне UI (backend всё равно проверяет)
    if (nextEnabled) {
      const unmet = meta.requires.filter((r) => !features[r]?.enabled);
      if (unmet.length) {
        setError(`Сначала включите: ${unmet.join(", ")}`);
        return;
      }
      const conflict = meta.excludes.filter((e) => features[e]?.enabled);
      if (conflict.length) {
        setError(`«${meta.name}» не работает вместе с: ${conflict.join(", ")}`);
        return;
      }
    }

    setBusyKey(meta.key);
    try {
      await api.toggleFeature(restaurant._id, meta.key, { enabled: nextEnabled });
      await refreshRestaurant();
      setNotice(`«${meta.name}» ${nextEnabled ? "включена" : "выключена"}`);
    } catch (err) {
      if (err.code === "CASCADE" && err.cascade?.length) {
        setError(`Если выключить «${meta.name}», перестанут работать зависимые функции: ${err.cascade.join(", ")}. Сначала выключите их.`);
      } else {
        setError(translateError(err));
      }
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="panel">
        <div className="panel-head">
          <h3>Функции</h3>
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
            Изменения вступают в силу сразу
          </span>
        </div>
        <div>
          {FEATURE_META.map((meta) => {
            const entry = features[meta.key] || { enabled: false };
            const isBusy = busyKey === meta.key;
            return (
              <div className="feature-row" key={meta.key}>
                <div className="feature-info">
                  <div className="name">{meta.name}</div>
                  <div className="meta">{meta.desc}</div>
                  {(meta.requires.length > 0 || meta.excludes.length > 0) && (
                    <div className="meta">
                      {meta.requires.length > 0 && (
                        <>требует: {meta.requires.map((r) => <code key={r}>{r}</code>)} </>
                      )}
                      {meta.excludes.length > 0 && (
                        <>· несовместимо: {meta.excludes.map((e) => <code key={e}>{e}</code>)}</>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {isBusy && <span className="spinner" />}
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!entry.enabled}
                      disabled={isBusy}
                      onChange={(e) => toggle(meta, e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
