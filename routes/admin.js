const express = require('express');
const path = require('path');
const db = require('../db/init');
const auth = require('../lib/auth');
const { statsFor } = require('./analytics');

const router = express.Router();
const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];

let fails = new Map(); // simple login throttle per IP
function throttled(ip) {
  const now = Date.now();
  const arr = (fails.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  fails.set(ip, arr);
  return arr.length >= 8;
}

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

router.get('/admin', (req, res) => {
  const file = auth.isAuthed(req) ? 'admin.html' : 'login.html';
  res.sendFile(path.join(__dirname, '..', 'views', file));
});

router.get('/admin/status', (req, res) => {
  res.json({ loginEnabled: auth.loginEnabled(), authed: auth.isAuthed(req) });
});

router.post('/admin/login', express.urlencoded({ extended: false, limit: '4kb' }), express.json({ limit: '4kb' }), (req, res) => {
  if (!auth.loginEnabled()) return res.status(503).json({ ok: false, error: 'Login is not set up yet. Set ADMIN_PASSWORD (8+ characters).' });
  if (throttled(req.ip)) return res.status(429).json({ ok: false, error: 'Too many attempts. Try again in a few minutes.' });
  if (!auth.checkPassword((req.body || {}).password)) {
    fails.get(req.ip).push(Date.now());
    return res.status(401).json({ ok: false, error: 'Wrong password.' });
  }
  auth.issue(req, res);
  res.json({ ok: true });
});

router.get('/admin/logout', (req, res) => {
  auth.clear(res);
  res.redirect('/admin');
});

const api = express.Router();
api.use(auth.requireAdminApi);

api.get('/leads', (req, res) => {
  res.json({ statuses: STATUSES, leads: db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 1000').all() });
});

api.patch('/leads/:id', express.json({ limit: '16kb' }), (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const row = db.prepare('SELECT id FROM leads WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'bad status' });
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(b.status, id);
  }
  if (b.notes !== undefined) db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(String(b.notes).slice(0, 4000), id);
  res.json({ ok: true });
});

api.delete('/leads/:id', (req, res) => {
  const r = db.prepare('DELETE FROM leads WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: r.changes > 0 });
});

api.get('/stats', (req, res) => {
  res.json({ d7: statsFor(7), d30: statsFor(30), d90: statsFor(90) });
});

api.get('/export.csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  const cols = ['id', 'created_at', 'status', 'name', 'phone', 'email', 'item', 'quantity', 'method', 'deadline', 'contact_pref', 'details', 'source', 'notes'];
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // block spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="imagepro-leads.csv"');
  res.send(csv);
});

/* ---------- online store: orders ---------- */
const fs = require('fs');
const { upload, handle, filePath, remove } = require('../lib/uploads');
const O = require('../lib/orders');
const ORDER_STATUSES = Object.keys(O.STATUS);

function orderOut(o) {
  let items = [];
  try { items = JSON.parse(o.items_json); } catch (e) {}
  return {
    ...o,
    items,
    ref: O.ref(o),
    statusLabel: O.statusLabel(o),
    trackUrl: O.trackUrl(o),
    artworkIsImage: /\.(png|jpe?g|gif|webp)$/i.test(o.artwork_file || ''),
    mockupIsImage: /\.(png|jpe?g|webp)$/i.test(o.mockup_file || ''),
  };
}

api.get('/orders', (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1000').all();
  res.json({ statuses: O.STATUS, orders: rows.map(orderOut) });
});

api.patch('/orders/:id', express.json({ limit: '16kb' }), (req, res) => {
  const o = O.getById(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  if (b.status !== undefined) {
    if (!ORDER_STATUSES.includes(b.status)) return res.status(400).json({ error: 'bad status' });
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(b.status, o.id);
    if (b.status !== o.status && b.notify !== false) O.emailStatus(O.getById(o.id));
  }
  if (b.admin_notes !== undefined) db.prepare('UPDATE orders SET admin_notes = ? WHERE id = ?').run(String(b.admin_notes).slice(0, 4000), o.id);
  res.json({ ok: true, order: orderOut(O.getById(o.id)) });
});

api.post('/orders/:id/mockup', handle(upload.mockup.single('mockup')), (req, res) => {
  const o = O.getById(req.params.id);
  if (!o) { if (req.file) remove('mockups', req.file.filename); return res.status(404).json({ ok: false, error: 'not found' }); }
  if (!req.file) return res.status(400).json({ ok: false, error: 'Choose a mockup image or PDF.' });
  if (o.mockup_file) remove('mockups', o.mockup_file);
  db.prepare(`UPDATE orders SET mockup_file=?, mockup_sent_at=datetime('now'), status='mockup_sent', change_note=NULL WHERE id=?`).run(req.file.filename, o.id);
  const fresh = O.getById(o.id);
  O.emailMockup(fresh);
  res.json({ ok: true, order: orderOut(fresh) });
});

api.get('/orders/:id/artwork', (req, res) => {
  const o = O.getById(req.params.id);
  const p = o && filePath('artwork', o.artwork_file);
  if (!p || !fs.existsSync(p)) return res.status(404).send('Not found');
  if (req.query.view === '1' && /\.(png|jpe?g|gif|webp)$/i.test(p)) return res.sendFile(p);
  res.download(p, o.artwork_name || o.artwork_file);
});

api.get('/orders/:id/mockup', (req, res) => {
  const o = O.getById(req.params.id);
  const p = o && filePath('mockups', o.mockup_file);
  if (!p || !fs.existsSync(p)) return res.status(404).send('Not found');
  res.sendFile(p);
});

api.delete('/orders/:id', (req, res) => {
  const o = O.getById(req.params.id);
  if (!o) return res.json({ ok: false });
  remove('artwork', o.artwork_file);
  remove('mockups', o.mockup_file);
  db.prepare('DELETE FROM orders WHERE id = ?').run(o.id);
  res.json({ ok: true });
});

/* ---------- online store: deals ---------- */
const slugify = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'deal';
function uniqueSlug(base, id) {
  let slug = base, n = 2;
  while (db.prepare('SELECT id FROM deals WHERE slug = ? AND id != ?').get(slug, id || 0)) slug = `${base}-${n++}`;
  return slug;
}
const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20).join(',');

function dealFields(b) {
  const title = String(b.title || '').trim().slice(0, 120);
  const price = Math.round(parseFloat(String(b.price || '').replace(/[$,]/g, '')) * 100);
  if (!title) return { error: 'Give the deal a title.' };
  if (!(price > 0) || price > 10000000) return { error: 'Enter a price, like 28 or 499.' };
  const ends = String(b.ends_at || '').trim();
  return {
    title,
    blurb: String(b.blurb || '').trim().slice(0, 1200),
    price_cents: price,
    unit_label: String(b.unit_label || 'each').trim().slice(0, 30) || 'each',
    sizes: csv(b.sizes),
    colors: csv(b.colors),
    needs_logo: b.needs_logo === '1' || b.needs_logo === 'true' ? 1 : 0,
    active: b.active === '0' || b.active === 'false' ? 0 : 1,
    ends_at: /^\d{4}-\d{2}-\d{2}$/.test(ends) ? ends : null,
  };
}
const dealOut = (d) => ({ ...d, url: O.site() + '/deals/' + d.slug, price: (d.price_cents / 100).toFixed(2) });
const dropDealPhoto = (photo) => { if (photo && photo.startsWith('/media/deals/')) remove('deals', photo.split('/').pop()); };

api.get('/deals', (req, res) => {
  res.json({ deals: db.prepare('SELECT * FROM deals ORDER BY sort, id DESC').all().map(dealOut) });
});

api.post('/deals', handle(upload.deal.single('photo')), (req, res) => {
  const f = dealFields(req.body || {});
  if (f.error) { if (req.file) remove('deals', req.file.filename); return res.status(400).json({ ok: false, error: f.error }); }
  const slug = uniqueSlug(slugify(req.body.slug || f.title));
  const info = db
    .prepare(`INSERT INTO deals (slug,title,blurb,price_cents,unit_label,sizes,colors,photo,needs_logo,active,ends_at)
              VALUES (@slug,@title,@blurb,@price_cents,@unit_label,@sizes,@colors,@photo,@needs_logo,@active,@ends_at)`)
    .run({ ...f, slug, photo: req.file ? '/media/deals/' + req.file.filename : '' });
  res.json({ ok: true, deal: dealOut(db.prepare('SELECT * FROM deals WHERE id = ?').get(info.lastInsertRowid)) });
});

api.patch('/deals/:id', handle(upload.deal.single('photo')), (req, res) => {
  const d = db.prepare('SELECT * FROM deals WHERE id = ?').get(Number(req.params.id));
  if (!d) { if (req.file) remove('deals', req.file.filename); return res.status(404).json({ ok: false, error: 'not found' }); }
  const b = req.body || {};
  if (b.only_active !== undefined) {
    db.prepare('UPDATE deals SET active = ? WHERE id = ?').run(b.only_active === '1' ? 1 : 0, d.id);
    return res.json({ ok: true, deal: dealOut(db.prepare('SELECT * FROM deals WHERE id = ?').get(d.id)) });
  }
  const f = dealFields(b);
  if (f.error) { if (req.file) remove('deals', req.file.filename); return res.status(400).json({ ok: false, error: f.error }); }
  let photo = d.photo;
  if (req.file || b.remove_photo === '1') { dropDealPhoto(d.photo); photo = req.file ? '/media/deals/' + req.file.filename : ''; }
  db.prepare(`UPDATE deals SET title=@title, blurb=@blurb, price_cents=@price_cents, unit_label=@unit_label, sizes=@sizes, colors=@colors,
              needs_logo=@needs_logo, active=@active, ends_at=@ends_at, photo=@photo, is_sample=0 WHERE id=@id`).run({ ...f, photo, id: d.id });
  res.json({ ok: true, deal: dealOut(db.prepare('SELECT * FROM deals WHERE id = ?').get(d.id)) });
});

api.delete('/deals/:id', (req, res) => {
  const d = db.prepare('SELECT * FROM deals WHERE id = ?').get(Number(req.params.id));
  if (!d) return res.json({ ok: false });
  dropDealPhoto(d.photo);
  db.prepare('DELETE FROM deals WHERE id = ?').run(d.id);
  res.json({ ok: true });
});

router.use('/admin/api', api);

module.exports = router;
