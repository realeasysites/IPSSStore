// Online store: hat builder, deals, checkout, order tracking + mockup approval.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db/init');
const { CATALOG, quote } = require('../lib/catalog');
const { upload, handle, filePath, remove } = require('../lib/uploads');
const stripe = require('../lib/stripe');
const O = require('../lib/orders');
const pages = require('../lib/pages');
const { isAuthed } = require('../lib/auth');

const router = express.Router();

const hits = new Map();
function limited(ip, max = 10) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const parseJSON = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
const noStore = (res) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow'); };

function customer(b) {
  const c = {
    name: clean(b.name, 120),
    phone: clean(b.phone, 40),
    email: clean(b.email, 160),
    fulfillment: b.fulfillment === 'delivery' ? 'delivery' : 'pickup',
    address: clean(b.address, 300),
    need_by: clean(b.need_by, 80),
    notes: clean(b.notes, 3000),
    source: clean(b.source, 200),
  };
  if (!c.name) return { error: 'Add your name.' };
  if (c.phone.replace(/\D/g, '').length < 7) return { error: 'Add a phone number we can reach you at.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) return { error: 'Add an email address so we can send your mockup and updates.' };
  if (c.fulfillment === 'delivery' && !c.address) return { error: 'Add a delivery address, or choose pickup.' };
  return c;
}

async function startPayment(order) {
  if (stripe.enabled()) {
    const s = await stripe.createSession({ order, siteUrl: O.site() });
    db.prepare('UPDATE orders SET stripe_session = ? WHERE id = ?').run(s.id, order.id);
    return s.url;
  }
  return '/checkout/demo/' + order.token;
}

function insertOrder(o) {
  const token = crypto.randomBytes(18).toString('hex');
  const info = db
    .prepare(
      `INSERT INTO orders (token, kind, deal_id, title, needs_mockup, payment_mode, name, phone, email, fulfillment, address, need_by,
        decoration, extras, placement, items_json, notes, artwork_file, artwork_name, subtotal_cents, tax_cents, total_cents, source)
       VALUES (@token,@kind,@deal_id,@title,@needs_mockup,@payment_mode,@name,@phone,@email,@fulfillment,@address,@need_by,
        @decoration,@extras,@placement,@items_json,@notes,@artwork_file,@artwork_name,@subtotal_cents,@tax_cents,@total_cents,@source)`
    )
    .run({ ...o, token, payment_mode: stripe.enabled() ? 'stripe' : 'demo' });
  return O.getById(info.lastInsertRowid);
}

function artworkFields(req, b, required) {
  if (req.file) return { artwork_file: req.file.filename, artwork_name: clean(req.file.originalname, 160) };
  if (required && b.no_logo !== '1') return { error: 'Upload your logo, or check "I don\'t have a logo file yet".' };
  return { artwork_file: null, artwork_name: null };
}

/* ---------- pages ---------- */
router.get('/order', (req, res) => res.type('html').send(pages.orderBuilderPage()));

function liveDeals() {
  return db
    .prepare(`SELECT * FROM deals WHERE active = 1 AND (ends_at IS NULL OR ends_at = '' OR ends_at >= date('now','localtime')) ORDER BY sort, id DESC`)
    .all();
}
router.get('/deals', (req, res) => res.type('html').send(pages.dealsPage(liveDeals())));
router.get('/deals/:slug', (req, res, next) => {
  const d = db.prepare('SELECT * FROM deals WHERE slug = ?').get(String(req.params.slug));
  const live = d && liveDeals().some((x) => x.id === d.id);
  if (!d || (!live && !isAuthed(req))) return next();
  res.type('html').send(pages.dealPage(d));
});

router.get('/checkout/demo/:token', (req, res, next) => {
  const o = O.getByToken(req.params.token);
  if (!o || stripe.enabled()) return next();
  noStore(res);
  if (o.status !== 'awaiting_payment') return res.redirect('/o/' + o.token);
  res.type('html').send(pages.demoCheckoutPage(o));
});

router.get('/o/:token', async (req, res, next) => {
  let o = O.getByToken(req.params.token);
  if (!o) return next();
  noStore(res);
  let flash = '';
  if (o.status === 'awaiting_payment' && req.query.session_id && stripe.enabled()) {
    try {
      const s = await stripe.getSession(String(req.query.session_id));
      if (s.payment_status === 'paid' && s.client_reference_id === o.token) {
        o = O.markPaid(o);
        flash = 'Payment received. Thank you!';
      }
    } catch (e) {
      console.error('stripe verify failed:', e.message);
    }
  }
  if (req.query.paid === '1' && o.status !== 'awaiting_payment') flash = 'Payment received. Thank you! A confirmation email is on its way.';
  if (req.query.canceled === '1') flash = 'Checkout was canceled. Your order is saved, so you can finish paying any time.';
  res.type('html').send(pages.statusPage(o, flash));
});

router.get('/o/:token/mockup', (req, res, next) => {
  const o = O.getByToken(req.params.token);
  const p = o && filePath('mockups', o.mockup_file);
  if (!p || !fs.existsSync(p)) return next();
  noStore(res);
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  res.sendFile(p);
});

/* ---------- API ---------- */
router.get('/api/catalog', (req, res) => {
  res.json({ ...CATALOG, taxRate: Math.max(0, Number(process.env.TAX_RATE || 0)), payment: stripe.enabled() ? 'stripe' : 'demo' });
});

router.post('/api/orders/custom', handle(upload.artwork.single('artwork')), async (req, res) => {
  const b = req.body || {};
  const fail = (status, error) => { if (req.file) remove('artwork', req.file.filename); res.status(status).json({ ok: false, error }); };
  if (b.company) return fail(200, 'ok');
  if (limited(req.ip)) return fail(429, 'Too many orders from this connection. Please call the shop.');
  const q = quote({ decoration: b.decoration, items: parseJSON(b.items, []), extras: parseJSON(b.extras, []) });
  if (q.error) return fail(400, q.error);
  if (!q.totalQty) return fail(400, 'Add at least one hat.');
  if (q.belowMinimum) return fail(400, `The minimum is ${q.minimum} hats total. Mix and match styles and colors to get there.`);
  const c = customer(b);
  if (c.error) return fail(400, c.error);
  const art = artworkFields(req, b, true);
  if (art.error) return fail(400, art.error);
  const placement = CATALOG.placements.includes(b.placement) ? b.placement : CATALOG.placements[0];
  const order = insertOrder({
    ...c,
    ...art,
    kind: 'custom',
    deal_id: null,
    title: `${q.totalQty} custom hats, ${q.decorationName.toLowerCase()}`,
    needs_mockup: 1,
    decoration: q.decorationName,
    extras: q.extras.join(', ') || null,
    placement,
    items_json: JSON.stringify(q.lines),
    notes: (b.no_logo === '1' && !req.file ? '[No logo file yet] ' : '') + c.notes,
    subtotal_cents: q.subtotal,
    tax_cents: q.tax,
    total_cents: q.total,
  });
  try {
    res.json({ ok: true, redirect: await startPayment(order) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ ok: false, error: 'Checkout is having trouble. Your order was saved. Please call the shop.' });
  }
});

router.post('/api/orders/deal', handle(upload.artwork.single('artwork')), async (req, res) => {
  const b = req.body || {};
  const fail = (status, error) => { if (req.file) remove('artwork', req.file.filename); res.status(status).json({ ok: false, error }); };
  if (b.company) return fail(200, 'ok');
  if (limited(req.ip)) return fail(429, 'Too many orders from this connection. Please call the shop.');
  const d = liveDeals().find((x) => x.id === Number(b.deal_id));
  if (!d) return fail(400, 'This deal has ended.');
  const sizes = pages.list(d.sizes);
  const colors = pages.list(d.colors);
  const color = colors.length ? (colors.includes(b.color) ? b.color : null) : '';
  if (color === null) return fail(400, 'Pick a color.');
  const lines = [];
  let qty = 0;
  for (const it of parseJSON(b.items, [])) {
    const n = Math.floor(Number(it.qty));
    const size = String(it.size || '');
    if (!(n > 0) || (sizes.length && !sizes.includes(size)) || (!sizes.length && size)) continue;
    lines.push({ label: d.title, color: color || undefined, size: size || undefined, qty: n, unit: d.price_cents, line: n * d.price_cents });
    qty += n;
  }
  if (!qty) return fail(400, 'Add a quantity.');
  if (qty > 500) return fail(400, 'For big orders, please call the shop.');
  const c = customer(b);
  if (c.error) return fail(400, c.error);
  const art = artworkFields(req, b, !!d.needs_logo);
  if (art.error) return fail(400, art.error);
  const subtotal = lines.reduce((s, l) => s + l.line, 0);
  const tax = Math.round(subtotal * Math.max(0, Number(process.env.TAX_RATE || 0)));
  const order = insertOrder({
    ...c,
    ...art,
    kind: 'deal',
    deal_id: d.id,
    title: d.title + (qty > 1 ? ` × ${qty}` : ''),
    needs_mockup: d.needs_logo ? 1 : 0,
    decoration: null,
    extras: null,
    placement: null,
    items_json: JSON.stringify(lines),
    notes: (d.needs_logo && b.no_logo === '1' && !req.file ? '[No logo file yet] ' : '') + c.notes,
    subtotal_cents: subtotal,
    tax_cents: tax,
    total_cents: subtotal + tax,
  });
  try {
    res.json({ ok: true, redirect: await startPayment(order) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ ok: false, error: 'Checkout is having trouble. Your order was saved. Please call the shop.' });
  }
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
  try {
    res.json({ ok: true, redirect: await startPayment(o) });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'Checkout is having trouble. Please call the shop.' });
  }
});

router.post('/api/orders/:token/approve', (req, res) => {
  const o = O.getByToken(req.params.token);
  if (!o || o.status !== 'mockup_sent') return res.status(400).json({ ok: false, error: 'This mockup can’t be approved right now.' });
  db.prepare(`UPDATE orders SET status='approved', approved_at=datetime('now') WHERE id=?`).run(o.id);
  O.emailOwner(`Mockup approved: ${O.ref(o)} (${o.name})`, `${o.name} approved the mockup for ${o.title}. It's ready to print.\n\n${O.site()}/admin`);
  res.json({ ok: true });
});

router.post('/api/orders/:token/changes', (req, res) => {
  const o = O.getByToken(req.params.token);
  const note = clean((req.body || {}).note, 2000);
  if (!o || o.status !== 'mockup_sent') return res.status(400).json({ ok: false, error: 'Changes can’t be sent right now.' });
  if (!note) return res.status(400).json({ ok: false, error: 'Tell us what to change.' });
  db.prepare(`UPDATE orders SET status='changes_requested', change_note=? WHERE id=?`).run(note, o.id);
  O.emailOwner(`Changes requested: ${O.ref(o)} (${o.name})`, `${o.name} asked for changes on ${o.title}:\n\n"${note}"\n\nReply to them or upload a new mockup: ${O.site()}/admin`);
  res.json({ ok: true });
});

module.exports = router;
