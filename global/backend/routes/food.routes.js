import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { tenantGuard, tenantResource } from "../middlewares/tenant.middleware.js";
import categoryModel from "../models/category.model.js";
import foodModel from "../models/food.model.js";
import branchesModel from "../models/branches.model.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

router.post("/create", authMiddleware, upload.single("image"), tenantGuard, async (req, res) => {
  try {
    const { category } = req.body;
    // branch/restaurantId — body'dan YOKI token'dan (mobil admin uchun ishonchli)
    const branch = req.body.branch || String(req.userData?.branch || "");
    const restaurantId =
      req.body.restaurantId || req.userData?.restaurantId || undefined;

    const findBranch = await branchesModel.findById(branch);
    if (!findBranch)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday filial topilmadi" });

    const findCategory = await categoryModel.findOne({ branch, _id: category });

    if (!findCategory)
      return res
        .status(400)
        .json({ status: "error", message: "Bunday category topilmadi" });

    // SKLAD retsept — FormData'da JSON string bo'lib keladi
    if (typeof req.body.recipe === "string") {
      try { req.body.recipe = JSON.parse(req.body.recipe); } catch { delete req.body.recipe; }
    }
    const food = await foodModel.create({
      ...req.body,
      branch,
      restaurantId,
      image: req.file ? `/uploads/${req.file.filename}` : req.body.image,
    });

    return res.status(200).json({ status: "success", data: food });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/all/:branchId", authMiddleware, tenantGuard, async (req, res) => {
  try {
    const { branchId } = req.params;
    const findBranch = await branchesModel.findById(branchId);
    if (!findBranch)
      return res
        .status(400)
        .json({ status: "error", message: "Bunday filial topilmadi" });

    const allFoods = await foodModel
      .find({ branch: branchId })
      .populate("branch")
      .populate("category");

    return res.status(200).json({ status: "success", data: allFoods });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const food = await foodModel
      .findById(id)
      .populate("branch")
      .populate("category");
    if (!food)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday taom topilmadi" });

    return res.status(200).json({ status: "success", data: food });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.put("/:id", authMiddleware, tenantResource(foodModel), upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { branch, category } = req.body;
    // SKLAD retsept — FormData'da JSON string bo'lib keladi
    if (typeof req.body.recipe === "string") {
      try { req.body.recipe = JSON.parse(req.body.recipe); } catch { delete req.body.recipe; }
    }
    const updateData = {
      ...req.body,
    };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    if (branch) {
      const findBranch = await branchesModel.findById(branch);
      if (!findBranch)
        return res
          .status(404)
          .json({ status: "error", message: "Bunday filial topilmadi" });
    }

    if (category) {
      const findCategory = await categoryModel.findById(category);
      if (!findCategory)
        return res
          .status(400)
          .json({ status: "error", message: "Bunday category topilmadi" });
    }

    const food = await foodModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!food)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday taom topilmadi" });

    return res.status(200).json({ status: "success", data: food });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.delete("/:id", authMiddleware, tenantResource(foodModel), async (req, res) => {
  try {
    const { id } = req.params;

    const food = await foodModel.findByIdAndDelete(id);
    if (!food)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday taom topilmadi" });

    return res
      .status(200)
      .json({ status: "success", message: "Taom o'chirildi" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
