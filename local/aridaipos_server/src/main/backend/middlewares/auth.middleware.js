import { verifyToken, extractBearer } from "../utils/token.js";
import usersModel from "../models/users.model.js";
import { audit } from "../utils/audit.js";

// obsidian/02-arxitektura/xavfsizlik/auth-strategiyasi.md
// JWT verify + tokenVersion (revoke) + tenant claim tekshiruv

const authMiddleware = async (req, res, next) => {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ status: "error", code: "AUTH_REQUIRED" });
  }

  try {
    const payload = verifyToken(token);

    if (payload.type !== "user") {
      return res.status(403).json({ status: "error", code: "WRONG_TOKEN_TYPE" });
    }

    const user = await usersModel.findById(payload.userId);
    if (!user || user.isActive === false) {
      return res.status(401).json({ status: "error", code: "USER_INACTIVE" });
    }

    // Token bekor qilinganmi (logout, parol/role o'zgarishi)
    if ((user.tokenVersion ?? 1) !== payload.tokenVersion) {
      return res.status(401).json({ status: "error", code: "TOKEN_REVOKED" });
    }

    // Tenant claim — token bilan user mos kelishi shart
    if (String(user.restaurantId) !== String(payload.restaurantId)) {
      audit.log({
        kind: "token_tamper",
        severity: "critical",
        actor: { type: "user", id: payload.userId, role: payload.role },
        message: "Token restaurantId user bilan mos emas",
        endpoint: req.path,
        ip: req.ip,
      });
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }

    req.userData = user;
    req.userPayload = payload;
    next();
  } catch (error) {
    return res.status(401).json({ status: "error", code: "TOKEN_INVALID" });
  }
};

export default authMiddleware;
