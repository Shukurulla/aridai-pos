import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

/**
 * Sync-metadata + soft-delete mongoose plugin.
 *
 * Har sinxronlanadigan/o'chiriladigan modelga qo'shiladi:
 *  - isDeleted (soft delete — hech qachon fizik o'chirilmaydi, 1 oy saqlanadi)
 *  - version (optimistic lock / conflict resolution)
 *  - syncStatus (lokal↔global)
 *  - lastModifiedAt / lastModifiedBy
 *  - clientId (offline'da yaratilganda UUID)
 *
 * Qarang:
 *  - obsidian/05-data-model/sync-metadata.md
 *  - obsidian/07-nozik-nuqtalar/ochirish-cascade.md (soft delete + 1 oylik tiklash)
 */
export function syncMetaPlugin(schema, options = {}) {
  schema.add({
    // Soft delete — "isDeleted" canonical nom (foydalanuvchi qarori 2026-05-29)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    restoredAt: { type: Date, default: null },

    // Sync metadata
    clientId: { type: String, default: null }, // offline UUID (sparse unique index modelda)
    version: { type: Number, default: 1 },
    syncStatus: {
      type: String,
      enum: ["synced", "pending", "in_progress", "rejected", "conflict"],
      default: "synced",
      index: true,
    },
    lastModifiedAt: { type: Date, default: Date.now },
    lastModifiedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
      origin: { type: String, enum: ["local", "global", "system"], default: "global" },
      branchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
  });

  // ---- Yaratish/o'zgartirishda version + clientId ----
  // Mongoose 9: middleware'lar next'siz (sync/async) uslubda
  // LOCAL versiya: save() bilan yaratilgan/o'zgargan yozuv "pending" bo'ladi (global'ga push kerak).
  // Sync mirror (bulkWrite) bu hook'ni chetlab o'tadi — global'dan kelgan data "synced" qoladi.
  schema.pre("save", function () {
    if (this.isNew && !this.clientId) {
      this.clientId = uuidv4();
    }
    if (this.isNew) {
      this.syncStatus = "pending";
      if (this.lastModifiedBy) this.lastModifiedBy.origin = "local";
    } else if (this.isModified()) {
      this.version = (this.version || 1) + 1;
      this.lastModifiedAt = new Date();
      if (!this.isModified("syncStatus")) this.syncStatus = "pending";
    }
  });

  schema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function () {
    const update = this.getUpdate() || {};
    update.$set = update.$set || {};
    update.$set.lastModifiedAt = new Date();
    update.$inc = update.$inc || {};
    update.$inc.version = (update.$inc.version || 0) + 1;
    this.setUpdate(update);
  });

  // ---- Default query'lar soft-deleted'ni chiqarmaydi ----
  const findHooks = ["find", "findOne", "findOneAndUpdate", "countDocuments"];
  findHooks.forEach((hook) => {
    schema.pre(hook, function () {
      // includeDeleted: true bilan override qilish mumkin (admin "o'chirilganlar" ro'yxati)
      if (this.getOptions && this.getOptions().includeDeleted === true) return;
      const q = this.getQuery();
      if (q.isDeleted === undefined) {
        this.where({ isDeleted: { $ne: true } });
      }
    });
  });

  // Aggregate ham soft-deleted'ni chiqarmaydi
  schema.pre("aggregate", function () {
    const opts = this.options || {};
    if (opts.includeDeleted === true) return;
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  });

  // ---- Statics: soft delete / restore ----
  schema.statics.softDelete = function (id, actorId) {
    return this.findOneAndUpdate(
      { _id: id },
      { isDeleted: true, deletedAt: new Date(), deletedBy: actorId || null },
      { new: true },
    );
  };

  schema.statics.restore = function (id) {
    return this.findOneAndUpdate(
      { _id: id, isDeleted: true },
      { isDeleted: false, deletedAt: null, restoredAt: new Date() },
      { new: true, includeDeleted: true },
    );
  };

  // O'chirilganlar ro'yxati (1 oy ichidagi — tiklash uchun)
  schema.statics.findDeleted = function (filter = {}) {
    return this.find({ ...filter, isDeleted: true }, null, { includeDeleted: true });
  };
}

export default syncMetaPlugin;
