// Storefront: home, package deals, custom order, bag, checkout, order tracking + proof approval.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const db = require('../db/init');
const P = require('../lib/pricing');
const O = require('../lib/orders');
const pages = require('../lib/pages');
const stripe = require('../lib/stripe');
const { upload, handle, filePath, remove } = require('../lib/uploads');

const router = express.Router();
const html = (res, s, cache) => { res.setHeader('Cache-Control', cache || 'no-store'); res.type('html').send(s); };
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const parseJSON = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };

/* ---------- bag cookie ---------- */
const COOKIE = 'ip_bag';
function readCookie(req) {
  const m = /(?:^|;\s*)ip_bag=([a-f0-9]{32})/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}
function bagId(req, res, create) {
  let id = readCookie(req);
  if (!id && create) {
    id = crypto.randomBytes(16).toString('hex');
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}${secure ? '; Secure' : ''}`);
  }
  return id;
}
function bagItems(id) {
  if (!id) return [];
  const S = P.getSettings();
  return db.prepare('SELECT * FROM cart_items WHERE cart = ? ORDER BY id').all(id).map((it) => ({ ...it, price: P.priceCartItem(it, S) }));
}
function totalsOf(items) {
  const subtotal = items.filter((i) => !i.price.error).reduce((t, i) => t + i.price.line, 0);
  const tax = Math.round(subtotal * P.taxRate());
  return { subtotal, tax, total: subtotal + tax, count: items.length };
}

/* ---------- pages ---------- */
const livePackages = () => db.prepare(`SELECT * FROM packages WHERE active = 1 AND (ends_at IS NULL OR ends_at = '' OR ends_at >= date('now','localtime')) ORDER BY sort DESC, id`).all();
const liveProducts = () => db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort DESC, id').all();

router.get(['/', '/index.html'], (req, res) => html(res, pages.homePage(livePackages()), 'public, max-age=60'));
router.get('/packages', (req, res) => html(res, pages.packagesPage(livePackages()), 'public, max-age=60'));
router.get('/packages/:slug', (req, res, next) => {
  const p = db.prepare('SELECT * FROM packages WHERE slug = ?').get(String(req.params.slug));
  if (!p || !livePackages().some((x) => x.id === p.id)) return next();
  html(res, pages.packagePage(p), 'public, max-age=60');
});
router.get('/custom', (req, res) => html(res, pages.customPage(liveProducts()), 'public, max-age=60'));
router.get('/custom/:slug', (req, res, next) => {
  const p = db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(String(req.params.slug));
  if (!p) return next();
  html(res, pages.configurePage(p, P.getSettings()), 'public, max-age=60');
});
['/deals', '/shop', '/store'].forEach((u) => router.get(u, (req, res) => res.redirect(301, '/packages')));
router.get('/order', (req, res) => res.redirect(301, '/custom'));

router.get('/bag', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex');
  const items = bagItems(bagId(req, res, false));
  html(res, pages.bagPage(items, totalsOf(items)));
});

router.get('/sitemap.xml', (req, res) => {
  const site = O.site();
  const urls = ['/', '/packages', '/custom'].concat(livePackages().map((p) => '/packages/' + p.slug), liveProducts().map((p) => '/custom/' + p.slug));
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
});

/* ---------- bag API ---------- */
router.get('/api/bag/count', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = readCookie(req);
  res.json({ count: id ? db.prepare('SELECT COUNT(*) n FROM cart_items WHERE cart = ?').get(id).n : 0 });
});

const hits = new Map();
function limited(ip, max) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}

router.post('/api/bag', handle(upload.artwork.single('artwork')), (req, res) => {
  const b = req.body || {};
  const fail = (s, e) => { if (req.file) remove('artwork', req.file.filename); res.status(s).json({ ok: false, error: e }); };
  if (limited(req.ip, 60)) return fail(429, 'Too many requests. Please call the shop.');
  const kind = b.kind === 'package' ? 'package' : 'custom';
  const refId = Number(b.ref_id);
  const cfg = parseJSON(b.config, {});
  const price = kind === 'package'
    ? P.pricePackage(db.prepare('SELECT * FROM packages WHERE id = ?').get(refId), cfg)
    : P.priceCustom(db.prepare('SELECT * FROM products WHERE id = ?').get(refId), cfg);
  if (price.error) return fail(400, price.error);
  const noLogo = b.no_logo === '1' ? 1 : 0;
  if (price.needsLogo && !req.file && !noLogo) return fail(400, 'Upload your logo, or check "I don\'t have a logo file yet".');
  const id = bagId(req, res, true);
  if (db.prepare('SELECT COUNT(*) n FROM cart_items WHERE cart = ?').get(id).n >= 25) return fail(400, 'Your bag is full. Check out first, or call the shop for big orders.');
  db.prepare('INSERT INTO cart_items (cart, kind, ref_id, config, notes, artwork_file, artwork_name, no_logo) VALUES (?,?,?,?,?,?,?,?)').run(
    id, kind, refId, JSON.stringify(cfg), clean(b.notes, 1500), req.file ? req.file.filename : null, req.file ? clean(req.file.originalname, 160) : null, noLogo
  );
  res.json({ ok: true, count: db.prepare('SELECT COUNT(*) n FROM cart_items WHERE cart = ?').get(id).n, title: price.title });
});

router.delete('/api/bag/:id', (req, res) => {
  const id = readCookie(req);
  const it = id && db.prepare('SELECT * FROM cart_items WHERE id = ? AND cart = ?').get(Number(req.params.id), id);
  if (it) {
    remove('artwork', it.artwork_file);
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(it.id);
  }
  res.json({ ok: true });
});

/* ---------- checkout ---------- */
async function startPayment(order) {
  if (stripe.enabled()) {
    const s = await stripe.createSession({ order, siteUrl: O.site() });
    db.prepare('UPDATE orders SET stripe_session = ? WHERE id = ?').run(s.id, order.id);
    return s.url;
  }
  return '/checkout/demo/' + order.token;
}

router.post('/api/checkout', async (req, res) => {
  const b = req.body || {};
  if (b.company) return res.json({ ok: false });
  if (limited(req.ip, 10)) return res.status(429).json({ ok: false, error: 'Too many checkouts. Please call the shop.' });
  const bag = readCookie(req);
  const items = bagItems(bag);
  if (!items.length) return res.status(400).json({ ok: false, error: 'Your bag is empty.' });
  const bad = items.find((i) => i.price.error);
  if (bad) return res.status(400).json({ ok: false, error: bad.price.error + ' Remove that item and try again.' });
  const c = {
    name: clean(b.name, 120), phone: clean(b.phone, 40), email: clean(b.email, 160),
    fulfillment: b.fulfillment === 'delivery' ? 'delivery' : 'pickup', address: clean(b.address, 300), need_by: clean(b.need_by, 80), notes: clean(b.notes, 2000),
  };
  if (!c.name) return res.status(400).json({ ok: false, error: 'Add your name.' });
  if (c.phone.replace(/\D/g, '').length < 7) return res.status(400).json({ ok: false, error: 'Add a phone number.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) return res.status(400).json({ ok: false, error: 'Add your email so we can send your proof.' });
  if (c.fulfillment === 'delivery' && !c.address) return res.status(400).json({ ok: false, error: 'Add a delivery address, or choose pickup.' });

  const t = totalsOf(items);
  const lines = items.map((i) => ({ ...i.price, notes: i.notes || '', artwork_file: i.artwork_file, artwork_name: i.artwork_name, no_logo: !!i.no_logo }));
  const qty = lines.reduce((s, l) => s + l.qty, 0);
  const title = lines.length === 1 ? lines[0].title : `${lines.length} items · ${qty} pieces`;
  const token = crypto.randomBytes(18).toString('hex');
  const info = db.prepare(`INSERT INTO orders (token, title, needs_mockup, payment_mode, name, phone, email, fulfillment, address, need_by, notes, items_json, subtotal_cents, tax_cents, total_cents, source)
    VALUES (@token,@title,@needs,@mode,@name,@phone,@email,@fulfillment,@address,@need_by,@notes,@items,@sub,@tax,@total,@source)`).run({
    ...c, token, title, needs: lines.some((l) => l.needsLogo) ? 1 : 0, mode: stripe.enabled() ? 'stripe' : 'demo',
    items: JSON.stringify(lines), sub: t.subtotal, tax: t.tax, total: t.total, source: clean(b.source, 200),
  });
  db.prepare('DELETE FROM cart_items WHERE cart = ?').run(bag); // logo files now belong to the order
  const order = O.getById(info.lastInsertRowid);
  try {
    res.json({ ok: true, redirect: await startPayment(order) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ ok: false, error: 'Checkout is having trouble. Your order was saved. Please call the shop.' });
  }
});

router.get('/checkout/demo/:token', (req, res, next) => {
  const o = O.getByToken(req.params.token);
  if (!o || stripe.enabled()) return next();
  if (o.status !== 'awaiting_payment') return res.redirect('/o/' + o.token);
  res.setHeader('X-Robots-Tag', 'noindex');
  html(res, pages.demoCheckoutPage(o));
});

router.post('/api/orders/:token/demo-pay', (req, res) => {
  const o = O.getByToken(req.params.token);
  if (!o || stripe.enabled() || o.payment_mode !== 'demo') return res.status(404).json({ ok: false });
  O.markPaid(o);
  res.json({ ok: true, redirect: '/o/' + o.token + '?paid=1' });
});

router.post('/api/orders/:token/pay', async (req, res) => {
  const o = O.getByToken(req.params.token);
  if (!o || o.status !== 'awaiting_payment') return res.status(400).json({ ok: false, error: 'Nothing to pay.' });
  try { res.json({ ok: true, redirect: await startPayment(o) }); } catch (e) { res.status(502).json({ ok: false, error: 'Checkout is having trouble. Please call the shop.' }); }
});

router.get('/o/:token', async (req, res, next) => {
  let o = O.getByToken(req.params.token);
  if (!o) return next();
  res.setHeader('X-Robots-Tag', 'noindex');
  let flash = '';
  if (o.status === 'awaiting_payment' && req.query.session_id && stripe.enabled()) {
    try {
      const s = await stripe.getSession(String(req.query.session_id));
      if (s.payment_status === 'paid' && s.client_reference_id === o.token) { o = O.markPaid(o); flash = 'Payment received. Thank you!'; }
    } catch (e) { console.error('stripe verify failed:', e.message); }
  }
  if (req.query.paid === '1' && o.status !== 'awaiting_payment') flash = 'Payment received. Thank you! A confirmation email is on its way.';
  if (req.query.canceled === '1') flash = 'Checkout was canceled. Your order is saved, so you can finish paying any time.';
  html(res, pages.statusPage(o, flash));
});

router.get('/o/:token/proof/:i', (req, res, next) => {
  const o = O.getByToken(req.params.token);
  const m = o && O.mockupsOf(o)[Number(req.params.i)];
  const p = m && filePath('mockups', m.file);
  if (!p || !fs.existsSync(p)) return next();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  res.sendFile(p);
});

router.post('/api/orders/:token/approve', (req, res) => {
  const o = O.getByToken(req.params.token);
  if (!o || o.status !== 'mockup_sent') return res.status(400).json({ ok: false, error: 'This proof can’t be approved right now.' });
  db.prepare(`UPDATE orders SET status='approved', approved_at=datetime('now') WHERE id=?`).run(o.id);
  O.emailOwner(`Proof approved: ${O.ref(o)} (${o.name})`, `${o.name} approved the proof for ${O.ref(o)}. It's ready to print.\n\n${O.site()}/admin`);
  res.json({ ok: true });
});

router.post('/api/orders/:token/changes', (req, res) => {
  const o = O.getByToken(req.params.token);
  const note = clean((req.body || {}).note, 2000);
  if (!o || o.status !== 'mockup_sent') return res.status(400).json({ ok: false, error: 'Changes can’t be sent right now.' });
  if (!note) return res.status(400).json({ ok: false, error: 'Tell us what to change.' });
  db.prepare(`UPDATE orders SET status='changes_requested', change_note=? WHERE id=?`).run(note, o.id);
  O.emailOwner(`Changes requested: ${O.ref(o)} (${o.name})`, `${o.name} asked for changes on ${O.ref(o)}:\n\n"${note}"\n\nUpload a new proof: ${O.site()}/admin`);
  res.json({ ok: true });
});

/* ---------- housekeeping: delete logo files from abandoned bags (older than 14 days, not on any order) ---------- */
function cleanupArtwork() {
  try {
    const { DIRS } = require('../lib/uploads');
    const keep = new Set(db.prepare('SELECT artwork_file FROM cart_items WHERE artwork_file IS NOT NULL').all().map((r) => r.artwork_file));
    db.prepare('SELECT items_json FROM orders').all().forEach((o) => { (parseJSON(o.items_json, []) || []).forEach((i) => i.artwork_file && keep.add(i.artwork_file)); });
    const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
    fs.readdirSync(DIRS.artwork).forEach((f) => {
      if (keep.has(f)) return;
      const p = require('path').join(DIRS.artwork, f);
      if (fs.statSync(p).mtimeMs < cutoff) fs.unlink(p, () => {});
    });
  } catch (e) { console.error('cleanup failed:', e.message); }
}
setTimeout(cleanupArtwork, 60 * 1000).unref();
setInterval(cleanupArtwork, 24 * 3600 * 1000).unref();

module.exports = router;
