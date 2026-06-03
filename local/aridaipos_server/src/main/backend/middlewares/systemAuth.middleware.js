import { verifyToken, extractBearer } from "../utils/token.js";
import systemAdminModel from "../models/system_admin.model.js";

// Tizim admini auth — faqat type:'system' token
const systemAuthMiddleware = async (req, res, next) => {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ status: "error", code: "AUTH_REQUIRED" });
  }
  try {
    const payload = verifyToken(token);
    if (payload.type !== "system") {
      return res.status(403).json({ status: "error", code: "WRONG_TOKEN_TYPE" });
    }
    const admin = await systemAdminModel.findById(payload.userId);
    if (!admin || admin.isActive === false) {
      return res.status(401).json({ status: "error", code: "INACTIVE" });
    }
    if ((admin.tokenVersion ?? 1) !== payload.tokenVersion) {
      return res.status(401).json({ status: "error", code: "TOKEN_REVOKED" });
    }
    req.systemAdmin = admin;
    req.systemPayload = payload;
    next();
  } catch {
    return res.status(401).json({ status: "error", code: "TOKEN_INVALID" });
  }
};

export default systemAuthMiddleware;
