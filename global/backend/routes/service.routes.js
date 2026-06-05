import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { tenantGuard, tenantResource } from "../middlewares/tenant.middleware.js";
import branchesModel from "../models/branches.model.js";
import serviceModel from "../models/service.model.js";

const router = express.Router();

router.post("/create", authMiddleware, tenantGuard, async (req, res) => {
  try {
    const { branch, servicePercent } = req.body;

    const findBranch = await branchesModel.findById(branch);
    if (!findBranch)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday filial topilmadi" });

    const service = await serviceModel.create({ branch, servicePercent });

    return res.status(200).json({ status: "success", data: service });
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
        .status(404)
        .json({ status: "error", message: "Bunday filial topilmadi" });

    const services = await serviceModel
      .find({ branch: branchId })
      .populate("branch");

    return res.status(200).json({ status: "success", data: services });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const service = await serviceModel.findById(id).populate("branch");
    if (!service)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday service topilmadi" });

    return res.status(200).json({ status: "success", data: service });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.put("/:id", authMiddleware, tenantResource(serviceModel), async (req, res) => {
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

    const service = await serviceModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!service)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday service topilmadi" });

    return res.status(200).json({ status: "success", data: service });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.delete("/:id", authMiddleware, tenantResource(serviceModel), async (req, res) => {
  try {
    const { id } = req.params;

    const service = await serviceModel.findByIdAndDelete(id);
    if (!service)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday service topilmadi" });

    return res
      .status(200)
      .json({ status: "success", message: "Service o'chirildi" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
