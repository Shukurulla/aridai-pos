// Global real-time (socket.io) — mobil klientlar (waiter/cook/cashier/admin) jonli yangilanish.
// Klient ulanib `join` qiladi (branchId bilan) → branch xonasiga kiradi. Order o'zgarsa
// shu xonaga event boradi → klient qayta yuklaydi. (Local server orders-since PULL bilan
// alohida ishlaydi — bu mobil klientlar uchun.)
let _io = null;

export function setIo(io) {
  _io = io;
  io.on("connection", (socket) => {
    socket.on("join", (data) => {
      const branchId = data?.branchId;
      if (branchId) socket.join(`branch:${String(branchId)}`);
    });
    socket.on("leave", (data) => {
      const branchId = data?.branchId;
      if (branchId) socket.leave(`branch:${String(branchId)}`);
    });
  });
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
