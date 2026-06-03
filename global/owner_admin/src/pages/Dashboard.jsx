import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api, translateError } from "../api";
import { FEATURE_META, featuresToObject } from "../features";

export default function Dashboard() {
  const { restaurant } = useAuth();
  const [branchCount, setBranchCount] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listBranches()
      .then((res) => setBranchCount((res.data || []).length))
      .catch((err) => setError(translateError(err)));
  }, []);

  const features = featuresToObject(restaurant?.features);
  const activeFeatures = FEATURE_META.filter((f) => features[f.key]?.enabled);

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="cards">
        <div className="card">
          <div className="k">Филиалы</div>
          <div className="v">{branchCount === null ? "…" : branchCount}</div>
        </div>
        <div className="card">
          <div className="k">Активные функции</div>
          <div className="v">{activeFeatures.length}</div>
        </div>
        <div className="card">
          <div className="k">Валюта</div>
          <div className="v">{restaurant?.currency || "—"}</div>
        </div>
        <div className="card">
          <div className="k">Часовой пояс</div>
          <div className="v" style={{ fontSize: 16 }}>
            {restaurant?.timezone || "—"}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h3>Данные ресторана</h3>
        </div>
        <div className="panel-body">
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            {restaurant?.logo ? (
              <img
                src={restaurant.logo}
                alt={restaurant.brand}
                style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", border: "1px solid var(--border)" }}
              />
            ) : null}
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{restaurant?.brand}</div>
              <div style={{ color: "var(--text-dim)", marginTop: 4 }}>
                Владелец: {restaurant?.owner?.name} · {restaurant?.owner?.phone}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Включённые функции</h3>
          <Link to="/features" className="btn btn-ghost btn-sm">
            Управление
          </Link>
        </div>
        <div className="panel-body">
          {activeFeatures.length === 0 ? (
            <div style={{ color: "var(--text-dim)" }}>Пока нет активных функций</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {activeFeatures.map((f) => (
                <span key={f.key} className="badge badge-on">
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
