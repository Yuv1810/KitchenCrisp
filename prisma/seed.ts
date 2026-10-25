import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { sampleProducts } from "../src/lib/products";

const scrypt = promisify(scryptCallback);
const db = new PrismaClient();

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function main() {
  // 1. Remove legacy chocolate-cake if present
  try {
    await db.orderItem.deleteMany({ where: { productId: "chocolate-cake" } });
    await db.cartItem.deleteMany({ where: { productId: "chocolate-cake" } });
    await db.product.deleteMany({ where: { id: "chocolate-cake" } });
  } catch (err) {
    console.log("Legacy product cleanup note:", err);
  }

  // 2. Seed all updated products (including Food Platter)
  for (const p of sampleProducts) {
    await db.product.upsert({
      where: { id: p.id },
      create: p,
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image,
        category: p.category,
        productType: p.productType,
        weight: p.weight,
        badge: p.badge,
        active: true,
      },
    });
  }

  // 3. Seed single admin user
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || "kitchen5062001crisp@gmail.com").split(",")[0].trim().toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || "KitchenCrisp@5062001";
  const passHash = await hashPassword(adminPass);

  await db.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "Kitchen Crisp Admin",
      role: "ADMIN",
      verified: true,
      passwordHash: passHash,
    },
    update: {
      name: "Kitchen Crisp Admin",
      role: "ADMIN",
      verified: true,
      passwordHash: passHash,
    },
  });

  // Ensure any other users are downgraded from ADMIN to USER (one admin only)
  await db.user.updateMany({
    where: { email: { not: adminEmail }, role: "ADMIN" },
    data: { role: "USER" },
  });

  console.log("Kitchen Crisp catalogue and single admin user seeded successfully!");
}

main().finally(() => db.$disconnect());
