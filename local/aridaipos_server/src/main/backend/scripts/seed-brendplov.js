// BrendPlov filialiga boshlang'ich test ma'lumotlari (waiter, stol, kategoriya, taom).
// GLOBAL bazaga (aridai_pos) yoziladi — keyin local'ga sync (provisioning) keltiradi.
// Ishga tushirish: node backend/scripts/seed-brendplov.js
import mongoose from "mongoose";
import restaurantsModel from "../models/restaurants.model.js";
import branchesModel from "../models/branches.model.js";
import categoryModel from "../models/category.model.js";
import foodModel from "../models/food.model.js";
import tableModel from "../models/table.model.js";
import serviceModel from "../models/service.model.js";
import usersModel from "../models/users.model.js";
import { hashPassword } from "../utils/password.js";

async function ensure(Model, filter, data) {
  const found = await Model.findOne(filter);
  if (found) return found;
  return Model.create({ ...filter, ...data });
}

async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/aridai_pos");

  const rest = await restaurantsModel.findOne({ brand: /brendplov/i });
  if (!rest) throw new Error("BrendPlov restorani topilmadi");
  const branch = await branchesModel.findOne({ name: /brendplov/i, restaurant: rest._id });
  if (!branch) throw new Error("BrendPlov filiali topilmadi");

  console.log("Restoran:", rest.brand, "| valyuta:", rest.currency, "| Filial:", branch.name);
  const ctx = { branch: branch._id, restaurantId: rest._id };

  // ===== Kategoriyalar =====
  const catHot = await ensure(categoryModel, { title: "Горячие блюда", branch: branch._id }, { ...ctx, sortOrder: 1 });
  const catSalad = await ensure(categoryModel, { title: "Салаты", branch: branch._id }, { ...ctx, sortOrder: 2 });
  const catDrink = await ensure(categoryModel, { title: "Напитки", branch: branch._id }, { ...ctx, sortOrder: 3 });

  // ===== Taomlar (KZT narxlar) =====
  const foods = [
    ["Плов", 1800, catHot, 1],
    ["Лагман", 1600, catHot, 2],
    ["Манты (5 шт)", 1400, catHot, 3],
    ["Шашлык", 2000, catHot, 4],
    ["Самса", 600, catHot, 5],
    ["Ачичук", 700, catSalad, 1],
    ["Цезарь", 1500, catSalad, 2],
    ["Чай", 300, catDrink, 1],
    ["Кофе", 700, catDrink, 2],
    ["Coca-Cola 0.5", 600, catDrink, 3],
  ];
  for (const [name, price, cat, sort] of foods) {
    await ensure(foodModel, { name, branch: branch._id }, { ...ctx, price, category: cat._id, sortOrder: sort });
  }

  // ===== Stollar (1-8) =====
  for (let i = 1; i <= 8; i++) {
    await ensure(tableModel, { number: i, branch: branch._id }, { ...ctx, title: `Стол ${i}` });
  }

  // ===== Xizmat haqi (service) =====
  await ensure(serviceModel, { branch: branch._id, servicePercent: 10 }, { ...ctx, applyTo: ["dineIn"] });

  // ===== Ofitsiantlar (waiter) =====
  const waiters = [
    ["Нодира Каримова", "+77001112233"],
    ["Дилшод Рахимов", "+77001112244"],
  ];
  for (const [name, phone] of waiters) {
    const exists = await usersModel.findOne({ phone });
    if (!exists) {
      await usersModel.create({
        name, phone, branch: branch._id, restaurantId: rest._id,
        role: "waiter", password: await hashPassword("123456"),
      });
    }
  }

  const counts = {
    categories: await categoryModel.countDocuments({ branch: branch._id }),
    foods: await foodModel.countDocuments({ branch: branch._id }),
    tables: await tableModel.countDocuments({ branch: branch._id }),
    waiters: await usersModel.countDocuments({ branch: branch._id, role: "waiter" }),
    services: await serviceModel.countDocuments({ branch: branch._id }),
  };
  console.log("Tayyor:", JSON.stringify(counts));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error("Xato:", e.message);
  process.exit(1);
});
