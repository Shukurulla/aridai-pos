// NoSQL injection oldini olish — obsidian/07-nozik-nuqtalar/xavfsizlik-qoshimcha.md
// express-mongo-sanitize Express 5 bilan mos emas (req.query read-only),
// shuning uchun o'z sanitizer'imiz (faqat body/params — ular mutable).

function clean(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      clean(obj[key]);
    }
  }
}

export function mongoSanitize(req, _res, next) {
  clean(req.body);
  clean(req.params);
  next();
}

export default mongoSanitize;
