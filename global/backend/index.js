import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import config from "./config/index.js";
import { setIo } from "./utils/socket.js";
import { mongoSanitize } from "./middlewares/sanitize.middleware.js";
import { apiLimiter, loginLimiter } from "./middlewares/rate-limit.middleware.js";

import branchRouter from "./routes/branch.routes.js";
import categoryRouter from "./routes/category.routes.js";
import discountRouter from "./routes/discount.routes.js";
import financeRouter from "./routes/finance.routes.js";
import foodRouter from "./routes/food.routes.js";
import orderRouter from "./routes/order.routes.js";
import ownerRouter from "./routes/owner.routes.js";
import posRouter from "./routes/pos.routes.js";
import skladRouter from "./routes/sklad.routes.js";
import keshbekRouter from "./routes/keshbek.routes.js";
import syncRouter from "./routes/sync.routes.js";
import restaurantRouter from "./routes/restoraurants.routes.js";
import systemRouter from "./routes/system.routes.js";
import serviceRouter from "./routes/service.routes.js";
import shiftRouter from "./routes/shift.routes.js";
import tableRouter from "./routes/table.routes.js";
import userRouter from "./routes/user.routes.js";

const app = express();

app.set("trust proxy", 1); // nginx orqasida — req.ip to'g'ri bo'lishi uchun
app.use(cors());
app.use(express.json());
app.use(mongoSanitize); // NoSQL injection oldini olish

app.use("/uploads", express.static(config.uploadsDir));

// ===== Health =====
app.get("/", (req, res) =>
  res.status(200).json({ status: "success", message: "API ishlayapti" }),
);
app.get("/api/health", (req, res) =>
  res.status(200).json({
    status: "ok",
    service: "aridai-pos-backend",
    env: config.env,
    uptime: process.uptime(),
  }),
);

// ===== Rate limiting =====
// Login — brute force oldini olish (5/15min)
app.use("/api/system/login", loginLimiter);
app.use("/api/restaurants/login", loginLimiter);
app.use("/api/users/login", loginLimiter);
// Umumiy API limiti
app.use("/api", apiLimiter);

// ===== Routes =====
app.use("/api/system", systemRouter);
app.use("/api/restaurants", restaurantRouter);
app.use("/api/branches", branchRouter);
app.use("/api/users", userRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/foods", foodRouter);
app.use("/api/tables", tableRouter);
app.use("/api/discounts", discountRouter);
app.use("/api/services", serviceRouter);
app.use("/api/shifts", shiftRouter);
app.use("/api/orders", orderRouter);
app.use("/api/finance", financeRouter); // Расходы/Авансы READ (sync'dan kelgan data — hisobotlar)
app.use("/api/owner", ownerRouter); // owner mobil — filiallar + tushum statistikasi
app.use("/api/pos", posRouter); // POS / waiter terminali (MVP)
app.use("/api/sync", syncRouter); // lokal backend ↔ global sync (branchToken)
app.use("/api/sklad", skladRouter); // SKLAD (inventory) — requireFeature("sklad"), toggle o'chiq → 404
app.use("/api/keshbek", keshbekRouter); // KESHBEK — public bot + branch proxy + admin (requireFeature)

// ===== 404 + error handler =====
app.use((req, res) => res.status(404).json({ status: "error", code: "NOT_FOUND" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("UNHANDLED", err);
  res.status(500).json({ status: "error", message: err.message });
});

const startServer = async () => {
  try {
    await mongoose.connect(config.mongoUrl);
    console.log("MongoDB ulandi");
    // Real-time: HTTP server + socket.io (mobil klientlar jonli yangilanish)
    const httpServer = createServer(app);
    const io = new SocketServer(httpServer, { cors: { origin: "*" } });
    setIo(io);
    httpServer.listen(config.port, () => {
      console.log(`Server ${config.port} portda ishlayapti (${config.env}) — socket.io yoqilgan`);
    });
  } catch (error) {
    console.error("Server ishga tushmadi:", error.message);
    process.exit(1);
  }
};

startServer();
