import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SMTPServer } from "smtp-server";
import { PrismaClient } from "@prisma/client";
// Run against the isolated seeded development database, never a production server.
const base = process.env.TEST_APP_URL || "http://localhost:3000";
const inbox: string[] = [];
const db = new PrismaClient();
let customerEmail = "";
let productId = "";
let customerId = "";
let adminId = "";
const startedAt = new Date();
const smtp = new SMTPServer({ disabledCommands: ["STARTTLS"], authOptional: true, onAuth(_auth, _session, callback) { callback(null, { user: "local-test" }); }, onData(stream, _session, callback) { let data = ""; stream.on("data", chunk => data += chunk.toString()); stream.on("end", () => { inbox.push(data); callback(); }); } });
async function request(path: string, method = "GET", data?: unknown, cookie = "") {
  const response = await fetch(`${base}/api/${path}`, { method, headers: { Origin: base, "Content-Type": "application/json", Cookie: cookie }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] || "" };
}
function lastCode() { const code = inbox.at(-1)?.match(/code is (\d{6})/); assert.ok(code, "OTP email must be delivered to local SMTP"); return code[1]; }
async function main() {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Tests only run locally");
  assert.equal(new URL(process.env.DATABASE_URL!).port, "55432", "Use the isolated development database");
  const existingAdmin = await db.user.findUnique({ where: { email: "kitchen5062001crisp@gmail.com" } });
  await new Promise<void>(resolve => smtp.listen(1025, "127.0.0.1", resolve));
  customerEmail = `test-${Date.now()}@example.com`; const password = "TestOnlyPassword123!";
  const signup = await request("auth/request", "POST", { mode: "signup", email: customerEmail, password }); assert.equal(signup.status, 200);
  const code = lastCode();
  assert.equal((await request("auth/verify", "POST", { mode: "signup", email: customerEmail, code: "000000" })).status, 400);
  const verified = await request("auth/verify", "POST", { mode: "signup", email: customerEmail, code }); assert.equal(verified.status, 200); const customer = verified.cookie; customerId = verified.data.user.id;
  assert.equal((await request("auth/verify", "POST", { mode: "signup", email: customerEmail, code })).status, 400, "OTP is single-use");
  assert.equal((await request("admin/products", "GET", undefined, customer)).status, 403, "Customer cannot access admin");
  assert.equal((await request("orders", "POST", {}, "")).status, 401, "Checkout requires authentication");
  const wrongOrigin = await fetch(`${base}/api/cart`, { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json", Cookie: customer }, body: JSON.stringify({ productId: "ragi-dosa", quantity: 1 }) }); assert.equal(wrongOrigin.status, 403);
  // Verify admin public signup is disallowed
  const adminSignupAttempt = await request("auth/request", "POST", { mode: "signup", email: "kitchen5062001crisp@gmail.com", password });
  assert.equal(adminSignupAttempt.status, 400, "Admin signup is disabled");
  // Admin logs in directly with fixed password
  const adminLogin = await request("auth/request", "POST", { mode: "login", email: "kitchen5062001crisp@gmail.com", password: process.env.ADMIN_PASSWORD || "KitchenCrisp@5062001" });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.data.directLogin, true);
  const adminCookie = adminLogin.cookie;
  assert.ok(adminCookie); assert.equal((await request("admin/products", "GET", undefined, adminCookie)).status, 200);
  const product = { name: "Integration Test Premix", description: "A disposable product used to verify price snapshots.", price: 18000, image: "/images/dosa.jpg", category: "Premixes", weight: "250 g", badge: null, active: true };
  const created = await request("admin/products", "POST", product, adminCookie); assert.equal(created.status, 200); const id = created.data.product.id; productId = id;
  const beforeEmails = inbox.length; assert.equal((await request("cart", "POST", { productId: id, quantity: 2 }, customer)).status, 200); assert.ok(inbox.length > beforeEmails, "Admin receives cart notification");
  const orderBody = { name: "Test Customer", phone: "9876543210", address: "Test address, 123 Test Street", city: "Delhi", state: "Delhi", pincode: "110001", idempotencyKey: randomUUID(), expectedTotal: 36000 };
  const placed = await request("orders", "POST", orderBody, customer); assert.equal(placed.status, 200); assert.equal(placed.data.order.items[0].unitPrice, 18000); assert.equal(placed.data.order.paymentMethod, "COD");
  assert.equal((await request("orders", "POST", orderBody, customer)).data.order.id, placed.data.order.id, "Checkout retries cannot create duplicate orders");
  assert.equal((await request(`admin/products/${id}`, "PATCH", { ...product, price: 25000, name: "Renamed Test Premix" }, adminCookie)).status, 200);
  const history = await request("orders", "GET", undefined, customer); assert.equal(history.data.orders[0].items[0].unitPrice, 18000); assert.equal(history.data.orders[0].items[0].productName, product.name); assert.equal(history.data.orders[0].total, 36000);
  await request("cart", "POST", { productId: id, quantity: 1 }, customer);
  assert.equal((await request("orders", "POST", { ...orderBody, idempotencyKey: randomUUID(), expectedTotal: 18000 }, customer)).status, 409, "Checkout rejects a stale price");
  await request(`admin/products/${id}`, "PATCH", { ...product, price: 25000, active: false }, adminCookie);
  assert.equal((await request("orders", "POST", { ...orderBody, idempotencyKey: randomUUID(), expectedTotal: 25000 }, customer)).status, 400, "Unavailable products cannot be ordered");
  assert.equal((await request("cart", "POST", { productId: id, quantity: 0 }, customer)).status, 200, "Unavailable products can still be removed from the cart");
  assert.equal((await request("auth/request", "POST", { mode: "reset", email: customerEmail })).status, 200);
  const reset = await request("auth/verify", "POST", { mode: "reset", email: customerEmail, code: lastCode(), password: "NewTestPassword456!" }); assert.equal(reset.status, 200);
  assert.equal((await request("auth/me", "GET", undefined, customer)).data.user, null, "Password reset revokes old sessions");
  assert.equal((await request("auth/request", "POST", { mode: "login", email: customerEmail, password })).status, 400);
  assert.equal((await request("auth/request", "POST", { mode: "login", email: customerEmail, password: "NewTestPassword456!" })).status, 200);
  assert.equal((await request("auth/verify", "POST", { mode: "login", email: customerEmail, code: lastCode() })).status, 200);
  console.log("PASS: signup, OTP delivery and reuse protection, permissions, CSRF, admin CRUD, cart notification, COD checkout, idempotency, price snapshots, stale-price rejection, unavailable products, password reset and session revocation.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  smtp.close();
  const ids = [customerId, adminId].filter(Boolean);
  if (ids.length) {
    await db.$transaction(async tx => {
      await tx.order.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
  }
  if (productId) await db.product.delete({ where: { id: productId } });
  await db.$disconnect();
});
