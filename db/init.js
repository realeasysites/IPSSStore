const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'imagepro.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, item TEXT, quantity TEXT, method TEXT,
    deadline TEXT, contact_pref TEXT, details TEXT, source TEXT,
    status TEXT NOT NULL DEFAULT 'new', notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

  CREATE TABLE IF NOT EXISTS sa_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    visitor TEXT NOT NULL, type TEXT NOT NULL, path TEXT, source TEXT, device TEXT, label TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sa_ts ON sa_events(ts);

  -- Store settings (pricing rules the owner edits in the dashboard)
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  -- Package deals: fixed quantity, fixed price (like "100 tees for $399")
  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    style TEXT NOT NULL DEFAULT 'tee',      -- tee | longsleeve | hoodie | crewneck | youth | premium | hat | beanie (placeholder art + filter)
    group_name TEXT NOT NULL DEFAULT 'T-Shirts',
    garment TEXT,                           -- the blank, e.g. "Gildan Softstyle 64000"
    blurb TEXT,
    includes TEXT,                          -- e.g. "1 ink color, 1 print location (front or back)"
    sell_mode TEXT NOT NULL DEFAULT 'pack', -- pack = sizes must add up to pack_qty; each = any quantity, price each
    pack_qty INTEGER NOT NULL DEFAULT 50,
    price_cents INTEGER NOT NULL,
    colors TEXT, sizes TEXT, plus_sizes TEXT, plus_cents INTEGER NOT NULL DEFAULT 0,
    locations TEXT NOT NULL DEFAULT 'Front,Back',
    badge TEXT,
    needs_logo INTEGER NOT NULL DEFAULT 1,
    photo TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    ends_at TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    is_sample INTEGER NOT NULL DEFAULT 0
  );

  -- Custom order catalog (build-your-own): every blank the shop prints on
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,                 -- tees | longsleeve | hoodies | crewnecks | youth | hats
    style TEXT NOT NULL DEFAULT 'tee',
    garment TEXT,
    blurb TEXT,
    kind TEXT NOT NULL DEFAULT 'apparel',   -- apparel (screen print) | hat (embroidery / patch)
    colors TEXT, sizes TEXT, plus_sizes TEXT, plus_cents INTEGER NOT NULL DEFAULT 0,
    min_qty INTEGER NOT NULL DEFAULT 24,
    breaks TEXT NOT NULL,                   -- JSON [[min qty, cents per piece], ...]
    photo TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    is_sample INTEGER NOT NULL DEFAULT 0
  );

  -- Shopping cart (server side so each item can carry its own logo file)
  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    cart TEXT NOT NULL,
    kind TEXT NOT NULL,                     -- package | custom
    ref_id INTEGER NOT NULL,
    config TEXT NOT NULL,                   -- JSON
    notes TEXT,
    artwork_file TEXT, artwork_name TEXT, no_logo INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_cart ON cart_items(cart);

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    token TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'awaiting_payment',
    needs_mockup INTEGER NOT NULL DEFAULT 1,
    payment_mode TEXT NOT NULL,
    stripe_session TEXT, paid_at TEXT,
    name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL,
    fulfillment TEXT NOT NULL DEFAULT 'pickup', address TEXT, need_by TEXT, notes TEXT,
    items_json TEXT NOT NULL,               -- JSON array of priced items (each with its own logo file)
    mockups TEXT NOT NULL DEFAULT '[]',     -- JSON array of proof files
    mockup_sent_at TEXT, approved_at TEXT, change_note TEXT,
    subtotal_cents INTEGER NOT NULL, tax_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL,
    admin_notes TEXT, source TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
`);

/* ---------- starter content (clearly labeled samples, no photos yet) ---------- */
const SEED = process.env.SEED_SAMPLES !== 'false';

if (SEED && db.prepare('SELECT COUNT(*) n FROM packages').get().n === 0) {
  const ins = db.prepare(`INSERT INTO packages (slug,title,style,group_name,garment,blurb,includes,sell_mode,pack_qty,price_cents,colors,sizes,plus_sizes,plus_cents,locations,badge,needs_logo,sort,is_sample)
    VALUES (@slug,@title,@style,@group_name,@garment,@blurb,@includes,'pack',@pack_qty,@price_cents,@colors,@sizes,@plus_sizes,@plus_cents,'Front,Back',@badge,1,@sort,1)`);
  const INC = '1 ink color, 1 print location (front or back), free proof before we print';
  [
    { slug: 't-shirt-package-100', title: 'T-Shirt Package', style: 'tee', group_name: 'T-Shirts', garment: 'Classic soft cotton tee', blurb: 'Our go-to crew tee. Great for staff shirts, events and giveaways.', pack_qty: 100, price_cents: 39900, colors: 'White,Black,Charcoal,Sport Grey,Navy,Royal,Red,Forest Green', sizes: 'S,M,L,XL,2XL,3XL', plus_sizes: '2XL,3XL', plus_cents: 200, badge: 'Best value', sort: 50 },
    { slug: 'long-sleeve-package-50', title: 'Long Sleeve Package', style: 'longsleeve', group_name: 'Long Sleeve', garment: 'Heavy cotton long sleeve tee', blurb: 'Long sleeves for cool mornings on the job and fall events.', pack_qty: 50, price_cents: 44900, colors: 'White,Black,Charcoal,Sport Grey,Navy,Red', sizes: 'S,M,L,XL,2XL,3XL', plus_sizes: '2XL,3XL', plus_cents: 200, badge: '', sort: 40 },
    { slug: 'sweatshirt-package-50', title: 'Hoodie Package', style: 'hoodie', group_name: 'Sweatshirts', garment: 'Heavy blend pullover hoodie', blurb: 'The crew favorite once the weather turns. Warm, durable, and your logo front and center.', pack_qty: 50, price_cents: 74900, colors: 'Black,Charcoal,Sport Grey,Navy,Maroon,Forest Green', sizes: 'S,M,L,XL,2XL,3XL', plus_sizes: '2XL,3XL', plus_cents: 300, badge: 'Crew favorite', sort: 30 },
    { slug: 'youth-package-50', title: 'Youth T-Shirt Package', style: 'youth', group_name: 'Youth', garment: 'Youth heavy cotton tee', blurb: 'Kid sizes for teams, schools, camps and fundraisers.', pack_qty: 50, price_cents: 29900, colors: 'White,Black,Sport Grey,Navy,Royal,Red', sizes: 'YXS,YS,YM,YL,YXL', plus_sizes: '', plus_cents: 0, badge: 'Kid sizes', sort: 20 },
    { slug: 'premium-tee-package-50', title: 'Premium Tee Package', style: 'premium', group_name: 'Premium', garment: 'Heavyweight garment-dyed tee', blurb: 'A thicker, softer, retail-quality tee for merch people actually want to wear.', pack_qty: 50, price_cents: 54900, colors: 'White,Black,Pepper,Granite,Blue Jean,Moss', sizes: 'S,M,L,XL,2XL,3XL', plus_sizes: '2XL,3XL', plus_cents: 250, badge: 'Premium', sort: 10 },
  ].forEach((p) => ins.run({ ...p, includes: INC }));
}

if (SEED && db.prepare('SELECT COUNT(*) n FROM products').get().n === 0) {
  const ins = db.prepare(`INSERT INTO products (slug,name,category,style,garment,blurb,kind,colors,sizes,plus_sizes,plus_cents,min_qty,breaks,sort,is_sample)
    VALUES (@slug,@name,@category,@style,@garment,@blurb,@kind,@colors,@sizes,@plus_sizes,@plus_cents,@min_qty,@breaks,@sort,1)`);
  const ADULT = 'S,M,L,XL,2XL,3XL';
  const YOUTH = 'YXS,YS,YM,YL,YXL';
  const B = (a) => JSON.stringify(a);
  [
    { slug: 'classic-tee', name: 'Classic Tee', category: 'tees', style: 'tee', garment: 'Soft cotton short sleeve tee', blurb: 'The everyday crew shirt.', kind: 'apparel', colors: 'White,Black,Charcoal,Sport Grey,Navy,Royal,Red,Forest Green,Safety Green,Safety Orange', sizes: ADULT, plus_sizes: '2XL,3XL', plus_cents: 200, min_qty: 24, breaks: B([[24, 1000], [48, 850], [72, 750], [144, 650], [288, 575]]), sort: 100 },
    { slug: 'premium-tee', name: 'Premium Tee', category: 'tees', style: 'premium', garment: 'Heavyweight garment-dyed tee', blurb: 'Thicker, softer, retail feel.', kind: 'apparel', colors: 'White,Black,Pepper,Granite,Blue Jean,Moss', sizes: ADULT, plus_sizes: '2XL,3XL', plus_cents: 250, min_qty: 24, breaks: B([[24, 1500], [48, 1325], [72, 1200], [144, 1100], [288, 1000]]), sort: 95 },
    { slug: 'long-sleeve-tee', name: 'Long Sleeve Tee', category: 'longsleeve', style: 'longsleeve', garment: 'Heavy cotton long sleeve', blurb: 'Cool mornings, long days.', kind: 'apparel', colors: 'White,Black,Charcoal,Sport Grey,Navy,Red,Safety Green', sizes: ADULT, plus_sizes: '2XL,3XL', plus_cents: 200, min_qty: 24, breaks: B([[24, 1350], [48, 1175], [72, 1075], [144, 975], [288, 900]]), sort: 90 },
    { slug: 'pullover-hoodie', name: 'Pullover Hoodie', category: 'hoodies', style: 'hoodie', garment: 'Heavy blend pullover hoodie', blurb: 'Warm, tough, crew favorite.', kind: 'apparel', colors: 'Black,Charcoal,Sport Grey,Navy,Maroon,Forest Green,Safety Green', sizes: ADULT, plus_sizes: '2XL,3XL', plus_cents: 300, min_qty: 24, breaks: B([[24, 2400], [48, 2150], [72, 1975], [144, 1850], [288, 1700]]), sort: 85 },
    { slug: 'full-zip-hoodie', name: 'Full-Zip Hoodie', category: 'hoodies', style: 'hoodie', garment: 'Heavy blend full-zip hoodie', blurb: 'Zip-up comfort, left chest or back print.', kind: 'apparel', colors: 'Black,Charcoal,Sport Grey,Navy', sizes: ADULT, plus_sizes: '2XL,3XL', plus_cents: 300, min_qty: 24, breaks: B([[24, 3100], [48, 2850], [72, 2650], [144, 2500], [288, 2350]]), sort: 80 },
    { slug: 'crewneck-sweatshirt', name: 'Crewneck Sweatshirt', category: 'crewnecks', style: 'crewneck', garment: 'Heavy blend crewneck', blurb: 'Clean, classic, no hood.', kind: 'apparel', colors: 'Black,Charcoal,Sport Grey,Navy,Maroon,Forest Green', sizes: ADULT, plus_sizes: '2XL,3XL', plus_cents: 300, min_qty: 24, breaks: B([[24, 2000], [48, 1800], [72, 1650], [144, 1550], [288, 1450]]), sort: 75 },
    { slug: 'youth-tee', name: 'Youth Tee', category: 'youth', style: 'youth', garment: 'Youth heavy cotton tee', blurb: 'Kid sizes for teams and schools.', kind: 'apparel', colors: 'White,Black,Sport Grey,Navy,Royal,Red', sizes: YOUTH, plus_sizes: '', plus_cents: 0, min_qty: 24, breaks: B([[24, 900], [48, 775], [72, 700], [144, 625], [288, 550]]), sort: 70 },
    { slug: 'youth-hoodie', name: 'Youth Hoodie', category: 'youth', style: 'hoodie', garment: 'Youth heavy blend hoodie', blurb: 'Team hoodies for the little ones.', kind: 'apparel', colors: 'Black,Sport Grey,Navy,Royal,Red', sizes: YOUTH, plus_sizes: '', plus_cents: 0, min_qty: 24, breaks: B([[24, 2100], [48, 1900], [72, 1750], [144, 1650], [288, 1550]]), sort: 65 },
    { slug: 'trucker-cap', name: 'Trucker Cap', category: 'hats', style: 'hat', garment: 'Mesh back snapback', blurb: 'The classic crew hat.', kind: 'hat', colors: 'Black,Charcoal / Black,Grey / Black,Navy,Loden', sizes: 'One size', plus_sizes: '', plus_cents: 0, min_qty: 12, breaks: B([[12, 2200], [24, 1900], [48, 1700], [72, 1600], [144, 1400]]), sort: 60 },
    { slug: 'flat-bill-snapback', name: 'Flat Bill Snapback', category: 'hats', style: 'hat', garment: '7-panel flat bill', blurb: 'Flat bill, structured front.', kind: 'hat', colors: 'Black,Charcoal,Camo,Grey / Black', sizes: 'One size', plus_sizes: '', plus_cents: 0, min_qty: 12, breaks: B([[12, 2400], [24, 2100], [48, 1900], [72, 1800], [144, 1600]]), sort: 55 },
    { slug: 'performance-cap', name: 'Performance Cap', category: 'hats', style: 'hat', garment: 'Structured, curved bill', blurb: 'Lightweight and sharp.', kind: 'hat', colors: 'Black,Royal Blue,Grey,White', sizes: 'One size', plus_sizes: '', plus_cents: 0, min_qty: 12, breaks: B([[12, 2400], [24, 2100], [48, 1900], [72, 1800], [144, 1600]]), sort: 50 },
    { slug: 'cuffed-beanie', name: 'Cuffed Beanie', category: 'hats', style: 'beanie', garment: 'Knit cuffed beanie', blurb: 'Winter on the job site.', kind: 'hat', colors: 'Black,Charcoal,Navy,Safety Orange', sizes: 'One size', plus_sizes: '', plus_cents: 0, min_qty: 12, breaks: B([[12, 1900], [24, 1600], [48, 1400], [72, 1300], [144, 1100]]), sort: 45 },
  ].forEach((p) => ins.run(p));
}

// Remove abandoned cart items after 14 days (their logo files are cleaned up by the store module)
db.exec(`DELETE FROM cart_items WHERE created_at < datetime('now','-14 days')`);

module.exports = db;
