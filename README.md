# Imagepro Screenprint website + online store

Node 20 / Express / SQLite. Nike-style storefront on the Imagepro brand:
- **Home** (`/`): hero, package deals, shop by category, custom order, team stores, real work gallery, reviews, quote form.
- **Package deals** (`/packages`, `/packages/<name>`): fixed-price packs (e.g. 100 tees). Customer picks a color, splits sizes to add up to the pack size, picks front or back, uploads a logo, adds to bag. Every package has its own share link with its own preview.
- **Custom order** (`/custom`, `/custom/<item>`): every blank (tees, long sleeve, hoodies, crewnecks, youth, hats). Customer picks color, sizes and quantities, print locations and ink colors (or embroidery / patch for hats), uploads a logo and sees the price live with quantity breaks.
- **Bag + checkout** (`/bag`): several items in one order, each with its own logo. Pickup or local delivery.
- **Order page** (`/o/<code>`): status tracker and proof approval ("Looks good, print it" or "Something needs to change").
- **Team & crew stores** (`/team-stores`, `/team/<store>`): a store per team, league, school or company. One link, everyone picks their size (one size per line), adds a name and number if the store allows it, and pays for their own gear. Optional fundraiser (an amount per item back to the team, with a live total and goal bar), optional store code for private crew stores, team color and logo on the store banner. Stores close on their own at the end of the closing date. Team orders check out on their own (they can't be mixed with regular orders in one bag) and need no proof, since the shop sets the design. "Start a store" form on `/team-stores` lands in Quote requests.
- **Quote form** for anything else (hi-vis, digital print, logo design, promo).

## Dashboard (`/admin`, password only)
- **Orders:** every item with its logo (preview + download), upload proof & send (customer gets an approval link), then one-button Start printing → Mark ready → Mark picked up. Customers get emails at each step. Delete any order.
- **Print sheet:** totals by item, color and size across paid / approved / printing orders. Print it. (Team store orders print from their own store sheet.)
- **Team stores:** create, edit, duplicate (as a draft), open / close, delete stores. Add gear from the custom catalog (fills in colors, sizes, plus sizes) and set the store price, design picture, design note and name/number option. Live orders / pieces / sales / raised per store. **Print sheet & packing list** per store: print run by item, color and size, a names-and-numbers table for the press, and a checklist packing list by person. CSV download. When a store closes, you (NOTIFY_EMAIL) and the organizer get a summary email.
- **Package deals:** add, edit, duplicate, hide, delete packages. Copy a package link to post on Facebook.
- **Custom catalog:** add, edit, hide, delete items, with price breaks by quantity, colors, sizes, plus-size charges, minimums, photos.
- **Pricing rules:** extra ink color and extra location charges, print locations, hat decorations and add-ons.
- **Quote requests** and **Traffic** (visitors, call/text taps, sources).

All starter packages, catalog items and the two team stores (Hawks Youth Soccer and the private Example Co. Crew Store, code `crew2026`) are **samples with placeholder prices and no photos**. Replace them with the real price list and photos from the dashboard.

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
