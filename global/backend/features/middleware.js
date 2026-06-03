import restaurantsModel from "../models/restaurants.model.js";

// requireFeature(key) — tool yoqilmagan bo'lsa 404 FEATURE_DISABLED
// obsidian/03-tool-strategiyasi/feature-toggle-tizimi.md (3 qatlamli tekshiruv — REST qatlami)

export function requireFeature(featureKey) {
  return async (req, res, next) => {
    const restaurantId =
      req.userPayload?.restaurantId || req.restoranPayload?.restaurantId;
    if (!restaurantId) {
      return res.status(401).json({ status: "error", code: "AUTH_REQUIRED" });
    }

    try {
      const restaurant = await restaurantsModel.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ status: "error", code: "RESTAURANT_NOT_FOUND" });
      }

      // features — Map
      const entry = restaurant.features?.get
        ? restaurant.features.get(featureKey)
        : restaurant.features?.[featureKey];

      if (!entry || !entry.enabled) {
        return res.status(404).json({
          status: "error",
          code: "FEATURE_DISABLED",
          message: `"${featureKey}" ushbu restoranda yoqilmagan`,
        });
      }

      req.featureConfig = entry.config || {};
      next();
    } catch (err) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  };
}

export default requireFeature;
