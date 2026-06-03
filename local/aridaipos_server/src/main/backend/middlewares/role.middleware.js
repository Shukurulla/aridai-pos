import { audit } from "../utils/audit.js";

// obsidian/02-arxitektura/xavfsizlik/role-based-access.md
// requireRole(...allowedRoles) — ruxsat yo'q bo'lsa 403 + audit

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role =
      req.userData?.role || req.userPayload?.role || req.restoranPayload?.role;

    if (!role) {
      return res.status(401).json({ status: "error", code: "AUTH_REQUIRED" });
    }

    if (!allowedRoles.includes(role)) {
      audit.log({
        kind: "rbac_denied",
        severity: "warn",
        actor: {
          type: req.userPayload?.type || req.restoranPayload?.type,
          id: req.userData?._id?.toString() || req.userPayload?.userId || req.restoranPayload?.restaurantId,
          role,
        },
        restaurantId: req.userPayload?.restaurantId || req.restoranPayload?.restaurantId,
        message: `Role yetarli emas: ${role}, kerak: ${allowedRoles.join("/")}`,
        endpoint: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({
        status: "error",
        code: "INSUFFICIENT_ROLE",
        message: `Bu amal uchun ${allowedRoles.join(" yoki ")} huquqi kerak`,
      });
    }

    next();
  };
}

export default requireRole;
