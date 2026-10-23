# Imagepro Screenprint website

Node 20 / Express / SQLite. Quote form, lead dashboard at `/admin`, cookieless traffic stats.

## Run locally
```
npm install
ADMIN_PASSWORD=choose-something-long npm start
```
Open http://localhost:3000 and http://localhost:3000/admin

## Deploy on Render (same as MPS207)
1. Upload this folder to a GitHub repo (web upload is fine; node_modules and .env are ignored).
2. Render: New > Web Service > connect the repo. Build: `npm install`. Start: `npm start`.
3. Add a Disk (1 GB) mounted at `/var/data`, then set `DB_PATH=/var/data/imagepro.sqlite` so leads survive deploys.
4. Environment variables (see `.env.example`):
   - `ADMIN_PASSWORD` (8+ characters; the dashboard login stays disabled until set)
   - `SESSION_SECRET` (any long random string)
   - `SITE_URL` (the live domain, e.g. https://imageproscreenprint.com)
   - `NOTIFY_EMAIL` (where quote alerts go; default imageprospd@gmail.com)
   - `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASS` (Gmail app password)
5. Point the client's own domain at the service.

## Notes
- Without SMTP settings the form still saves leads to the dashboard; emails are skipped.
- `/admin` is password-only; every request can be status-tracked, noted and deleted.
- Traffic stats count visitors, calls, texts and quote clicks with no cookies.

## Online store (trial)
- **Order hats online:** `/order`. A 4-step hat builder (decoration, hats, logo, checkout) with live quantity-break pricing. Prices and hat styles live in `lib/catalog.js`. **The prices there are samples**: replace them with Imagepro's real price list before launch.
- **Deals:** `/deals` and `/deals/<name>`. Each deal has its own share link with its own photo and title on Facebook and Instagram. Imagepro adds, edits, hides and deletes deals from the dashboard (Deals tab).
- **Orders** land in the dashboard (Orders tab) with the customer's logo file. To finish an order: upload a mockup (the customer gets an approval link) → the customer approves → Start printing → Mark ready (the customer gets an email) → Mark picked up.
- **Print sheet** tab: totals by style, color and size for every paid, approved or printing order.
- **Payments:** with no `STRIPE_SECRET_KEY` the store runs in **demo mode** (fake checkout, no card charged). Add Imagepro's Stripe secret key to switch to real Stripe Checkout. Run a live test order before announcing it.
- **Uploads** (logos, mockups, deal photos) are saved to `UPLOAD_DIR`. On Render, set `UPLOAD_DIR=/var/data/uploads` so they live on the persistent disk.
- **Sales tax:** set `TAX_RATE` (for example `0.055`) to add a tax line at checkout.
