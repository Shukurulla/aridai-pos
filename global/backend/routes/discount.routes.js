import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import branchesModel from "../models/branches.model.js";
import discountModel from "../models/discount.model.js";

const router = express.Router();

router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { title, discountPercent, branch } = req.body;

    const findBranch = await branchesModel.findById(branch);
    if (!findBranch)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday filial topilmadi" });

    const discount = await discountModel.create({
      title,
      discountPercent,
      branch,
    });

    return res.status(200).json({ status: "success", data: discount });
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

    const discounts = await discountModel
      .find({ branch: branchId })
      .populate("branch");

    return res.status(200).json({ status: "success", data: discounts });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await discountModel.findById(id).populate("branch");
    if (!discount)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday chegirma topilmadi" });

    return res.status(200).json({ status: "success", data: discount });
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

    const discount = await discountModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!discount)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday chegirma topilmadi" });

    return res.status(200).json({ status: "success", data: discount });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await discountModel.findByIdAndDelete(id);
    if (!discount)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday chegirma topilmadi" });

    return res
      .status(200)
      .json({ status: "success", message: "Chegirma o'chirildi" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
