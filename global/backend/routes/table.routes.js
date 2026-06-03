import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import restoranMiddleware from "../middlewares/restoranAuth.middleware.js";
import branchesModel from "../models/branches.model.js";
import tableModel from "../models/table.model.js";
const router = express.Router();

router.post(
  "/table/create",
  authMiddleware,
  restoranMiddleware,
  async (req, res) => {
    try {
      const { title, number, branch } = req.body;

      const findBranch = await branchesModel.findById(branch);

      if (!findBranch)
        return res
          .status(404)
          .json({ status: "error", message: "Bunday filial topilmadi" });

      const findTable = await tableModel.findOne({ title, number, branch });

      if (findTable)
        return res.status(400).json({
          status: "error",
          message: "Stol nomi va raqamlari bir xil bolishi mumkin emas",
        });

      const table = await tableModel.create(req.body);

      return res.status(200).json({ status: "success", data: table });
    } catch (error) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  },
);

// Branch admin (filial admin paneli) uchun — stol/kabina yaratish.
// authMiddleware (user token); restoranMiddleware YO'Q. branch/restaurantId token'dan yoki body'dan.
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const branch = req.body.branch || String(req.userData.branch);
    const restaurantId = req.body.restaurantId || req.userData.restaurantId;
    const { title, number, type } = req.body;
    if (!number) return res.status(400).json({ status: "error", message: "Номер обязателен" });
    const findBranch = await branchesModel.findById(branch);
    if (!findBranch) return res.status(404).json({ status: "error", message: "Filial topilmadi" });
    const dup = await tableModel.findOne({ branch, number });
    if (dup) return res.status(400).json({ status: "error", message: "Стол/кабина с таким номером уже есть" });
    const table = await tableModel.create({
      title: title || `Стол ${number}`,
      number,
      type: type || "normal",
      branch,
      restaurantId,
    });
    return res.status(200).json({ status: "success", data: table });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/tables/:branchId", authMiddleware, async (req, res) => {
  try {
    const { branchId } = req.params;

    const findBranch = await branchesModel.findById(branchId);

    if (!findBranch)
      return res
        .status(400)
        .json({ status: "error", message: "bunday filial topilmadi" });

    const tables = await tableModel
      .find({ branch: branchId })
      .populate("branch");

    return res.status(200).json({ status: "success", data: tables });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const table = await tableModel.findById(id).populate("branch");
    if (!table)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday stol topilmadi" });

    return res.status(200).json({ status: "success", data: table });
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

    const table = await tableModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!table)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday stol topilmadi" });

    return res.status(200).json({ status: "success", data: table });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const table = await tableModel.findByIdAndDelete(id);
    if (!table)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday stol topilmadi" });

    return res
      .status(200)
      .json({ status: "success", message: "Stol o'chirildi" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
