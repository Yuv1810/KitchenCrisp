# Simple 3-Step Deployment Guide for Google Cloud

Deploying **Kitchen Crisp** takes just **3 simple steps**:

---

### Step 1: Get a Free Cloud Database (1 Minute)
Since your local Docker PostgreSQL won't be accessible on the internet, you need a free cloud PostgreSQL database:
1. Go to **[Neon.tech](https://neon.tech)** (or **[Supabase](https://supabase.com)**) and sign up for free.
2. Click **Create Project**.
3. Copy the database connection string:
   ```
   postgresql://user:password@ep-xyz.region.neon.tech/neondb?sslmode=require
   ```
4. In your terminal, run this once to create all tables:
   ```bash
   DATABASE_URL="YOUR_COPIED_URL" npx prisma db push
   DATABASE_URL="YOUR_COPIED_URL" npx tsx prisma/seed.ts
   ```

---

### Step 2: Deploy to Google Cloud (1 Command)
Make sure you have Google Cloud SDK installed (`brew install --cask google-cloud-sdk`).

Then just run:
```bash
./deploy-gcp.sh
```
*(Or run `gcloud run deploy kitchen-crisp --source .`)*

Google Cloud will automatically build your app and give you a live HTTPS URL like:
👉 `https://kitchen-crisp-xxxx.a.run.app`

---

### Step 3: Add Your Environment Variables
1. Open **[Google Cloud Console > Cloud Run](https://console.cloud.google.com/run)**.
2. Click on **kitchen-crisp** → Click **Edit & Deploy New Revision**.
3. Scroll to the **Variables & Secrets** tab and add the same values from your `.env`:
   - `DATABASE_URL`: *(Your Neon/Supabase database URL from Step 1)*
   - `APP_URL`: *(Your live Cloud Run URL from Step 2)*
   - `AUTH_SECRET`: `kitchencrisp_super_secret_session_token_key_2026_dev_seed`
   - `ADMIN_EMAILS`: `engyuvrajsingh@gmail.com`
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: `engyuvrajsingh@gmail.com`
   - `SMTP_PASS`: `iimpwhbuwekoktoe`
   - `EMAIL_FROM`: `Kitchen Crisp <engyuvrajsingh@gmail.com>`
4. Click **Deploy**.

**You are done! Your store is live.**
