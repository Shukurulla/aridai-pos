import { verifyBranchToken, extractBearer } from "../utils/token.js";
import branchesModel from "../models/branches.model.js";

// Lokal backend ↔ global ulanish auth — branchToken (alohida BRANCH_SECRET).
// obsidian/02-arxitektura/xavfsizlik/auth-strategiyasi.md
const branchAuthMiddleware = async (req, res, next) => {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ status: "error", code: "AUTH_REQUIRED" });
  }
  try {
    const payload = verifyBranchToken(token);
    if (payload.type !== "branch") {
      return res.status(403).json({ status: "error", code: "WRONG_TOKEN_TYPE" });
    }
    const branch = await branchesModel.findById(payload.branchId);
    if (!branch) {
      return res.status(404).json({ status: "error", code: "BRANCH_NOT_FOUND" });
    }
    if (branch.tokenRevoked) {
      return res.status(401).json({ status: "error", code: "TOKEN_REVOKED" });
    }
    req.branch = branch;
    req.branchPayload = payload;
    next();
  } catch {
    return res.status(401).json({ status: "error", code: "TOKEN_INVALID" });
  }
};

export default branchAuthMiddleware;
