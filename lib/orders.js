// Shared order helpers: statuses, formatting, emails.
const db = require('../db/init');
const { getTransport, esc } = require('./mailer');

const STATUS = {
  awaiting_payment: 'Waiting for payment',
  paid: 'Paid, mockup coming',
  mockup_sent: 'Mockup sent, waiting on approval',
  changes_requested: 'Changes requested',
  approved: 'Approved, in line to print',
  printing: 'Printing',
  ready: 'Ready',
  completed: 'Picked up / delivered',
  cancelled: 'Cancelled',
};
// "paid" on an order with no mockup step reads differently
const statusLabel = (o) => (o.status === 'paid' && !o.needs_mockup ? 'Paid, in line to print' : STATUS[o.status] || o.status);

const ref = (o) => 'IP-' + (1000 + o.id);
const money = (c) => '$' + (c / 100).toFixed(2).replace(/\.00$/, '');
const site = () => (process.env.SITE_URL || 'https://imageproscreenprint.com').replace(/\/+$/, '');
const trackUrl = (o) => `${site()}/o/${o.token}`;

const getByToken = (t) => db.prepare('SELECT * FROM orders WHERE token = ?').get(String(t || ''));
const getById = (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(id));

function itemsText(o) {
  let items = [];
  try { items = JSON.parse(o.items_json); } catch (e) {}
  return items.map((i) => `${i.qty} × ${[i.styleName || i.label, i.color, i.size].filter(Boolean).join(', ')}`).join('\n');
}

async function send(to, subject, text, replyTo) {
  const t = getTransport();
  if (!t || !to) return false;
  await t.sendMail({ from: `"Imagepro Screenprint" <${process.env.SMTP_USER}>`, to, subject, text, replyTo });
  return true;
}
const quiet = (p) => p.catch((e) => console.error('store email failed:', e.message));
const phone = () => process.env.PUBLIC_PHONE || '(207) 499-2700';

function markPaid(o) {
  if (o.status !== 'awaiting_payment') return o;
  db.prepare(`UPDATE orders SET status='paid', paid_at=datetime('now') WHERE id=?`).run(o.id);
  const fresh = getById(o.id);
  quiet(
    send(
      process.env.NOTIFY_EMAIL,
      `New online order ${ref(fresh)}: ${fresh.title} (${money(fresh.total_cents)})`,
      `New paid order${fresh.payment_mode === 'demo' ? ' (DEMO, no card charged)' : ''}.\n\n${ref(fresh)} · ${fresh.title}\n${itemsText(fresh)}\n\n` +
        `Customer: ${fresh.name} · ${fresh.phone} · ${fresh.email}\nFulfillment: ${fresh.fulfillment}${fresh.address ? ' · ' + fresh.address : ''}\n` +
        `Total: ${money(fresh.total_cents)}\n\nOpen the dashboard: ${site()}/admin`,
      fresh.email
    )
  );
  quiet(
    send(
      fresh.email,
      `Order ${ref(fresh)} received, Imagepro Screenprint`,
      `Hi ${fresh.name},\n\nThanks for your order. Here's what we have:\n\n${fresh.title}\n${itemsText(fresh)}\nTotal: ${money(fresh.total_cents)}\n\n` +
        (fresh.needs_mockup
          ? `Next, we'll email you a mockup of your logo to approve. Nothing gets made until you say it looks right.\n\n`
          : `We'll let you know as soon as it's ready.\n\n`) +
        `Track your order any time: ${trackUrl(fresh)}\n\nQuestions? Call or text ${phone()}.\n\nImagepro Screenprint · Biddeford, ME`,
      process.env.NOTIFY_EMAIL
    )
  );
  return fresh;
}

function emailMockup(o) {
  return quiet(
    send(
      o.email,
      `Your mockup is ready to approve (${ref(o)})`,
      `Hi ${o.name},\n\nYour mockup for ${o.title} is ready. Take a look and approve it, or tell us what to change:\n\n${trackUrl(o)}\n\n` +
        `We start printing as soon as you approve.\n\nImagepro Screenprint · ${phone()}`,
      process.env.NOTIFY_EMAIL
    )
  );
}

function emailStatus(o) {
  if (o.status === 'ready') {
    const how = o.fulfillment === 'delivery' ? `We'll reach out to set up delivery.` : `It's ready for pickup at the shop in Biddeford.`;
    return quiet(send(o.email, `Your order ${ref(o)} is ready`, `Hi ${o.name},\n\nGood news: ${o.title} is done. ${how}\n\nOrder details: ${trackUrl(o)}\n\nImagepro Screenprint · ${phone()}`, process.env.NOTIFY_EMAIL));
  }
  if (o.status === 'printing') {
    return quiet(send(o.email, `Your order ${ref(o)} is on the press`, `Hi ${o.name},\n\n${o.title} is printing now. We'll let you know when it's ready.\n\n${trackUrl(o)}\n\nImagepro Screenprint`, process.env.NOTIFY_EMAIL));
  }
  return Promise.resolve();
}

function emailOwner(subject, text) {
  return quiet(send(process.env.NOTIFY_EMAIL, subject, text));
}

module.exports = { STATUS, statusLabel, ref, money, site, trackUrl, getByToken, getById, itemsText, markPaid, emailMockup, emailStatus, emailOwner, esc };
