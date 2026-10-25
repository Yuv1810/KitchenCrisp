import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomInt } from "node:crypto";
import { Prisma, OtpPurpose } from "@prisma/client";
import { z } from "zod";
import { db, databaseConfigured } from "@/lib/db";
import { sampleProducts, orderTotals, money, productCategories } from "@/lib/products";
import { ApiError, adminEmails, ADMIN_EMAIL, adminFixedPassword, createSession, currentUser, hashToken, passwordHash, passwordMatches, rateLimit, requireUser } from "@/lib/security";
import { flushEmails, sendEmail } from "@/lib/email";
export const runtime = "nodejs";
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(8, "Use at least 8 characters for your password.").max(128);
const productSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().min(10).max(2000), price: z.number().int().min(100).max(10000000), image: z.string().max(2000000).refine(x => /^https:\/\//.test(x) || /^\/images\//.test(x) || /^data:image\/(png|jpeg|webp);base64,/.test(x), "Use an HTTPS image URL or a JPG, PNG or WebP upload."), category: z.enum(productCategories), productType: z.enum(["PREMIX", "READY_TO_EAT"]).default("PREMIX"), weight: z.string().min(1).max(40), badge: z.string().max(40).nullable(), active: z.boolean().optional() });
async function issueOtp(email: string, purpose: OtpPurpose) {
  const otp = String(randomInt(100000, 1000000));
  await db.otp.upsert({ where: { email_purpose: { email, purpose } }, create: { email, purpose, codeHash: hashToken(`${email}:${purpose}:${otp}`), expiresAt: new Date(Date.now() + 10 * 60000) }, update: { codeHash: hashToken(`${email}:${purpose}:${otp}`), attempts: 0, expiresAt: new Date(Date.now() + 10 * 60000) } });
  await sendEmail(email, "Your Kitchen Crisp verification code", `Your verification code is ${otp}. It expires in 10 minutes.\n\nKitchen Crisp`);
}
async function consumeOtp(email: string, purpose: OtpPurpose, code: string, newPassword?: string) {
  const result = await db.$transaction(async tx => {
    const otp = await tx.otp.findUnique({ where: { email_purpose: { email, purpose } } });
    if (!otp || otp.expiresAt < new Date() || otp.attempts >= 5) return false;
    const claim = await tx.otp.updateMany({ where: { id: otp.id, attempts: otp.attempts }, data: { attempts: { increment: 1 } } });
    if (!claim.count || otp.codeHash !== hashToken(`${email}:${purpose}:${code}`)) return false;
    await tx.otp.delete({ where: { id: otp.id } });
    const user = await tx.user.update({ where: { email }, data: { verified: true, ...(newPassword ? { passwordHash: newPassword } : {}) } });
    if (purpose === "RESET") await tx.session.deleteMany({ where: { userId: user.id } });
    return user;
  });
  if (!result) throw new ApiError(400, "Invalid or expired code. Request a new code and try again.");
  return result;
}
async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path.join("/");
    const isGet = req.method === "GET";
    if (!isGet) {
      const origin = req.headers.get("origin");
      const expected = new URL(process.env.APP_URL || req.url).origin;
      if (origin !== expected) throw new ApiError(403, "Request origin is not allowed.");
    }
    if (path === "products" && isGet) {
      if (!databaseConfigured()) return NextResponse.json({ products: sampleProducts, preview: true });
      const products = await db.product.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
      return NextResponse.json({ products, preview: products.length > 0 && products.every(p => sampleProducts.some(s => s.id === p.id)) });
    }
    if (path === "auth/me" && isGet && !databaseConfigured()) return NextResponse.json({ user: null, preview: true });
    if (!databaseConfigured()) throw new ApiError(503, "This is a catalogue preview. Connect PostgreSQL and email delivery to enable accounts and orders.");
    if (path === "auth/me" && isGet) return NextResponse.json({ user: await currentUser() });
    if (path === "auth/logout" && req.method === "POST") {
      const jar = await cookies(); const token = jar.get("kk_session")?.value;
      if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
      jar.delete("kk_session"); return NextResponse.json({ ok: true });
    }
    const body = isGet ? {} : await req.json();
    if (path === "auth/request" && req.method === "POST") {
      const data = z.object({ email: emailSchema, password: z.string().max(128).optional(), name: z.string().trim().min(2).max(80).optional(), mode: z.enum(["signup", "login", "reset"]) }).parse(body);
      await rateLimit(`auth:${data.email}`);
      // Configure the trusted reverse proxy to overwrite x-forwarded-for in production.
      await rateLimit(`ip:${req.headers.get("x-forwarded-for")?.split(",")[0] || "local"}`, 30);
      let user = await db.user.findUnique({ where: { email: data.email } });
      if (data.mode === "signup") {
        if (adminEmails().includes(data.email)) {
          throw new ApiError(400, "Admin accounts cannot be registered via public signup. Please sign in directly.");
        }
        const password = passwordSchema.parse(data.password);
        const name = data.name?.trim() || data.email.split("@")[0];
        if (user?.verified) throw new ApiError(400, "An account already exists. Please sign in or reset your password.");
        const hash = await passwordHash(password);
        user = await db.user.upsert({ where: { email: data.email }, create: { email: data.email, name, passwordHash: hash, role: "USER" }, update: { name, passwordHash: hash } });
        await issueOtp(data.email, "SIGNUP");
      } else if (data.mode === "login") {
        if (adminEmails().includes(data.email)) {
          const fixedPass = adminFixedPassword();
          const matches = data.password === fixedPass || (user && await passwordMatches(data.password || "", user.passwordHash));
          if (!matches) throw new ApiError(400, "Incorrect admin password.");
          if (!user) {
            const hash = await passwordHash(fixedPass);
            user = await db.user.create({
              data: { email: data.email, name: "Kitchen Crisp Admin", passwordHash: hash, role: "ADMIN", verified: true }
            });
          } else if (user.role !== "ADMIN" || !user.verified) {
            user = await db.user.update({ where: { id: user.id }, data: { role: "ADMIN", verified: true } });
          }
          await createSession(user.id);
          return NextResponse.json({
            ok: true,
            directLogin: true,
            user: { id: user.id, name: user.name, email: user.email, role: "ADMIN" }
          });
        }
        if (!user || !await passwordMatches(data.password || "", user.passwordHash)) throw new ApiError(400, "Email or password is incorrect.");
        await issueOtp(data.email, "LOGIN");
      } else if (user?.verified) await issueOtp(data.email, "RESET");
      return NextResponse.json({ ok: true, message: "If your email is eligible, a verification code has been sent." });
    }
    if (path === "auth/verify" && req.method === "POST") {
      const data = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/), mode: z.enum(["signup", "login", "reset"]), password: passwordSchema.optional() }).parse(body);
      await rateLimit(`verify:${data.email}`, 15);
      if (data.mode === "reset" && !data.password) throw new ApiError(400, "Enter your new password.");
      const user = await consumeOtp(data.email, data.mode === "signup" ? "SIGNUP" : data.mode === "login" ? "LOGIN" : "RESET", data.code, data.password && data.mode === "reset" ? await passwordHash(data.password) : undefined);
      await createSession(user.id);
      return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: adminEmails().includes(user.email) ? "ADMIN" : "USER" } });
    }
    const user = await requireUser(path.startsWith("admin/"));
    if (path === "cart" && isGet) return NextResponse.json({ items: await db.cartItem.findMany({ where: { userId: user.id }, include: { product: true } }) });
    if (path === "cart" && req.method === "POST") {
      const data = z.object({ productId: z.string(), quantity: z.number().int().min(0).max(20) }).parse(body);
      await rateLimit(`cart:${user.id}`, 100);
      await db.$transaction(async tx => {
        if (!data.quantity) { await tx.cartItem.deleteMany({ where: { userId: user.id, productId: data.productId } }); return; }
        const product = await tx.product.findUnique({ where: { id: data.productId } });
        if (!product || !product.active) throw new ApiError(400, "This product is no longer available.");
        const existing = await tx.cartItem.findUnique({ where: { userId_productId: { userId: user.id, productId: data.productId } } });
        const notify = !existing?.notifiedAt || existing.notifiedAt.getTime() < Date.now() - 86400000;
        await tx.cartItem.upsert({ where: { userId_productId: { userId: user.id, productId: data.productId } }, create: { userId: user.id, productId: data.productId, quantity: data.quantity, notifiedAt: new Date() }, update: { quantity: data.quantity, ...(notify ? { notifiedAt: new Date() } : {}) } });
        if (notify) for (const to of adminEmails()) await tx.emailJob.create({ data: { to, subject: "Kitchen Crisp • Cart activity", text: `${user.name} (${user.email}) added ${product.name} to their cart. Quantity: ${data.quantity}. This is cart activity, not an order.` } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await flushEmails(); return NextResponse.json({ ok: true });
    }
    if (path === "orders" && isGet) return NextResponse.json({ orders: await db.order.findMany({ where: { userId: user.id }, include: { items: true }, orderBy: { createdAt: "desc" } }) });
    if (path === "orders" && req.method === "POST") {
      const data = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid Indian mobile number."), address: z.string().trim().min(8).max(500), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), pincode: z.string().regex(/^[1-9]\d{5}$/, "Enter a valid six-digit PIN code."), notes: z.string().max(500).optional(), idempotencyKey: z.string().uuid(), expectedTotal: z.number().int().positive() }).parse(body);
      const previous = await db.order.findUnique({ where: { idempotencyKey: data.idempotencyKey }, include: { items: true } });
      if (previous) { if (previous.userId !== user.id) throw new ApiError(409, "Please retry checkout."); return NextResponse.json({ order: previous }); }
      const order = await db.$transaction(async tx => {
        const cart = await tx.cartItem.findMany({ where: { userId: user.id }, include: { product: true } });
        if (!cart.length || cart.some(x => !x.product.active)) throw new ApiError(400, "Your cart is empty or contains an unavailable product.");
        const items = cart.map(x => ({ productId: x.productId, productName: x.product.name, productImage: x.product.image, unitPrice: x.product.price, quantity: x.quantity }));
        const totals = orderTotals(items);
        if (totals.total !== data.expectedTotal) throw new ApiError(409, "Prices have changed. Refresh your cart and review the total before ordering.");
        const { expectedTotal: _, ...address } = data;
        const order = await tx.order.create({ data: { ...address, userId: user.id, total: totals.total, shipping: totals.shipping, items: { create: items } }, include: { items: true } });
        await tx.cartItem.deleteMany({ where: { userId: user.id } });
        const text = `Order ${order.id}\n${items.map(x => `${x.productName} x ${x.quantity}: ${money(x.unitPrice * x.quantity)}`).join("\n")}\nDelivery: ${totals.shipping > 0 ? money(totals.shipping) : "Flexible"}\nTotal: ${money(totals.total)}\nPayment: Cash on delivery\n\n${data.name}\n${data.phone}\n${data.address}, ${data.city}, ${data.state} ${data.pincode}\n${data.notes || ""}`;
        await tx.emailJob.create({ data: { to: user.email, subject: "Your Kitchen Crisp order is received", text: `Thank you! We will contact you by email to confirm delivery.\n\n${text}` } });
        for (const to of adminEmails()) await tx.emailJob.create({ data: { to, subject: "New Kitchen Crisp COD order", text: `Contact customer at ${user.email} to confirm delivery.\n\n${text}` } });
        return order;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await flushEmails(); return NextResponse.json({ order });
    }
    if (path === "admin/products" && isGet) return NextResponse.json({ products: await db.product.findMany({ orderBy: { createdAt: "desc" } }) });
    if (path === "admin/products" && req.method === "POST") return NextResponse.json({ product: await db.product.create({ data: productSchema.parse(body) }) });
    if (path.startsWith("admin/products/") && req.method === "PATCH") return NextResponse.json({ product: await db.product.update({ where: { id: path.split("/")[2] }, data: productSchema.parse(body) }) });
    if (path === "admin/orders" && isGet) return NextResponse.json({ orders: await db.order.findMany({ include: { items: true, user: { select: { email: true } } }, orderBy: { createdAt: "desc" } }) });
    if (path.startsWith("admin/orders/") && req.method === "PATCH") {
      const { status } = z.object({ status: z.enum(["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]) }).parse(body);
      const order = await db.order.update({ where: { id: path.split("/")[2] }, data: { status }, include: { user: true } });
      await db.emailJob.create({ data: { to: order.user.email, subject: "Kitchen Crisp order update", text: `Your order ${order.id} is now ${status.toLowerCase()}. Contact us by replying to this email with any questions.` } });
      await flushEmails(); return NextResponse.json({ ok: true });
    }
    if (path === "admin/emails" && isGet) return NextResponse.json({ pending: await db.emailJob.count({ where: { sentAt: null } }) });
    if (path === "admin/emails" && req.method === "POST") { await db.emailJob.updateMany({ where: { sentAt: null }, data: { attempts: 0 } }); await flushEmails(); return NextResponse.json({ ok: true }); }
    throw new ApiError(404, "Not found.");
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) return NextResponse.json({ error: "Another update happened at the same time. Please retry." }, { status: 409 });
    console.error("Kitchen Crisp request failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "The store is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
export { handle as GET, handle as POST, handle as PATCH };
