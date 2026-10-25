import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "./db";
const scrypt = promisify(scryptCallback);
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function hashToken(token: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503, "Authentication is not configured. Please contact the store.");
  return createHmac("sha256", secret).update(token).digest("hex");
}
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  const key = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || "kitchen5062001crisp@gmail.com").split(",")[0].trim().toLowerCase();
export function adminEmails() {
  return [ADMIN_EMAIL];
}
export function adminFixedPassword() {
  return process.env.ADMIN_PASSWORD || "KitchenCrisp@5062001";
}
export async function currentUser() {
  const token = (await cookies()).get("kk_session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.verified) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email, role: adminEmails().includes(session.user.email) ? "ADMIN" : "USER" };
}
export async function requireUser(admin = false) {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "Please sign in to continue.");
  if (admin && user.role !== "ADMIN") throw new ApiError(403, "Admin access is required.");
  return user;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  (await cookies()).set("kk_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", expires: expiresAt, path: "/" });
}
export async function rateLimit(key: string, max = 5) {
  const now = new Date();
  await db.rateLimit.deleteMany({ where: { key, expiresAt: { lt: now } } });
  const row = await db.rateLimit.upsert({ where: { key }, create: { key, expiresAt: new Date(Date.now() + 15 * 60000) }, update: { count: { increment: 1 } } });
  if (row.count > max) throw new ApiError(429, "Too many attempts. Please try again in 15 minutes.");
}
