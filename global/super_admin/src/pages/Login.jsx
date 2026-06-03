import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { translateError } from "../api";

// Davlat kodi selektori — KZ (+7) / UZ (+998). Telefon raqam bo'yicha login.
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
  const fullPhone = country.dial + digits;
  const phoneValid = digits.length === country.len;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(fullPhone, password);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand-badge">
          <span className="dot" /> AridaiPos
        </div>
        <h1>Панель системного администратора</h1>
        <p className="sub">Вход для управления ресторанами</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="phone">Телефон</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="input"
              aria-label="Код страны"
              value={country.code}
              onChange={(e) => {
                setCountry(COUNTRIES.find((c) => c.code === e.target.value));
                setPhone("");
              }}
              style={{ width: 132, flex: "0 0 auto" }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.dial}
                </option>
              ))}
            </select>
            <input
              id="phone"
              className="input"
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              placeholder={country.ph}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, country.len))}
              style={{ flex: 1 }}
              autoFocus
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          className="btn btn-primary"
          type="submit"
          style={{ width: "100%", marginTop: 8 }}
          disabled={loading || !phoneValid || !password}
        >
          {loading ? <span className="spinner" /> : "Войти"}
        </button>
      </form>
    </div>
  );
}
