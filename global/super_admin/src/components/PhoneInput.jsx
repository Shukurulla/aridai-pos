import { useState } from "react";

// Код страны + маска. Наружу отдаёт номер в формате E.164 (+998901234567).
//  +998 → XX XXX XX XX (9 цифр)
//  +7   → XXX XXX XX XX (10 цифр)
const COUNTRIES = [
  { code: "+998", maxLen: 9, groups: [2, 3, 2, 2] },
  { code: "+7", maxLen: 10, groups: [3, 3, 2, 2] },
];

function parse(v) {
  const clean = (v || "").replace(/[^\d+]/g, "");
  for (const c of COUNTRIES) {
    if (clean.startsWith(c.code)) {
      return { code: c.code, digits: clean.slice(c.code.length).slice(0, c.maxLen) };
    }
  }
  return { code: "+998", digits: clean.replace(/\D/g, "").slice(0, 9) };
}

function format(code, digits) {
  const c = COUNTRIES.find((x) => x.code === code) || COUNTRIES[0];
  const parts = [];
  let i = 0;
  for (const g of c.groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + g));
    i += g;
  }
  return parts.join(" ");
}

export default function PhoneInput({ value, onChange, disabled, autoFocus, id }) {
  const [state, setState] = useState(() => parse(value));

  function emit(code, digits) {
    onChange(digits ? code + digits : "");
  }

  function onCountry(e) {
    const code = e.target.value;
    const c = COUNTRIES.find((x) => x.code === code);
    const digits = state.digits.slice(0, c.maxLen);
    setState({ code, digits });
    emit(code, digits);
  }

  function onDigits(e) {
    const c = COUNTRIES.find((x) => x.code === state.code);
    const raw = e.target.value.replace(/\D/g, "").slice(0, c.maxLen);
    setState({ ...state, digits: raw });
    emit(state.code, raw);
  }

  const c = COUNTRIES.find((x) => x.code === state.code) || COUNTRIES[0];
  const placeholder = c.groups.map((g) => "X".repeat(g)).join(" ");

  return (
    <div className="phone-input">
      <select
        className="select phone-cc"
        value={state.code}
        onChange={onCountry}
        disabled={disabled}
        aria-label="Код страны"
      >
        {COUNTRIES.map((x) => (
          <option key={x.code} value={x.code}>
            {x.code}
          </option>
        ))}
      </select>
      <input
        id={id}
        className="input phone-num"
        type="tel"
        inputMode="numeric"
        value={format(state.code, state.digits)}
        onChange={onDigits}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </div>
  );
}
