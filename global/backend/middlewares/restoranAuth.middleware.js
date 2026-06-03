import { verifyToken, extractBearer } from "../utils/token.js";
import restaurantsModel from "../models/restaurants.model.js";

// obsidian/02-arxitektura/xavfsizlik/restoran-auth-tuzatish.md
// ESKI XATO TUZATILDI: telefon-token (parolsiz, abadiy) BEKOR → JWT verify + tokenVersion

const restoranMiddleware = async (req, res, next) => {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ status: "error", code: "AUTH_REQUIRED" });
  }

  try {
    const payload = verifyToken(token);

    if (payload.type !== "owner") {
      return res.status(403).json({ status: "error", code: "WRONG_TOKEN_TYPE" });
    }

    const restaurant = await restaurantsModel.findById(payload.restaurantId);
    if (!restaurant || restaurant.isActive === false) {
      return res.status(404).json({ status: "error", code: "RESTAURANT_NOT_FOUND" });
    }

    if ((restaurant.tokenVersion ?? 1) !== payload.tokenVersion) {
      return res.status(401).json({ status: "error", code: "TOKEN_REVOKED" });
    }

    req.restoranData = restaurant;
    req.restoranPayload = payload;
    next();
  } catch (error) {
    return res.status(403).json({ status: "error", code: "TOKEN_INVALID" });
  }
};

export default restoranMiddleware;
