// Telefon raqami normalizatsiya (E.164)
// obsidian/07-nozik-nuqtalar/telefon-normalizatsiya.md
// UZS → UZ (+998), KZT → KZ (+7)

export function normalizePhone(input, defaultCountry = "UZ") {
  if (!input) throw new Error("Telefon raqami kerak");
  let cleaned = String(input).replace(/[^\d+]/g, "");

  // Eski 8-prefiks (RU/KZ) → +7
  if (cleaned.startsWith("8") && cleaned.length === 11) {
    cleaned = "+7" + cleaned.slice(1);
  }

  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("998")) cleaned = "+" + cleaned;
    else if (cleaned.startsWith("7") && cleaned.length === 11) cleaned = "+" + cleaned;
    else if (cleaned.length === 9 && defaultCountry === "UZ") cleaned = "+998" + cleaned;
    else if (cleaned.length === 10 && defaultCountry === "KZ") cleaned = "+7" + cleaned;
    else cleaned = "+" + cleaned;
  }

  if (!/^\+\d{10,15}$/.test(cleaned)) {
    throw new Error(`Noto'g'ri telefon raqami: ${input}`);
  }
  return cleaned;
}

export function countryFromCurrency(currency) {
  return currency === "KZT" ? "KZ" : "UZ";
}
