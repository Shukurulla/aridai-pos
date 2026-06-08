import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import config from "./config/index.js";
import { mongoSanitize } from "./middlewares/sanitize.middleware.js";
import posRouter from "./routes/pos.routes.js";
import authRouter from "./routes/auth.routes.js";
import setupRouter from "./routes/setup.routes.js";
import shiftsRouter from "./routes/shifts.routes.js";
import { foodsRouter, categoriesRouter, tablesRouter, staffRouter } from "./routes/kepket.routes.js";
import ordersRouter from "./routes/orders.routes.js";
import reportsRouter from "./routes/reports.routes.js";
import restaurantRouter from "./routes/restaurant.routes.js";
import { expensesRouter, advancesRouter, expenseCategoriesRouter } from "./routes/finance.routes.js";
import printHubRouter from "./routes/print-hub.routes.js";
import localConfigModel from "./models/local_config.model.js";
import { startSyncLoop, stopSyncLoop } from "./sync/sync-client.js";

// ============================================================
// LOCAL BACKEND — filial POS PC'da ishlaydi (Electron main process ichida).
// POS renderer va LAN clientlar shu serverga ulanadi (lokal, tez).
// Global VPS bilan sync qiladi (sync/ moduli). Global bilan BIR XIL schema.
// ============================================================

let httpServer = null;
let io = null;

export async function startLocalBackend() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(mongoSanitize);

  app.get("/api/health", (req, res) =>
    res.status(200).json({
      status: "ok",
      role: config.role,
      branchId: config.branchId,
      mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      uptime: process.uptime(),
    }),
  );

  // Printer-hub (POS monitor → localhost:4561/print/*, /printers, /health — auth yo'q)
  app.use("/", printHubRouter);

  // Qurilma sozlash (provisioning — filialga biriktirish)
  app.use("/api/setup", setupRouter);
  // Lokal POS login (sync qilingan userlar, offline ham)
  app.use("/api/auth", authRouter);
  // Kepket frontend endpointlari (kepket format)
  app.use("/api/shifts", shiftsRouter);
  app.use("/api/foods", foodsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/tables", tablesRouter);
  app.use("/api/staff", staffRouter);
  app.use("/api/orders", ordersRouter);
  // Kepket hisobot (header ВЫРУЧКА) + restoran sozlamalari + kassa (Расходы/Авансы)
  app.use("/api/reports", reportsRouter);
  app.use("/api/restaurant", restaurantRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/advances", advancesRouter);
  app.use("/api/expense-categories", expenseCategoriesRouter);
  // POS / waiter API (global bilan bir xil pos.routes)
  app.use("/api/pos", posRouter);

  app.use((req, res) => res.status(404).json({ status: "error", code: "NOT_FOUND" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("LOCAL UNHANDLED:", err);
    res.status(500).json({ status: "error", message: err.message });
  });

  await mongoose.connect(config.mongoUrl);
  console.log("Local MongoDB ulandi:", config.mongoUrl);

  // Saqlangan provisioning'ni yuklash (lokal Mongo config .env'dan ustun)
  try {
    const cfg = await localConfigModel.findOne();
    if (cfg?.branchToken) {
      config.branchToken = cfg.branchToken;
      config.branchId = cfg.branchId;
      config.restaurantId = cfg.restaurantId;
      console.log("Provisioning yuklandi — filial:", cfg.branchName);
    }
  } catch {
    /* config hali yo'q — provisioning kerak */
  }

  httpServer = createServer(app);
  io = new SocketServer(httpServer, { cors: { origin: "*" } });
  io.on("connection", (socket) => {
    console.log("POS client ulandi:", socket.id);
    socket.on("disconnect", () => console.log("POS client uzildi:", socket.id));
  });

  // Davriy sync (global ↔ local). Global hali deploy qilinmagan → localhost:4560.
  // Menyu/stol/user — har 10s PULL (og'ir). Order — har 2s PUSH+PULL (yengil).
  // Menyu o'zgarsa → "menu:updated"; order (admin cancel/tahrir) o'zgarsa → "order_updated"
  //   → POS allaqachon bu eventlarni eshitadi → REAL-TIME qayta yuklaydi.
  if (config.branchToken) {
    startSyncLoop(
      10000,
      (counts) => {
        if (io) io.emit("menu:updated", counts);
      },
      (pulled) => {
        if (!io) return;
        io.emit("order_updated", pulled);
        // Waiter "Счёт" (prichek) so'ragan orderlar → POS precheck chop etadi
        for (const cr of pulled.checkRequests || []) io.emit("print_check_requested", cr);
      },
      2000,
      (pulledShifts) => {
        if (!io) return;
        // Admin smena yopsa → POS aktiv smenani tozalaydi (ShiftOpen ekraniga o'tadi)
        if ((pulledShifts.shifts || []).some((s) => s.isActive === false)) {
          io.emit("shift:closed", {});
        }
        // Umumiy refresh — POS getActiveShift'ni qayta o'qiydi (yopilish/ochilish)
        io.emit("order_updated", { shifts: pulledShifts.shifts });
      },
    );
    console.log(`Sync loop boshlandi — global: ${config.globalUrl} (menyu 10s, order+smena 2s, real-time)`);
  } else {
    console.log("Sync: branchToken yo'q (provisioning kerak) — sync o'chiq");
  }

  // listen xatosini (masalan EADDRINUSE) Promise reject orqali qaytaramiz — aks holda
  // 'error' event ushlanmasdan uncaught exception bo'lib Electron crash bo'ladi.
  await new Promise((resolve, reject) => {
    const onError = (err) => reject(err);
    httpServer.once("error", onError);
    httpServer.listen(config.port, () => {
      httpServer.removeListener("error", onError);
      resolve();
    });
  });
  console.log(`Local backend ${config.port} portda ishlayapti (${config.env})`);

  return { app, httpServer, io };
}

export function getIo() {
  return io;
}

export async function stopLocalBackend() {
  stopSyncLoop();
  if (httpServer) await new Promise((r) => httpServer.close(r));
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
}

// Standalone (node backend/server.js) — Electron'siz test uchun
if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  startLocalBackend().catch((e) => {
    console.error("Local backend ishga tushmadi:", e.message);
    process.exit(1);
  });
}
