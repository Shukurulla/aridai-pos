// Global real-time (socket.io) — mobil klientlar (waiter/cook/cashier/admin) jonli yangilanish.
// Klient handshake'da JWT token yuboradi → tekshiriladi (socket.data.user). `join` qilganda
// FAQAT o'z restorani/filialiga kira oladi (multi-tenant eavesdropping oldini olish — ilgari
// har kim istalgan branch:<id> xonasiga kirib, o'sha filialning order/summalarini eshitardi).
// (Local server orders-since PULL bilan alohida ishlaydi — bu mobil klientlar uchun.)
import { verifyToken } from "./token.js";
import branchesModel from "../models/branches.model.js";

let _io = null;

export function setIo(io) {
  _io = io;

  // Handshake auth — token bo'lsa tekshiramiz (auth.token | query.token | Authorization header).
  // Ulanishni RAD ETMAYMIZ (eski klient ham ulansin), lekin join token talab qiladi.
  io.use((socket, next) => {
    try {
      const h = socket.handshake || {};
      const token =
        h.auth?.token ||
        h.query?.token ||
        String(h.headers?.authorization || "").replace(/^Bearer\s+/i, "");
      if (token) socket.data.user = verifyToken(token);
    } catch {
      /* yaroqsiz token — anonim (join bloklanadi) */
    }
    next();
  });

  io.on("connection", (socket) => {
    socket.on("join", async (data) => {
      const branchId = data?.branchId;
      if (!branchId) return;
      const user = socket.data.user;
      if (!user) return; // token yo'q/yaroqsiz → boshqa filialni eshita olmaydi
      if (await canJoinBranch(user, branchId)) {
        socket.join(`branch:${String(branchId)}`);
      }
    });
    socket.on("leave", (data) => {
      const branchId = data?.branchId;
      if (branchId) socket.leave(`branch:${String(branchId)}`);
    });
  });
}

// Klient shu filialga ulanishi mumkinmi: xodim → faqat o'z filiali; owner/system → shu restoran.
async function canJoinBranch(user, branchId) {
  if (user.branchId) return String(user.branchId) === String(branchId);
  if (user.restaurantId) {
    try {
      const b = await branchesModel.findById(branchId).select("restaurant");
      return !!b && String(b.restaurant) === String(user.restaurantId);
    } catch {
      return false;
    }
  }
  return false;
}

// Filial xonasiga event yuborish (order create/update/pay/cancel/cooking)
export function emitToBranch(branchId, event, data = {}) {
  if (_io && branchId) {
    _io.to(`branch:${String(branchId)}`).emit(event, data);
  }
}

export function getIo() {
  return _io;
}
