const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'imagepro.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    item TEXT,
    quantity TEXT,
    method TEXT,
    deadline TEXT,
    contact_pref TEXT,
    details TEXT,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

  CREATE TABLE IF NOT EXISTS sa_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    visitor TEXT NOT NULL,
    type TEXT NOT NULL,
    path TEXT,
    source TEXT,
    device TEXT,
    label TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sa_ts ON sa_events(ts);

  -- Online store: deals with shareable links
  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    blurb TEXT,
    price_cents INTEGER NOT NULL,
    unit_label TEXT NOT NULL DEFAULT 'each',
    sizes TEXT,
    colors TEXT,
    photo TEXT,
    needs_logo INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    ends_at TEXT,
    is_sample INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0
  );

  -- Online store: orders (custom hat builder + deals)
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    token TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,               -- 'custom' | 'deal'
    deal_id INTEGER,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'awaiting_payment',
    needs_mockup INTEGER NOT NULL DEFAULT 1,
    payment_mode TEXT NOT NULL,       -- 'demo' | 'stripe'
    stripe_session TEXT,
    paid_at TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    fulfillment TEXT NOT NULL DEFAULT 'pickup',
    address TEXT,
    need_by TEXT,
    decoration TEXT,
    extras TEXT,
    placement TEXT,
    items_json TEXT NOT NULL,
    notes TEXT,
    artwork_file TEXT,
    artwork_name TEXT,
    mockup_file TEXT,
    mockup_sent_at TEXT,
    approved_at TEXT,
    change_note TEXT,
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    admin_notes TEXT,
    source TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
`);

// Two clearly labeled sample deals so the trial has something to click.
const SEED = process.env.SEED_SAMPLE_DEALS !== 'false';
if (SEED && db.prepare('SELECT COUNT(*) n FROM deals').get().n === 0) {
  const ins = db.prepare(
    `INSERT INTO deals (slug, title, blurb, price_cents, unit_label, sizes, colors, photo, needs_logo, active, is_sample, sort)
     VALUES (@slug,@title,@blurb,@price_cents,@unit_label,@sizes,@colors,@photo,@needs_logo,1,1,@sort)`
  );
  ins.run({
    slug: 'imagepro-patch-cap',
    title: 'Imagepro Patch Cap',
    blurb: 'Our own custom patch on a royal blue performance cap with a flag on the side. Ready to grab.',
    price_cents: 2800,
    unit_label: 'each',
    sizes: 'One size',
    colors: 'Royal blue',
    photo: '/img/work/imagepro-patch-cap.jpg',
    needs_logo: 0,
    sort: 1,
  });
  ins.run({
    slug: 'crew-starter-pack',
    title: 'Crew Starter Pack: 12 tees + 12 hats',
    blurb: 'Outfit the whole crew in one shot. 12 tees with a one-color front print and 12 hats with your logo embroidered. Upload your logo and we send a mockup to approve before anything is made.',
    price_cents: 49900,
    unit_label: 'per pack',
    sizes: '',
    colors: 'Black,Charcoal,Navy',
    photo: '',
    needs_logo: 1,
    sort: 2,
  });
}

module.exports = db;
