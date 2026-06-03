import express from "express";
import usersModel from "../models/users.model.js";
import restaurantsModel from "../models/restaurants.model.js";
import branchesModel from "../models/branches.model.js";
import localConfigModel from "../models/local_config.model.js";
import config from "../config/index.js";
import { bootstrapSync, startSyncLoop } from "../sync/sync-client.js";
import { comparePassword, dummyCompare } from "../utils/password.js";
import { normalizePhone } from "../utils/phone.js";
import { signUserToken } from "../utils/token.js";

// Lokal POS login — kepket frontend kutgan formatda
//   { success, data: { staff: {firstName, lastName, ...}, token, restaurant, branch } }
//
// MUHIM (filial dinamik yuklash): local server BITTA filialga qotib qolmaydi.
// Login local'da topilmasa — GLOBAL orqali tekshiriladi (qaysi restoran/filial admini
// bo'lsa), o'sha filial ma'lumoti local'ga yuklanadi (provision + bootstrap). Shunda
// istalgan filial admini kirsa, o'sha filialga ulanadi. Offline (global yo'q) bo'lsa —
// faqat oldin yuklangan (keshlangan) filial userlari kira oladi.
const router = express.Router();

// Local'da topilmagan filial admini → global'dan tekshir + O'SHA filialni yukla.
// { ok } muvaffaqiyat, { invalid } noto'g'ri parol/admin emas, { offline } global yo'q.
async function provisionFromGlobal(phone, password) {
  let json;
  try {
    const r = await fetch(`${config.globalUrl}/api/sync/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    json = await r.json();
  } catch {
    return { offline: true };
  }
  if (!json || json.status !== "success") return { invalid: true };

  // Filialni faollashtirish (branchToken) — sync loop ham endi shu filialни tortadi
  config.branchToken = json.branchToken;
  config.branchId = json.branchId;
  config.restaurantId = json.restaurantId;
  await localConfigModel.findOneAndUpdate(
    {},
    {
      branchToken: json.branchToken,
      branchId: json.branchId,
      restaurantId: json.restaurantId,
      branchName: json.branchName,
      provisionedAt: new Date(),
    },
    { upsert: true },
  );
  // O'sha filial ma'lumotini local'ga yuklash (menyu, stol, userlar — parol hashi bilan)
  await bootstrapSync();
  startSyncLoop(10000); // davriy sync (idempotent — qayta boshlaydi)
  return { ok: true, branchName: json.branchName };
}

router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, error: { message: "Введите телефон и пароль" } });
    }
    const normPhone = normalizePhone(phone);
    // 1 local server = 1 AKTIV filial (izchillik: status UI + POS + sync hammasi bitta filial).
    // User'ni AKTIV filial ichida qidiramiz — boshqa filial useri "topilmagan" hisoblanadi.
    const active = config.branchId ? String(config.branchId) : null;

    let user = await usersModel
      .findOne(active ? { phone: normPhone, branch: active } : { phone: normPhone })
      .select("+password");

    // Aktiv filialda YO'Q → global orqali tekshir. branch_admin bo'lsa, qurilmani O'SHA
    // filialга O'TKAZADI (provision + bootstrap) — endi butun qurilma o'sha filial bo'ladi.
    // Oddiy xodim (waiter) boshqa filialdan bo'lsa — provision rad etadi (faqat admin o'tkaza oladi).
    if (!user) {
      const prov = await provisionFromGlobal(phone, password);
      if (prov.offline) {
        return res.status(503).json({
          success: false,
          error: { message: "Нет связи с сервером. Для первого входа нужен интернет." },
        });
      }
      if (prov.ok) {
        user = await usersModel
          .findOne({ phone: normPhone, branch: config.branchId })
          .select("+password");
      }
      // prov.invalid bo'lsa — user topilmagan holicha qoladi → pastda 401
    }

    if (!user || user.isActive === false) {
      await dummyCompare();
      return res.status(401).json({ success: false, error: { message: "Неверный телефон или пароль" } });
    }
    const ok = await comparePassword(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, error: { message: "Неверный телефон или пароль" } });
    }

    const token = signUserToken(user);
    const parts = (user.name || "").trim().split(" ");
    const firstName = parts[0] || user.name || "";
    const lastName = parts.slice(1).join(" ");

    const [restaurant, branchDoc] = await Promise.all([
      restaurantsModel.findById(user.restaurantId).select("brand"),
      branchesModel.findById(user.branch).select("name"),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        staff: {
          _id: user._id,
          firstName,
          lastName,
          phone: user.phone,
          role: user.role,
          restaurantId: user.restaurantId,
          branchId: user.branch,
        },
        token,
        restaurant: { _id: restaurant?._id, name: restaurant?.brand || "Ресторан" },
        branch: branchDoc ? { _id: branchDoc._id, name: branchDoc.name } : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

export default router;
