import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    image: { type: String },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "branch",
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "restaurant",
      required: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: true,
      index: true,
    },

    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },

    // Soatlik taom (PlayStation, kabina, bilyard...) — narx (price) = SOATLIK stavka.
    // Orderga qo'shilganda vaqt boshlanadi, summa daqiqalarga bo'linib hisoblanadi.
    isHourly: { type: Boolean, default: false },

    // Stop-list / kunlik limit — core (obsidian/07-nozik-nuqtalar/stop-list-limit.md)
    availability: {
      stopped: { type: Boolean, default: false }, // manual stop-list
      stoppedAt: { type: Date, default: null },
      stoppedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
      stopReason: { type: String, default: null },
      dailyLimit: { type: Number, default: null }, // null = limitsiz
      soldToday: { type: Number, default: 0 },
      limitSetAt: { type: Date, default: null },
      autoStoppedByLimit: { type: Boolean, default: false },
    },

    // Sklad retsept (toggle yoqilgan bo'lsa) — obsidian/04-toollar/sklad.md
    recipe: [
      {
        ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: "ingredient" },
        quantity: { type: Number, required: true, min: 0 },
        unit: { type: String, required: true },
      },
    ],

    // Kelajak (ixtiyoriy)
    preparationTimeMinutes: { type: Number },
    allergens: { type: [String], default: [] },
    isHalal: { type: Boolean, default: true },
    spiciness: { type: Number, min: 0, max: 5 },
  },
  { timestamps: true },
);

foodSchema.plugin(syncMetaPlugin);

foodSchema.index({ restaurantId: 1, branch: 1, isDeleted: 1 });
foodSchema.index({ branch: 1, category: 1, isActive: 1, sortOrder: 1 });
foodSchema.index({ branch: 1, name: 1 });
foodSchema.index({ branch: 1, "availability.stopped": 1 });

export default mongoose.model("food", foodSchema);
