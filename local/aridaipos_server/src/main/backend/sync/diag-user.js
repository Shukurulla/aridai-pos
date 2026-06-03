import mongoose from "mongoose";

const phone = process.argv[2] || "+77005000831";

async function run() {
  const g = await mongoose.createConnection("mongodb://127.0.0.1:27017/aridai_pos").asPromise();
  const l = await mongoose.createConnection("mongodb://127.0.0.1:27017/aridai_local").asPromise();

  const gu = await g.collection("users").findOne({ phone });
  if (gu) {
    const br = await g.collection("branches").findOne({ _id: gu.branch });
    const rs = await g.collection("restaurants").findOne({ _id: gu.restaurantId });
    console.log("GLOBAL: bor —", gu.name, "| rol:", gu.role, "| active:", gu.isActive, "| deleted:", gu.isDeleted);
    console.log("  filial:", br?.name, "| restoran:", rs?.brand, "| branchId:", String(gu.branch));
  } else {
    console.log("GLOBAL: bu telefon YOK. O'xshashlar:");
    const v = await g.collection("users").find({ phone: { $regex: "7005000" } }).toArray();
    v.forEach((u) => console.log("   ", u.phone, "-", u.name, u.role));
  }

  const lu = await l.collection("users").findOne({ phone });
  console.log("LOCAL:", lu ? `bor - ${lu.name} (${lu.role})` : "YOK (sync qilinmagan)");

  const cfg = await l.collection("local_configs").findOne();
  console.log("LOCAL provisioning filial:", cfg?.branchName, "| branchId:", cfg?.branchId);
  const all = await l.collection("users").find({}).toArray();
  console.log("LOCAL xodimlar:");
  all.forEach((u) => console.log("   ", u.phone, "-", u.name, u.role));

  await g.close();
  await l.close();
}
run().catch((e) => { console.error(e.message); process.exit(1); });
