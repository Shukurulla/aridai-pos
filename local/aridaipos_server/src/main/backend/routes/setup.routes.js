import express from "express";
import mongoose from "mongoose";
import config from "../config/index.js";
import localConfigModel from "../models/local_config.model.js";
import { bootstrapSync } from "../sync/sync-client.js";

// POS provisioning — qurilmani filialga biriktirish (filial admin login).
// obsidian/02-arxitektura/local-backend-stack.md
const router = express.Router();

// Qurilma sozlanganmi (branchToken bormi)
router.get("/status", async (req, res) => {
  try {
    const cfg = await localConfigModel.findOne();
    const provisioned = Boolean(config.branchToken);
    return res.status(200).json({
      status: "success",
      provisioned,
      branchName: cfg?.branchName || null,
      globalUrl: config.globalUrl,
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Provision — filial admin telefon+parol → global'dan branchToken → saqlash → boshlang'ich sync
router.post("/provision", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ status: "error", code: "CREDENTIALS_REQUIRED" });
    }

    let json;
    try {
      const r = await fetch(`${config.globalUrl}/api/sync/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      json = await r.json();
      if (json.status !== "success") {
        return res.status(r.status >= 400 ? r.status : 400).json(json);
      }
    } catch {
      return res.status(502).json({ status: "error", code: "GLOBAL_UNREACHABLE", message: "Global serverга ulanib bo'lmadi" });
    }

    // Saqlash (lokal Mongo + runtime config)
    await localConfigModel.findOneAndUpdate(
      {},
      {
        branchToken: json.branchToken,
        branchId: json.branchId,
        restaurantId: json.restaurantId,
        branchName: json.branchName,
        provisionedAt: new Date(),
      },
      { upsert: true, new: true },
    );
    config.branchToken = json.branchToken;
    config.branchId = json.branchId;
    config.restaurantId = json.restaurantId;

    // Boshlang'ich sync (menyu/stol/xodim → lokal Mongo)
    const sync = await bootstrapSync();

    return res.status(200).json({ status: "success", branchName: json.branchName, sync: sync.counts });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Qurilmani qayta sozlash — boshqa filialga biriktirish (eski filial ma'lumotlari tozalanadi).
// DIQQAT: sync qilinmagan order'lar yo'qoladi — avval push qilish kerak.
router.post("/reset", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = [
      "local_configs", "restaurants", "branches", "categories", "foods",
      "tables", "services", "discounts", "users", "orders", "shifts",
    ];
    for (const c of collections) {
      await db.collection(c).deleteMany({}).catch(() => {});
    }
    config.branchToken = null;
    config.branchId = null;
    config.restaurantId = null;
    return res.status(200).json({ status: "success", message: "Qurilma qayta sozlashga tayyor" });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

export default router;
