# Kitchen Crisp

A responsive food and premix store built with Next.js App Router, TypeScript, PostgreSQL, Prisma, and Nodemailer.

## Included

- Email/password signup and login, with a six-digit email OTP on **every login**, including admins. Codes expire after 10 minutes, allow five attempts, and are stored as keyed hashes.
- Password reset through email OTP; resetting a password revokes previous sessions. Passwords use salted scrypt. Session tokens are random, stored hashed, and sent through HttpOnly cookies.
- Single admin address configured through `ADMIN_EMAILS` (`kitchen5062001crisp@gmail.com`) with a fixed admin password. Public signup for admin is disabled.
- Admin product creation/editing, prices, categories, image URLs or image uploads, and hiding unavailable products. Products support both premixes and ready-to-eat food, including cookies, food platters and baked treats. Customers can filter by preparation type or category (including Breakfast and Food Platter), search and sort products.
- Guest bags saved in the browser; verified customers have database-backed carts. Guest carts merge when customers sign in. Admin cart emails are sent for saved cart activity, at most once per product per customer per day.
- Cash-on-delivery checkout with name, mobile, full address, city, state, PIN and optional delivery notes. No payment gateway.
- Checkout reads current prices on the server, rejects stale totals, and stores immutable product-name, image and unit-price snapshots in `OrderItem`. Historical orders are unaffected by later product changes. Integer paise avoid floating-point currency errors.
- Idempotency keys prevent duplicate orders on retry. Serializable transactions prevent conflicting cart/order/product updates. Users see only their own orders; admins see all orders and can update their status.
- Customer/admin order emails and status updates. A database email outbox keeps notifications if SMTP fails; admins can inspect the pending count and retry delivery.

## Start

Requires Node.js 22+ and PostgreSQL. The dependency lockfile is included.

```powershell
npm install
Copy-Item .env.example .env
# Edit .env with your database and SMTP settings.
npm run db:push
npm run db:seed
npm run dev
```

Visit [the shop](http://localhost:3000) or [admin](http://localhost:3000/admin). `db:seed` inserts sample products without overwriting existing edits. The catalogue, prices, pack sizes and stock photographs are examples; replace them with actual product information before launch. Delivery is currently ₹49 below ₹499, and free at ₹499 or above; change `orderTotals` and the displayed policy together if needed.

The current workspace has an isolated local PostgreSQL cluster in `.data/local-postgres`, on **127.0.0.1:55432**. Its development-only URL is in the ignored `.env`. To restart it after reboot:

```powershell
pg_ctl -D .data/local-postgres -l .data/postgres.log -o "-h 127.0.0.1 -p 55432" start
```

This cluster uses local trust authentication and is only bound to loopback. Use a password-protected production database for deployment. No SMTP credentials are included. Accounts and OTPs need a working email provider. Without `DATABASE_URL`, the app offers a clearly labelled sample catalogue preview and disables account/order APIs.

## Configure email and admins

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in `.env`. Port 465 uses implicit TLS; port 587 uses STARTTLS. For Gmail, use your sender's app password and a matching sender address. Never commit `.env` or credentials.

Set a random `AUTH_SECRET` of at least 32 characters and set `APP_URL` to the exact public origin. To add your second admin:

```dotenv
ADMIN_EMAILS="engyuvrajsingh@gmail.com,second-admin@example.com"
```

Admins create their accounts using the same signup flow and verify their real email. There is no default admin password or bypass. Every admin login requires its emailed OTP. Rate limits are persisted in PostgreSQL. In production, configure your trusted proxy to overwrite `x-forwarded-for`, use HTTPS, and schedule email-outbox retries if notification delivery must not depend on traffic/manual retry.

Uploaded images are stored as data URLs in PostgreSQL (JPG/PNG/WebP, maximum 1 MB); hosted HTTPS image URLs are also supported. Consider object storage for a larger catalogue.

## Verify

```powershell
npm run typecheck
npm test
npm run build
npm audit
```

The scripts use webpack because Turbopack junction creation is restricted in this Windows workspace. The production build succeeds with webpack.

`npm run test:integration` exercises real API/database flows and captures messages in an SMTP server on 127.0.0.1:1025. It requires the isolated database on port 55432, the app running with SMTP host 127.0.0.1, port 1025, user/password `local-test`, and `EMAIL_FROM="Kitchen Crisp <test@kitchen.example>"`. The test refuses a real admin account, uses disposable records and cleans up its fixtures. It sends **no real email**. Restore your normal SMTP configuration after running it.

Verified: signup/login/reset, OTP delivery and one-time use, customer/admin isolation, origin protection, product CRUD, cart emails, COD orders, duplicate checkout protection, historical price/name preservation, stale-price rejection, unavailable-product handling, and session revocation.

## Implementation map

- `src/components/shop.tsx`: storefront, account/cart/checkout dialogs and admin UI.
- `src/app/api/[...path]/route.ts`: validated, authorised API routes.
- `src/lib/security.ts`: passwords, OTP/session hashing, admin allowlist and rate limits.
- `src/lib/email.ts`: Nodemailer and persistent notification delivery.
- `src/lib/products.ts`: sample catalogue, currency formatting and delivery policy.
- `prisma/schema.prisma`: accounts, OTPs, sessions, carts, orders, item snapshots and email jobs.

The initial SQL migration is included. For a fresh production database, run `npm run db:migrate` rather than `db:push`; create and commit new migrations for later schema changes. Replace example catalogue images, publish confirmed ingredient/allergen/preparation information, and verify your delivery policy and sender details before taking customer orders.
