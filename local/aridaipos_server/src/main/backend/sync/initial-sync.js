// Boshlang'ich sync — standalone test (node backend/sync/initial-sync.js)
// Local backend birinchi ishga tushganda global'dan filial mirror'ini oladi.
import mongoose from "mongoose";
import config from "../config/index.js";
import { bootstrapSync } from "./sync-client.js";

async function run() {
  await mongoose.connect(config.mongoUrl);
  console.log("Local Mongo ulandi:", config.mongoUrl);
  console.log("Global'dan sync:", config.globalUrl);
  const result = await bootstrapSync();
  console.log("✅ Boshlang'ich sync tayyor:", JSON.stringify(result.counts));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error("❌ Sync xato:", e.message);
  process.exit(1);
});
