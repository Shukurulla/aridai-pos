// POS test ma'lumotlari — menyu, stol, service, discount (Owner Test Restoran / Markaziy filial)
// Ishga tushirish: node scripts/seed-pos-test.js
import mongoose from "mongoose";
import config from "../config/index.js";
import restaurantsModel from "../models/restaurants.model.js";
import branchesModel from "../models/branches.model.js";
import categoryModel from "../models/category.model.js";
import foodModel from "../models/food.model.js";
import tableModel from "../models/table.model.js";
import serviceModel from "../models/service.model.js";
import discountModel from "../models/discount.model.js";

async function ensure(Model, filter, data) {
  const found = await Model.findOne(filter);
  if (found) return found;
  return Model.create({ ...filter, ...data });
}

async function run() {
  await mongoose.connect(config.mongoUrl);
  const rest = await restaurantsModel.findOne({ brand: "Owner Test Restoran" });
  if (!rest) throw new Error("Owner Test Restoran topilmadi — avval restoran yarating");
  const branch = await branchesModel.findOne({ name: "Markaziy filial", restaurant: rest._id });
  if (!branch) throw new Error("Markaziy filial topilmadi");

  const ctx = { branch: branch._id, restaurantId: rest._id };

  const catMain = await ensure(categoryModel, { title: "Issiq taomlar", branch: branch._id }, { ...ctx, sortOrder: 1 });
  const catDrink = await ensure(categoryModel, { title: "Ichimliklar", branch: branch._id }, { ...ctx, sortOrder: 2 });

  await ensure(foodModel, { name: "Osh", branch: branch._id }, { ...ctx, price: 35000, category: catMain._id, sortOrder: 1 });
  await ensure(foodModel, { name: "Manti", branch: branch._id }, { ...ctx, price: 28000, category: catMain._id, sortOrder: 2 });
  await ensure(foodModel, { name: "Lag'mon", branch: branch._id }, { ...ctx, price: 32000, category: catMain._id, sortOrder: 3 });
  await ensure(foodModel, { name: "Choy", branch: branch._id }, { ...ctx, price: 5000, category: catDrink._id, sortOrder: 1 });
  await ensure(foodModel, { name: "Coca-Cola", branch: branch._id }, { ...ctx, price: 12000, category: catDrink._id, sortOrder: 2 });

  for (let i = 1; i <= 6; i++) {
    await ensure(tableModel, { number: i, branch: branch._id }, { ...ctx, title: `Stol ${i}` });
  }

  await ensure(serviceModel, { branch: branch._id, servicePercent: 10 }, { ...ctx, applyTo: ["dineIn"] });
  await ensure(discountModel, { branch: branch._id, title: "Doimiy mijoz 10%" }, { ...ctx, discountPercent: 10, type: "percent" });
  await ensure(discountModel, { branch: branch._id, title: "Aksiya 5000" }, { ...ctx, type: "amount", amount: 5000 });

  const counts = {
    categories: await categoryModel.countDocuments({ branch: branch._id }),
    foods: await foodModel.countDocuments({ branch: branch._id }),
    tables: await tableModel.countDocuments({ branch: branch._id }),
    services: await serviceModel.countDocuments({ branch: branch._id }),
    discounts: await discountModel.countDocuments({ branch: branch._id }),
  };
  console.log("Seed tayyor (Markaziy filial):", JSON.stringify(counts));
  console.log("branchId:", String(branch._id));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error("Seed xato:", e.message);
  process.exit(1);
});
