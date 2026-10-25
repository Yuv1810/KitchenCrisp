import nodemailer from "nodemailer";
import { db } from "./db";
import { ApiError } from "./security";
export async function sendEmail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n======================================================`);
      console.log(`📨 [LOCAL DEV EMAIL SIMULATOR]`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${text}`);
      console.log(`======================================================\n`);
      return;
    }
    throw new ApiError(503, "Email delivery is not configured. Please contact the store.");
  }
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_PORT === "465", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 15000 });
  await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, text });
}
export async function flushEmails() {
  const jobs = await db.emailJob.findMany({ where: { sentAt: null, attempts: { lt: 10 } }, orderBy: { createdAt: "asc" }, take: 10 });
  for (const job of jobs) {
    try {
      await db.$transaction(async tx => {
        // A transaction-scoped lock prevents concurrent requests sending the same job.
        const lock = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${job.id})) AS locked`;
        if (!lock[0].locked) return;
        const fresh = await tx.emailJob.findUnique({ where: { id: job.id } });
        if (!fresh || fresh.sentAt) return;
        await sendEmail(job.to, job.subject, job.text);
        await tx.emailJob.update({ where: { id: job.id }, data: { sentAt: new Date(), attempts: { increment: 1 } } });
      }, { timeout: 25000 });
    } catch {
      await db.emailJob.update({ where: { id: job.id }, data: { attempts: { increment: 1 } } });
    }
  }
}
