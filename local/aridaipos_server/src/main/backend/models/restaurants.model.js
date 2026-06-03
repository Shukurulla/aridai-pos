import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";
import {
  CURRENCIES,
  DEFAULT_BUSINESS_DAY_START_HOUR,
} from "../config/constants.js";

// Feature toggle yozuvi — har tool uchun {enabled, config, installedVersion}
// Map sifatida saqlanadi → yangi tool qo'shish schema migration talab qilmaydi
// (production'da tool qo'shish — obsidian/03-tool-strategiyasi/feature-toggle-tizimi.md)
const featureEntrySchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    config: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    installedVersion: { type: Number, default: 0 },
    enabledAt: { type: Date, default: null },
    disabledAt: { type: Date, default: null },
  },
  { _id: false },
);

const restaurantSchema = new mongoose.Schema(
  {
    brand: { type: String, required: true },
    logo: { type: String, required: true },

    owner: {
      phone: { type: String, required: true },
      name: { type: String, required: true },
      password: { type: String, required: true, select: false }, // bcrypt hash
    },

    // Valyuta — yaratilgach o'zgartirib bo'lmaydi (obsidian/07-nozik-nuqtalar/pul-valyuta-yaxlitlash.md)
    currency: {
      type: String,
      enum: CURRENCIES,
      required: true,
      default: "UZS",
      immutable: true,
    },

    // Vaqt (obsidian/07-nozik-nuqtalar/vaqt-va-soat.md)
    timezone: { type: String, default: "Asia/Tashkent" },
    businessDayStartHour: { type: Number, default: DEFAULT_BUSINESS_DAY_START_HOUR },

    // Auth — JWT bekor qilish uchun (obsidian/02-arxitektura/xavfsizlik/auth-strategiyasi.md)
    tokenVersion: { type: Number, default: 1 },

    // Feature toggle (obsidian/03-tool-strategiyasi/feature-toggle-tizimi.md)
    features: {
      type: Map,
      of: featureEntrySchema,
      default: () => new Map(),
    },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null }, // system_admin
  },
  {
    timestamps: true,
    // features (Map) JSON'ga to'g'ri serialize bo'lishi uchun
    toJSON: { flattenMaps: true },
    toObject: { flattenMaps: true },
  },
);

restaurantSchema.plugin(syncMetaPlugin);

restaurantSchema.index({ "owner.phone": 1 }, { unique: true });
restaurantSchema.index({ brand: 1 });

export default mongoose.model("restaurant", restaurantSchema);
