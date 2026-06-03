// Bir martalik push — pending order/smenalarni global'ga yuboradi (test/cron uchun).
// node backend/sync/push-once.js
import mongoose from "mongoose";
import config from "../config/index.js";
import { collectPending, pushSync } from "./sync-client.js";

async function run() {
  await mongoose.connect(config.mongoUrl);
  const pending = await collectPending();
  console.log(`Pending: ${pending.orders.length} order, ${pending.shifts.length} smena`);
  if (pending.orders.length || pending.shifts.length) {
    const r = await pushSync(pending);
    console.log(`Global qabul qildi: ${JSON.stringify(r.accepted)}`);
    const after = await collectPending();
    console.log(`Push'dan keyin pending: ${after.orders.length} order, ${after.shifts.length} smena`);
  }
  await mongoose.disconnect();
}
run().catch((e) => {
  console.error("Push xato:", e.message);
  process.exit(1);
});
