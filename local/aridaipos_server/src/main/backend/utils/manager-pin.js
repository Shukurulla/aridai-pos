// Manager PIN tasdig'i — obsidian/02-arxitektura/xavfsizlik/firibgarlik-nazorati.md
// Maxsus amallar (oshxona boshlagan taomni bekor qilish, butun orderni bekor
// qilish, vozvrat) manager PIN talab qiladi.
//
// GRACEFUL yoqilish: filialda hech bir manager PIN o'rnatmagan bo'lsa — tasdiq
// talab qilinmaydi (joriy oqim buzilmaydi). Admin panelda PIN o'rnatilgach
// avtomatik majburiy bo'ladi. PIN'lar sync orqali local'ga keladi (hash).
import usersModel from "../models/users.model.js";
import { comparePin } from "./password.js";

const MANAGER_ROLES = ["branch_admin", "admin", "owner", "manager"];

// PIN tekshiruvi → { required, ok, approver }
//   required=false → filialda PIN sozlanmagan (amal tasdiqsiz o'tadi)
//   ok=true        → PIN to'g'ri (yoki talab qilinmaydi); approver = manager _id
export async function checkManagerPin(branch, pin) {
  const managers = await usersModel
    .find({ branch, role: { $in: MANAGER_ROLES }, isActive: { $ne: false }, pin: { $ne: null } })
    .select("+pin role name");
  if (!managers.length) return { required: false, ok: true, approver: null };
  if (!pin) return { required: true, ok: false, approver: null };
  for (const m of managers) {
    // eslint-disable-next-line no-await-in-loop
    if (await comparePin(pin, m.pin)) return { required: true, ok: true, approver: m._id };
  }
  return { required: true, ok: false, approver: null };
}

// Oshxona taomni boshlaganmi (waiting'dan keyingi har qanday holat)
export const kitchenStarted = (f) => !!f?.cookingStatus && f.cookingStatus !== "waiting";

// Standart 403 javob (POS xabarni ko'rsatadi)
export function pinError(res, pinGiven) {
  return res.status(403).json({
    success: false,
    error: {
      code: "PIN_REQUIRED",
      message: pinGiven
        ? "Неверный PIN менеджера"
        : "Требуется PIN менеджера для этой операции",
    },
  });
}
