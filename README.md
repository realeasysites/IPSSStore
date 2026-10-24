# Imagepro Screenprint website + online store

Node 20 / Express / SQLite. Nike-style storefront on the Imagepro brand:
- **Home** (`/`): hero, package deals, shop by category, custom order, team stores, real work gallery, reviews, quote form.
- **Package deals** (`/packages`, `/packages/<name>`): fixed-price packs (e.g. 100 tees). Customer picks a color, splits sizes to add up to the pack size, picks front or back, uploads a logo, adds to bag. Every package has its own share link with its own preview.
- **Custom order** (`/custom`, `/custom/<item>`): every blank (tees, long sleeve, hoodies, crewnecks, youth, hats). Customer picks color, sizes and quantities, print locations and ink colors (or embroidery / patch for hats), uploads a logo and sees the price live with quantity breaks.
- **Bag + checkout** (`/bag`): several items in one order, each with its own logo. Pickup or local delivery.
- **Order page** (`/o/<code>`): status tracker and proof approval ("Looks good, print it" or "Something needs to change").
- **Quote form** for anything else (hi-vis, digital print, logo design, promo, team stores).

## Dashboard (`/admin`, password only)
- **Orders:** every item with its logo (preview + download), upload proof & send (customer gets an approval link), then one-button Start printing → Mark ready → Mark picked up. Customers get emails at each step. Delete any order.
- **Print sheet:** totals by item, color and size across paid / approved / printing orders. Print it.
- **Package deals:** add, edit, duplicate, hide, delete packages. Copy a package link to post on Facebook.
- **Custom catalog:** add, edit, hide, delete items, with price breaks by quantity, colors, sizes, plus-size charges, minimums, photos.
- **Pricing rules:** extra ink color and extra location charges, print locations, hat decorations and add-ons.
- **Quote requests** and **Traffic** (visitors, call/text taps, sources).

All starter packages and catalog items are **samples with placeholder prices and no photos**. Replace them with the real price list and photos from the dashboard.

## Run locally
```
npm install
ADMIN_PASSWORD=choose-something-long npm start
```

## Deploy on Render
1. Upload this folder to a GitHub repo (node_modules, the database and .env are ignored).
2. Render > New > Web Service. Build `npm install`, start `npm start`.
3. Add a Disk (1 GB) at `/var/data`. Set `DB_PATH=/var/data/imagepro.sqlite` and `UPLOAD_DIR=/var/data/uploads`.
4. Set env vars from `.env.example`: ADMIN_PASSWORD, SESSION_SECRET, SITE_URL, NOTIFY_EMAIL, SMTP_*.
5. Payments: with no `STRIPE_SECRET_KEY` the store runs in **demo mode** (fake checkout). Add Imagepro's Stripe secret key to take real cards. Run one real test order before announcing it.
6. Optional: `TAX_RATE` for Maine sales tax.
