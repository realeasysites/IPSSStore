const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/init');
const auth = require('../lib/auth');
const P = require('../lib/pricing');
const O = require('../lib/orders');
const { statsFor } = require('./analytics');
const { upload, handle, filePath, remove } = require('../lib/uploads');

const router = express.Router();

const fails = new Map();
function throttled(ip) {
  const now = Date.now();
  const arr = (fails.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  fails.set(ip, arr);
  return arr.length >= 8;
}

router.use((req, res, next) => {
  if (req.path.startsWith('/admin')) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow'); }
  next();
});
router.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'views', auth.isAuthed(req) ? 'admin.html' : 'login.html')));
router.get('/admin/status', (req, res) => res.json({ loginEnabled: auth.loginEnabled(), authed: auth.isAuthed(req) }));
router.post('/admin/login', express.json({ limit: '4kb' }), (req, res) => {
  if (!auth.loginEnabled()) return res.status(503).json({ ok: false, error: 'Login is not set up yet. Set ADMIN_PASSWORD (8+ characters).' });
  if (throttled(req.ip)) return res.status(429).json({ ok: false, error: 'Too many attempts. Try again in a few minutes.' });
  if (!auth.checkPassword((req.body || {}).password)) { fails.get(req.ip).push(Date.now()); return res.status(401).json({ ok: false, error: 'Wrong password.' }); }
  auth.issue(req, res);
  res.json({ ok: true });
});
router.get('/admin/logout', (req, res) => { auth.clear(res); res.redirect('/admin'); });

const api = express.Router();
api.use(auth.requireAdminApi);
const J = express.json({ limit: '64kb' });

/* ---------- quote requests ---------- */
const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
api.get('/leads', (req, res) => res.json({ statuses: LEAD_STATUSES, leads: db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 1000').all() }));
api.patch('/leads/:id', J, (req, res) => {
  const id = Number(req.params.id), b = req.body || {};
  if (!db.prepare('SELECT id FROM leads WHERE id = ?').get(id)) return res.status(404).json({ error: 'not found' });
  if (b.status !== undefined) { if (!LEAD_STATUSES.includes(b.status)) return res.status(400).json({ error: 'bad status' }); db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(b.status, id); }
  if (b.notes !== undefined) db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(String(b.notes).slice(0, 4000), id);
  res.json({ ok: true });
});
api.delete('/leads/:id', (req, res) => res.json({ ok: db.prepare('DELETE FROM leads WHERE id = ?').run(Number(req.params.id)).changes > 0 }));
api.get('/export.csv', (req, res) => {
  const cols = ['id', 'created_at', 'status', 'name', 'phone', 'email', 'item', 'quantity', 'method', 'deadline', 'contact_pref', 'details', 'source', 'notes'];
  const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="imagepro-quote-requests.csv"');
  res.send([cols.join(',')].concat(db.prepare('SELECT * FROM leads ORDER BY id DESC').all().map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n'));
});
api.get('/stats', (req, res) => res.json({ d7: statsFor(7), d30: statsFor(30), d90: statsFor(90) }));

/* ---------- orders ---------- */
const ORDER_STATUSES = Object.keys(O.STATUS);
const orderOut = (o) => ({
  ...o, items: O.itemsOf(o).map((i) => ({ ...i, artworkIsImage: /\.(png|jpe?g|gif|webp)$/i.test(i.artwork_file || '') })),
  mockups: O.mockupsOf(o).map((m) => ({ ...m, isImage: /\.(png|jpe?g|webp)$/i.test(m.file) })),
  ref: O.ref(o), statusLabel: O.statusLabel(o), trackUrl: O.trackUrl(o),
});
api.get('/orders', (req, res) => res.json({ statuses: O.STATUS, orders: db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1000').all().map(orderOut) }));
api.patch('/orders/:id', J, (req, res) => {
  const o = O.getById(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  if (b.status !== undefined) {
    if (!ORDER_STATUSES.includes(b.status)) return res.status(400).json({ error: 'bad status' });
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(b.status, o.id);
    if (b.status !== o.status) O.emailStatus(O.getById(o.id));
  }
  if (b.admin_notes !== undefined) db.prepare('UPDATE orders SET admin_notes = ? WHERE id = ?').run(String(b.admin_notes).slice(0, 4000), o.id);
  res.json({ ok: true, order: orderOut(O.getById(o.id)) });
});
api.post('/orders/:id/proof', handle(upload.mockup.array('proof', 6)), (req, res) => {
  const o = O.getById(req.params.id);
  const files = req.files || [];
  if (!o) { files.forEach((f) => remove('mockups', f.filename)); return res.status(404).json({ ok: false, error: 'not found' }); }
  if (!files.length) return res.status(400).json({ ok: false, error: 'Choose a proof image or PDF.' });
  O.mockupsOf(o).forEach((m) => remove('mockups', m.file)); // a new proof replaces the old one(s)
  const list = files.map((f) => ({ file: f.filename, name: String(f.originalname || '').slice(0, 120) }));
  db.prepare(`UPDATE orders SET mockups=?, mockup_sent_at=datetime('now'), status='mockup_sent', change_note=NULL WHERE id=?`).run(JSON.stringify(list), o.id);
  const fresh = O.getById(o.id);
  O.emailMockup(fresh);
  res.json({ ok: true, order: orderOut(fresh) });
});
api.get('/orders/:id/artwork/:i', (req, res) => {
  const o = O.getById(req.params.id);
  const it = o && O.itemsOf(o)[Number(req.params.i)];
  const p = it && filePath('artwork', it.artwork_file);
  if (!p || !fs.existsSync(p)) return res.status(404).send('Not found');
  if (req.query.view === '1' && /\.(png|jpe?g|gif|webp)$/i.test(p)) return res.sendFile(p);
  res.download(p, it.artwork_name || it.artwork_file);
});
api.get('/orders/:id/proof/:i', (req, res) => {
  const o = O.getById(req.params.id);
  const m = o && O.mockupsOf(o)[Number(req.params.i)];
  const p = m && filePath('mockups', m.file);
  if (!p || !fs.existsSync(p)) return res.status(404).send('Not found');
  res.sendFile(p);
});
api.delete('/orders/:id', (req, res) => {
  const o = O.getById(req.params.id);
  if (!o) return res.json({ ok: false });
  O.itemsOf(o).forEach((i) => remove('artwork', i.artwork_file));
  O.mockupsOf(o).forEach((m) => remove('mockups', m.file));
  db.prepare('DELETE FROM orders WHERE id = ?').run(o.id);
  res.json({ ok: true });
});

/* ---------- shared helpers for packages + products ---------- */
const slugify = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
function uniqueSlug(table, base, id) {
  let slug = base, n = 2;
  while (db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`).get(slug, id || 0)) slug = `${base}-${n++}`;
  return slug;
}
const csv = (s) => P.list(s).slice(0, 40).join(',');
const STYLES = ['tee', 'longsleeve', 'hoodie', 'crewneck', 'youth', 'premium', 'hat', 'beanie'];
const CATS = ['tees', 'longsleeve', 'hoodies', 'crewnecks', 'youth', 'hats'];
const dropPhoto = (photo) => { if (photo && photo.startsWith('/media/products/')) remove('deals', photo.split('/').pop()); };
const yes = (v) => v === '1' || v === 'true' || v === true;

/* ---------- packages ---------- */
function packageFields(b) {
  const title = String(b.title || '').trim().slice(0, 120);
  const price = P.cents(b.price);
  if (!title) return { error: 'Give the package a name.' };
  if (!price) return { error: 'Enter a price, like 399.' };
  const mode = b.sell_mode === 'each' ? 'each' : 'pack';
  const qty = Math.round(Number(b.pack_qty));
  if (mode === 'pack' && !(qty >= 1 && qty <= 5000)) return { error: 'Enter how many pieces are in the package.' };
  const ends = String(b.ends_at || '').trim();
  return {
    title, price_cents: price, sell_mode: mode, pack_qty: mode === 'pack' ? qty : 1,
    style: STYLES.includes(b.style) ? b.style : 'tee',
    group_name: String(b.group_name || 'T-Shirts').trim().slice(0, 40) || 'T-Shirts',
    garment: String(b.garment || '').trim().slice(0, 120), blurb: String(b.blurb || '').trim().slice(0, 1200),
    includes: String(b.includes || '').trim().slice(0, 200), badge: String(b.badge || '').trim().slice(0, 30),
    colors: csv(b.colors), sizes: csv(b.sizes), plus_sizes: csv(b.plus_sizes), plus_cents: P.cents(b.plus_price),
    locations: csv(b.locations) || 'Front', needs_logo: yes(b.needs_logo) ? 1 : 0, active: yes(b.active) ? 1 : 0,
    ends_at: /^\d{4}-\d{2}-\d{2}$/.test(ends) ? ends : null, sort: Math.round(Number(b.sort)) || 0,
  };
}
const pkgOut = (p) => ({ ...p, url: O.site() + '/packages/' + p.slug });
api.get('/packages', (req, res) => res.json({ styles: STYLES, packages: db.prepare('SELECT * FROM packages ORDER BY sort DESC, id').all().map(pkgOut) }));
api.post('/packages', handle(upload.deal.single('photo')), (req, res) => {
  const f = packageFields(req.body || {});
  if (f.error) { if (req.file) remove('deals', req.file.filename); return res.status(400).json({ ok: false, error: f.error }); }
  const slug = uniqueSlug('packages', slugify(f.title + (f.sell_mode === 'pack' ? '-' + f.pack_qty : '')));
  const info = db.prepare(`INSERT INTO packages (slug,title,style,group_name,garment,blurb,includes,sell_mode,pack_qty,price_cents,colors,sizes,plus_sizes,plus_cents,locations,badge,needs_logo,photo,active,ends_at,sort)
    VALUES (@slug,@title,@style,@group_name,@garment,@blurb,@includes,@sell_mode,@pack_qty,@price_cents,@colors,@sizes,@plus_sizes,@plus_cents,@locations,@badge,@needs_logo,@photo,@active,@ends_at,@sort)`)
    .run({ ...f, slug, photo: req.file ? '/media/products/' + req.file.filename : '' });
  res.json({ ok: true, package: pkgOut(db.prepare('SELECT * FROM packages WHERE id = ?').get(info.lastInsertRowid)) });
});
api.patch('/packages/:id', handle(upload.deal.single('photo')), (req, res) => {
  const p = db.prepare('SELECT * FROM packages WHERE id = ?').get(Number(req.params.id));
  if (!p) { if (req.file) remove('deals', req.file.filename); return res.status(404).json({ ok: false, error: 'not found' }); }
  const b = req.body || {};
  if (b.only_active !== undefined) { db.prepare('UPDATE packages SET active = ? WHERE id = ?').run(yes(b.only_active) ? 1 : 0, p.id); return res.json({ ok: true }); }
  const f = packageFields(b);
  if (f.error) { if (req.file) remove('deals', req.file.filename); return res.status(400).json({ ok: false, error: f.error }); }
  let photo = p.photo;
  if (req.file || yes(b.remove_photo)) { dropPhoto(p.photo); photo = req.file ? '/media/products/' + req.file.filename : ''; }
  db.prepare(`UPDATE packages SET title=@title,style=@style,group_name=@group_name,garment=@garment,blurb=@blurb,includes=@includes,sell_mode=@sell_mode,pack_qty=@pack_qty,price_cents=@price_cents,
    colors=@colors,sizes=@sizes,plus_sizes=@plus_sizes,plus_cents=@plus_cents,locations=@locations,badge=@badge,needs_logo=@needs_logo,photo=@photo,active=@active,ends_at=@ends_at,sort=@sort,is_sample=0 WHERE id=@id`)
    .run({ ...f, photo, id: p.id });
  res.json({ ok: true, package: pkgOut(db.prepare('SELECT * FROM packages WHERE id = ?').get(p.id)) });
});
api.post('/packages/:id/duplicate', (req, res) => {
  const p = db.prepare('SELECT * FROM packages WHERE id = ?').get(Number(req.params.id));
  if (!p) return res.status(404).json({ ok: false });
  const { id, created_at, ...rest } = p;
  const info = db.prepare(`INSERT INTO packages (${Object.keys(rest).join(',')}) VALUES (${Object.keys(rest).map((k) => '@' + k).join(',')})`)
    .run({ ...rest, slug: uniqueSlug('packages', p.slug + '-copy'), title: p.title + ' (copy)', active: 0, photo: '' });
  res.json({ ok: true, package: pkgOut(db.prepare('SELECT * FROM packages WHERE id = ?').get(info.lastInsertRowid)) });
});
api.delete('/packages/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM packages WHERE id = ?').get(Number(req.params.id));
  if (!p) return res.json({ ok: false });
  dropPhoto(p.photo);
  db.prepare('DELETE FROM packages WHERE id = ?').run(p.id);
  res.json({ ok: true });
});

/* ---------- custom order catalog ---------- */
function productFields(b) {
  const name = String(b.name || '').trim().slice(0, 100);
  if (!name) return { error: 'Give the item a name.' };
  let breaks = [];
  try { breaks = JSON.parse(b.breaks || '[]'); } catch (e) {}
  breaks = (Array.isArray(breaks) ? breaks : [])
    .map((r) => [Math.round(Number(r[0])), P.cents(r[1])]).filter((r) => r[0] >= 1 && r[1] > 0)
    .sort((a, c) => a[0] - c[0]).filter((r, i, a) => i === 0 || r[0] !== a[i - 1][0]).slice(0, 12);
  if (!breaks.length) return { error: 'Add at least one price (quantity and price per piece).' };
  const min = Math.round(Number(b.min_qty)) || breaks[0][0];
  return {
    name, category: CATS.includes(b.category) ? b.category : 'tees', style: STYLES.includes(b.style) ? b.style : 'tee',
    kind: b.kind === 'hat' ? 'hat' : 'apparel', garment: String(b.garment || '').trim().slice(0, 120), blurb: String(b.blurb || '').trim().slice(0, 600),
    colors: csv(b.colors), sizes: csv(b.sizes) || 'One size', plus_sizes: csv(b.plus_sizes), plus_cents: P.cents(b.plus_price),
    min_qty: Math.max(1, Math.min(5000, min)), breaks: JSON.stringify(breaks), active: yes(b.active) ? 1 : 0, sort: Math.round(Number(b.sort)) || 0,
  };
}
const prodOut = (p) => ({ ...p, breaks: P.breaksOf(p), url: O.site() + '/custom/' + p.slug });
api.get('/products', (req, res) => res.json({ styles: STYLES, categories: CATS, products: db.prepare('SELECT * FROM products ORDER BY sort DESC, id').all().map(prodOut) }));
api.post('/products', handle(upload.deal.single('photo')), (req, res) => {
  const f = productFields(req.body || {});
  if (f.error) { if (req.file) remove('deals', req.file.filename); return res.status(400).json({ ok: false, error: f.error }); }
  const info = db.prepare(`INSERT INTO products (slug,name,category,style,kind,garment,blurb,colors,sizes,plus_sizes,plus_cents,min_qty,breaks,photo,active,sort)
    VALUES (@slug,@name,@category,@style,@kind,@garment,@blurb,@colors,@sizes,@plus_sizes,@plus_cents,@min_qty,@breaks,@photo,@active,@sort)`)
    .run({ ...f, slug: uniqueSlug('products', slugify(f.name)), photo: req.file ? '/media/products/' + req.file.filename : '' });
  res.json({ ok: true, product: prodOut(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid)) });
});
api.patch('/products/:id', handle(upload.deal.single('photo')), (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!p) { if (req.file) remove('deals', req.file.filename); return res.status(404).json({ ok: false, error: 'not found' }); }
  const b = req.body || {};
  if (b.only_active !== undefined) { db.prepare('UPDATE products SET active = ? WHERE id = ?').run(yes(b.only_active) ? 1 : 0, p.id); return res.json({ ok: true }); }
  const f = productFields(b);
  if (f.error) { if (req.file) remove('deals', req.file.filename); return res.status(400).json({ ok: false, error: f.error }); }
  let photo = p.photo;
  if (req.file || yes(b.remove_photo)) { dropPhoto(p.photo); photo = req.file ? '/media/products/' + req.file.filename : ''; }
  db.prepare(`UPDATE products SET name=@name,category=@category,style=@style,kind=@kind,garment=@garment,blurb=@blurb,colors=@colors,sizes=@sizes,plus_sizes=@plus_sizes,plus_cents=@plus_cents,
    min_qty=@min_qty,breaks=@breaks,photo=@photo,active=@active,sort=@sort,is_sample=0 WHERE id=@id`).run({ ...f, photo, id: p.id });
  res.json({ ok: true, product: prodOut(db.prepare('SELECT * FROM products WHERE id = ?').get(p.id)) });
});
api.delete('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!p) return res.json({ ok: false });
  dropPhoto(p.photo);
  db.prepare('DELETE FROM products WHERE id = ?').run(p.id);
  res.json({ ok: true });
});

/* ---------- pricing rules ---------- */
api.get('/settings', (req, res) => res.json({ settings: P.getSettings() }));
api.put('/settings', J, (req, res) => res.json({ ok: true, settings: P.saveSettings(req.body || {}) }));

router.use('/admin/api', api);
module.exports = router;
