import { audit } from "../utils/audit.js";
import branchesModel from "../models/branches.model.js";

// obsidian/02-arxitektura/xavfsizlik/tenant-izolyatsiyasi.md
//
// Token claim'lari (restaurantId/branchId) bilan request'dagi qiymatlarni
// to'g'ridan-to'g'ri solishtiradi. Chuqurroq tekshiruv (branch shu restoranniki?)
// uchun assertBranchInRestaurant() ishlatiladi.

export function tenantGuard(req, res, next) {
  const payload = req.userPayload || req.restoranPayload;
  if (!payload) {
    return res.status(401).json({ status: "error", code: "AUTH_REQUIRED" });
  }

  const tokenRestaurantId = payload.restaurantId;
  const tokenBranchId = payload.branchId; // owner token'da bo'lmaydi

  const reqRestaurantId = req.params.restaurantId || req.body?.restaurantId;
  const reqBranchId = req.params.branchId || req.body?.branch || req.body?.branchId;

  const violations = [];
  if (reqRestaurantId && tokenRestaurantId && String(reqRestaurantId) !== String(tokenRestaurantId)) {
    violations.push({ key: "restaurantId", attempted: reqRestaurantId, actual: tokenRestaurantId });
  }
  // branchId tekshiruvi faqat user token uchun (owner istalgan filialga kira oladi)
  if (tokenBranchId && reqBranchId && String(reqBranchId) !== String(tokenBranchId)) {
    violations.push({ key: "branchId", attempted: reqBranchId, actual: tokenBranchId });
  }

  if (violations.length > 0) {
    audit.log({
      kind: "cross_tenant_attempt",
      severity: "critical",
      actor: { type: payload.type, id: payload.userId || payload.restaurantId, role: payload.role },
      restaurantId: tokenRestaurantId,
      branchId: tokenBranchId,
      message: "Tenant boundary violation",
      data: { violations },
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
  }

  next();
}

// Owner istalgan filialga kira oladi, lekin faqat O'Z restorani filialiga.
// Route handler'da ishlatish uchun helper.
export async function assertBranchInRestaurant(branchId, restaurantId) {
  const branch = await branchesModel.findById(branchId);
  if (!branch) return { ok: false, code: "BRANCH_NOT_FOUND" };
  if (String(branch.restaurant) !== String(restaurantId)) {
    return { ok: false, code: "TENANT_BOUNDARY_VIOLATION" };
  }
  return { ok: true, branch };
}

export default tenantGuard;
