import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { translateError } from "../api";
import PhoneInput from "../components/PhoneInput.jsx";

export default function Login() {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(phone.trim(), password);
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
        <h1>Панель ресторана</h1>
        <p className="sub">Вход для владельца ресторана</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="phone">Номер телефона</label>
          <PhoneInput id="phone" value={phone} onChange={setPhone} autoFocus />
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
          disabled={loading || !phone || !password}
        >
          {loading ? <span className="spinner" /> : "Войти"}
        </button>
      </form>
    </div>
  );
}
