import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import categoryModel from "../models/category.model.js";
import foodModel from "../models/food.model.js";
import branchesModel from "../models/branches.model.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

router.post("/create", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const { name, category, description, price, branch } = req.body;

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

    const food = await foodModel.create({
      ...req.body,
      image: req.file ? `/uploads/${req.file.filename}` : req.body.image,
    });

    return res.status(200).json({ status: "success", data: food });
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

router.put("/:id", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { branch, category } = req.body;
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

router.delete("/:id", authMiddleware, async (req, res) => {
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
