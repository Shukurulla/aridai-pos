import { useState } from "react";
import { useAuth } from "../auth";
import { translateError } from "../api";

const COUNTRIES = [
  { code: "KZ", dial: "+7", len: 10, ph: "700 000 00 00" },
  { code: "UZ", dial: "+998", len: 9, ph: "90 123 45 67" },
];

export default function Login() {
  const { login } = useAuth();
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === country.len && password.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || loading) return;
    setError("");
    setLoading(true);
    try {
      await login(country.dial + digits, password);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <div className="logo">A</div>
          <div>
            <div className="t1">AridaiPOS</div>
            <div className="t2">Админ филиала</div>
          </div>
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 900 }}>Вход администратора</h2>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: 14 }}>
          Введите телефон и пароль администратора филиала
        </p>
        {error && <div className="alert err">{error}</div>}
        <div className="field">
          <label>Телефон</label>
          <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
            <select
              className="select"
              style={{ width: 122, flex: "0 0 auto" }}
              value={country.code}
              onChange={(e) => {
                setCountry(COUNTRIES.find((c) => c.code === e.target.value));
                setPhone("");
              }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.dial}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="tel"
              inputMode="numeric"
              placeholder={country.ph}
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, country.len))}
            />
          </div>
        </div>
        <div className="field">
          <label>Пароль</label>
          <input
            className="input"
            type="password"
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          className="btn primary"
          type="submit"
          style={{ width: "100%", height: 54, marginTop: 8 }}
          disabled={!valid || loading}
        >
          {loading ? "Вход…" : "ВОЙТИ"}
        </button>
      </form>
    </div>
  );
}
