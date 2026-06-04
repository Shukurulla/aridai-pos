import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import branchesModel from "../models/branches.model.js";
import categoryModel from "../models/category.model.js";

const router = express.Router();

router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    // branch/restaurantId — body'dan YOKI token'dan (mobil admin uchun ishonchli)
    const branch = req.body.branch || String(req.userData?.branch || "");
    const restaurantId =
      req.body.restaurantId || req.userData?.restaurantId || undefined;

    const findBranch = await branchesModel.findById(branch);
    if (!findBranch)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday filial topilmadi" });

    const findCategory = await categoryModel.findOne({ title, branch });
    if (findCategory)
      return res
        .status(400)
        .json({ status: "error", message: "Bunday category mavjud" });

    const category = await categoryModel.create({
      ...req.body,
      branch,
      restaurantId,
    });

    return res.status(200).json({ status: "success", data: category });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/all/:branchId", authMiddleware, async (req, res) => {
  try {
    const { branchId } = req.params;

    const findBranch = await branchesModel.findById(branchId);
    if (!findBranch)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday filial topilmadi" });

    const categories = await categoryModel
      .find({ branch: branchId })
      .populate("branch");

    return res.status(200).json({ status: "success", data: categories });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const category = await categoryModel.findById(id).populate("branch");
    if (!category)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday category topilmadi" });

    return res.status(200).json({ status: "success", data: category });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { branch } = req.body;

    if (branch) {
      const findBranch = await branchesModel.findById(branch);
      if (!findBranch)
        return res
          .status(404)
          .json({ status: "error", message: "Bunday filial topilmadi" });
    }

    const category = await categoryModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!category)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday category topilmadi" });

    return res.status(200).json({ status: "success", data: category });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const category = await categoryModel.findByIdAndDelete(id);
    if (!category)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday category topilmadi" });

    return res
      .status(200)
      .json({ status: "success", message: "Category o'chirildi" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
