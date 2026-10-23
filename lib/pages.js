// Server-rendered store pages (so every deal link shares with its own photo and title).
const { esc } = require('./mailer');
const O = require('./orders');

const FB = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.9.4-1.7 1.8-1.7h1.6V3.8s-1.4-.3-2.8-.3c-2.8 0-4.5 1.7-4.5 4.7v2.3H6.7v3.3h2.9V22h3.9z"/></svg>';
const IG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>';

function layout({ title, desc, path, image, body, robots, scripts }) {
  const site = O.site();
  const img = image ? (image.startsWith('http') ? image : site + image) : site + '/img/og.jpg';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc || '')}">
${robots ? `<meta name="robots" content="${esc(robots)}">` : ''}
<meta name="theme-color" content="#f2eee6">
<link rel="icon" type="image/png" href="/img/favicon.png">
<link rel="canonical" href="${esc(site + path)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Imagepro Screenprint">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc || '')}">
<meta property="og:url" content="${esc(site + path)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/shop.css">
</head>
<body class="shop">
<header class="top">
  <div class="top-in">
    <a class="mark" href="/" aria-label="Imagepro Screenprint home"><img src="/img/icon-ink.png" alt="" width="512" height="377"><span>Imagepro</span></a>
    <nav class="nav" id="nav" aria-label="Main">
      <a href="/order">Order hats online</a>
      <a href="/deals">Deals</a>
      <a href="/#worn">Our work</a>
      <a href="/#order">Get a quote</a>
      <span class="nav-social">
        <a href="https://www.facebook.com/imageproscreenprint" target="_blank" rel="noopener" data-social="facebook" aria-label="Imagepro on Facebook">${FB}<span class="soc-txt">Facebook</span></a>
        <a href="https://www.instagram.com/imagepro_screenprint" target="_blank" rel="noopener" data-social="instagram" aria-label="Imagepro on Instagram">${IG}<span class="soc-txt">Instagram</span></a>
      </span>
    </nav>
    <a class="top-phone" href="tel:+12074992700">(207) 499-2700</a>
    <button class="menu" id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><span></span><span></span></button>
  </div>
</header>
<main>
${body}
</main>
<footer class="foot">
  <div class="shell">
    <div class="foot-row">
      <p class="foot-tag">Design. Print. Promote.</p>
      <div class="foot-links">
        <a href="tel:+12074992700">(207) 499-2700</a>
        <a href="mailto:imageprospd@gmail.com">imageprospd@gmail.com</a>
        <span>Biddeford, Maine</span>
        <a href="https://www.facebook.com/imageproscreenprint" target="_blank" rel="noopener" data-social="facebook">Facebook · 2.4K</a>
        <a href="https://www.instagram.com/imagepro_screenprint" target="_blank" rel="noopener" data-social="instagram">Instagram</a>
      </div>
    </div>
    <div class="foot-bar">
      <span>© ${new Date().getFullYear()} Imagepro Screenprint</span>
      <a class="credit" href="https://getrealeasysites.com" target="_blank" rel="noopener">Website by Real Easy Sites</a>
    </div>
  </div>
</footer>
<script src="/js/track.js" defer></script>
<script src="/js/shop.js" defer></script>
${(scripts || []).map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

const priceTag = (d) => `<span class="tag"><b>${O.money(d.price_cents)}</b> ${esc(d.unit_label)}</span>`;
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d + 'T12:00:00');
  return isNaN(t) ? '' : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function dealPhoto(d, cls) {
  return d.photo
    ? `<img class="${cls}" src="${esc(d.photo)}" alt="${esc(d.title)}" loading="lazy">`
    : `<div class="${cls} ph-blank" role="img" aria-label="${esc(d.title)}"><img src="/img/icon-ink.png" alt=""><span>${esc(d.title)}</span></div>`;
}

function dealsPage(deals) {
  const cards = deals.length
    ? deals
        .map(
          (d) => `<li class="rack-item">
      <a href="/deals/${esc(d.slug)}">
        ${dealPhoto(d, 'rack-photo')}
        <div class="rack-meta">
          ${d.is_sample ? '<span class="sample">Sample deal</span>' : ''}
          <h2>${esc(d.title)}</h2>
          ${priceTag(d)}
          ${d.ends_at ? `<span class="ends">Ends ${esc(fmtDate(d.ends_at))}</span>` : ''}
        </div>
      </a>
    </li>`
        )
        .join('')
    : '<li class="rack-empty">No deals running right now. Check back soon, or <a href="/order">build your own hat order</a>.</li>';
  return layout({
    title: 'Deals | Imagepro Screenprint',
    desc: 'Current deals and package pricing from Imagepro Screenprint in Biddeford, Maine.',
    path: '/deals',
    body: `<section class="shop-head shell">
      <p class="crumb"><a href="/">Imagepro</a> / Deals</p>
      <h1>On the rack this week.</h1>
      <p class="lede">Package deals and ready-to-grab gear. Every deal has its own link, so you can send it straight to your crew.</p>
    </section>
    <section class="shell"><ul class="rack">${cards}</ul></section>
    <section class="shell shop-cta"><p>Need something custom?</p><a class="btn btn-ink" href="/order">Design your hats</a><a class="btn btn-line" href="/#order">Get a quote</a></section>`,
  });
}

function dealPage(d) {
  const sizes = list(d.sizes);
  const colors = list(d.colors);
  const pub = { id: d.id, price: d.price_cents, sizes, colors, needsLogo: !!d.needs_logo, unit: d.unit_label };
  const url = O.site() + '/deals/' + d.slug;
  const qtyRows = sizes.length > 1
    ? `<div class="size-grid">${sizes
        .map((s, i) => `<label class="size-cell"><span>${esc(s)}</span><input type="number" min="0" max="500" inputmode="numeric" data-size="${esc(s)}" value="${i === 0 ? '' : ''}" placeholder="0"></label>`)
        .join('')}</div>`
    : `<label class="field one-qty">How many${d.unit_label && d.unit_label !== 'each' ? ` (${esc(d.unit_label.replace(/^per /, ''))}s)` : ''}<input type="number" min="1" max="500" inputmode="numeric" data-size="${esc(sizes[0] || '')}" value="1"></label>`;
  const colorPick = colors.length
    ? `<fieldset class="pick"><legend>Color</legend>${colors
        .map((c, i) => `<label><input type="radio" name="color" value="${esc(c)}"${i === 0 ? ' checked' : ''}><i></i>${esc(c)}</label>`)
        .join('')}</fieldset>`
    : '';
  const logo = d.needs_logo
    ? `<fieldset class="pick logo-pick"><legend>Your logo</legend>
        <label class="drop" id="dealDrop"><input type="file" name="artwork" accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.ai,.eps,.psd"><span class="drop-txt"><b>Upload your logo</b><small>PNG, JPG, PDF, AI or EPS. A phone photo works too.</small></span></label>
        <p class="hint">We send you a mockup to approve before anything is made.</p>
      </fieldset>`
    : '';
  return layout({
    title: `${d.title} | Imagepro Screenprint`,
    desc: `${O.money(d.price_cents)} ${d.unit_label}. ${d.blurb || ''}`.slice(0, 200),
    path: '/deals/' + d.slug,
    image: d.photo || '/img/og.jpg',
    scripts: ['/js/deal.js'],
    body: `<section class="shell deal">
      <p class="crumb"><a href="/">Imagepro</a> / <a href="/deals">Deals</a></p>
      <div class="deal-grid">
        <div class="deal-left">
          ${dealPhoto(d, 'deal-photo')}
          <div class="share" data-url="${esc(url)}" data-title="${esc(d.title)}">
            <span>Share this deal</span>
            <button type="button" class="share-btn" data-share="copy">Copy link</button>
            <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" data-social="facebook">Facebook</a>
            <button type="button" class="share-btn native" data-share="native" hidden>Share…</button>
          </div>
        </div>
        <div class="deal-right">
          ${d.is_sample ? '<p class="sample">Sample deal for the trial</p>' : ''}
          <h1>${esc(d.title)}</h1>
          ${priceTag(d)}
          ${d.ends_at ? `<p class="ends">Deal ends ${esc(fmtDate(d.ends_at))}</p>` : ''}
          <p class="blurb">${esc(d.blurb || '')}</p>
          <form class="buy" id="dealForm" data-deal="${esc(JSON.stringify(pub))}" novalidate>
            <div class="hp" aria-hidden="true"><label>Company <input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>
            ${colorPick}
            <fieldset class="pick"><legend>${sizes.length > 1 ? 'Sizes and quantity' : 'Quantity'}</legend>${qtyRows}</fieldset>
            ${logo}
            <label class="field">Notes ${d.needs_logo ? '(tee sizes, colors, anything we should know)' : '(optional)'}<textarea name="notes" rows="3"></textarea></label>
            <fieldset class="pick"><legend>Your info</legend>
              <div class="field-row">
                <label class="field">Name *<input name="name" autocomplete="name" required></label>
                <label class="field">Phone *<input name="phone" type="tel" autocomplete="tel" required></label>
              </div>
              <label class="field">Email * <small>(order updates go here)</small><input name="email" type="email" autocomplete="email" required></label>
            </fieldset>
            <fieldset class="pick"><legend>Getting it</legend>
              <label><input type="radio" name="fulfillment" value="pickup" checked><i></i>Pick up in Biddeford</label>
              <label><input type="radio" name="fulfillment" value="delivery"><i></i>Local delivery</label>
              <label class="field addr" hidden>Delivery address<input name="address" autocomplete="street-address"></label>
            </fieldset>
            <div class="buy-foot">
              <p class="buy-total"><span>Total</span><b id="dealTotal">${O.money(d.price_cents)}</b></p>
              <button class="btn btn-ink btn-big" type="submit" id="dealSubmit">Continue to checkout</button>
              <p class="form-msg" id="dealMsg" role="status" aria-live="polite"></p>
            </div>
          </form>
        </div>
      </div>
    </section>`,
  });
}

function orderBuilderPage() {
  return layout({
    title: 'Design your hats online | Imagepro Screenprint',
    desc: 'Build your custom hat order online: pick embroidery or a custom patch, choose your hats, upload your logo and check out. Mockup approval before anything is made.',
    path: '/order',
    scripts: ['/js/order.js'],
    body: require('fs').readFileSync(require('path').join(__dirname, '..', 'views', 'order-body.html'), 'utf8'),
  });
}

function itemsTable(o) {
  let items = [];
  try { items = JSON.parse(o.items_json); } catch (e) {}
  return `<table class="items"><thead><tr><th>Item</th><th>Qty</th><th>Each</th><th>Line</th></tr></thead><tbody>${items
    .map(
      (i) =>
        `<tr><td>${esc([i.styleName || i.label, i.color, i.size].filter(Boolean).join(' · '))}</td><td>${i.qty}</td><td>${O.money(i.unit)}</td><td>${O.money(i.line)}</td></tr>`
    )
    .join('')}</tbody></table>`;
}

function totals(o) {
  return `<dl class="totals">
    ${o.tax_cents ? `<div><dt>Subtotal</dt><dd>${O.money(o.subtotal_cents)}</dd></div><div><dt>Sales tax</dt><dd>${O.money(o.tax_cents)}</dd></div>` : ''}
    <div class="grand"><dt>Total</dt><dd>${O.money(o.total_cents)}</dd></div>
  </dl>`;
}

function demoCheckoutPage(o) {
  return layout({
    title: `Checkout ${O.ref(o)} | Imagepro Screenprint`,
    path: '/checkout/demo/' + o.token,
    robots: 'noindex,nofollow',
    scripts: ['/js/status.js'],
    body: `<section class="shell checkout">
      <p class="crumb">Checkout</p>
      <div class="co-grid">
        <div class="co-pay">
          <h1>Pay for ${esc(O.ref(o))}</h1>
          <p class="demo-note"><b>Demo mode.</b> No card is charged. Once Imagepro connects a Stripe account, this step becomes Stripe's secure checkout page.</p>
          <div class="fake-card" aria-hidden="true">
            <span>Card number</span><div>4242 4242 4242 4242</div>
            <span>Expiry / CVC</span><div>12 / 34 · 123</div>
          </div>
          <button class="btn btn-ink btn-big" id="demoPay" data-token="${esc(o.token)}">Pay ${O.money(o.total_cents)} (demo)</button>
          <p class="form-msg" id="payMsg" role="status" aria-live="polite"></p>
        </div>
        <aside class="co-sum">
          <h2>${esc(o.title)}</h2>
          ${itemsTable(o)}
          ${totals(o)}
        </aside>
      </div>
    </section>`,
  });
}

function statusPage(o, flash) {
  const custom = !!o.needs_mockup;
  const flow = custom
    ? ['paid', 'mockup_sent', 'approved', 'printing', 'ready', 'completed']
    : ['paid', 'printing', 'ready', 'completed'];
  const names = {
    paid: 'Paid',
    mockup_sent: 'Mockup to approve',
    approved: 'Approved',
    printing: 'Printing',
    ready: o.fulfillment === 'delivery' ? 'Ready for delivery' : 'Ready for pickup',
    completed: 'Done',
  };
  const at = o.status === 'changes_requested' ? flow.indexOf('mockup_sent') : flow.indexOf(o.status);
  const track = o.status === 'awaiting_payment' || o.status === 'cancelled'
    ? ''
    : `<ol class="track">${flow
        .map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}">${esc(names[s])}</li>`)
        .join('')}</ol>`;

  let action = '';
  if (o.status === 'awaiting_payment') {
    action = `<div class="panel-note"><h2>Payment not finished</h2><p>Your order is saved, but it isn't paid yet.</p>
      <button class="btn btn-ink" id="payAgain" data-token="${esc(o.token)}">Finish checkout</button><p class="form-msg" id="payMsg" role="status"></p></div>`;
  } else if (o.status === 'mockup_sent' || o.status === 'changes_requested') {
    const isPdf = /\.pdf$/i.test(o.mockup_file || '');
    action = `<div class="mockup">
      <h2>Your mockup</h2>
      ${o.mockup_file ? (isPdf ? `<p><a class="btn btn-line" href="/o/${esc(o.token)}/mockup" target="_blank" rel="noopener">Open the mockup (PDF)</a></p>` : `<a href="/o/${esc(o.token)}/mockup" target="_blank" rel="noopener"><img src="/o/${esc(o.token)}/mockup" alt="Mockup of your order"></a>`) : ''}
      ${o.status === 'changes_requested'
        ? `<p class="panel-note">Thanks, we got your notes: “${esc(o.change_note || '')}”. We'll send an updated mockup.</p>`
        : `<div class="approve">
            <button class="btn btn-ink btn-big" id="approveBtn" data-token="${esc(o.token)}">Looks good, print it</button>
            <details><summary>Something needs to change</summary>
              <textarea id="changeNote" rows="3" placeholder="Tell us what to change"></textarea>
              <button class="btn btn-line" id="changeBtn" data-token="${esc(o.token)}">Send changes</button>
            </details>
            <p class="form-msg" id="apprMsg" role="status" aria-live="polite"></p>
          </div>`}
    </div>`;
  }

  return layout({
    title: `Order ${O.ref(o)} | Imagepro Screenprint`,
    path: '/o/' + o.token,
    robots: 'noindex,nofollow',
    scripts: ['/js/status.js'],
    body: `<section class="shell order-status">
      <p class="crumb">Your order</p>
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ''}
      <div class="os-head">
        <h1>${esc(O.ref(o))}</h1>
        <span class="stamp-s">${esc(O.statusLabel(o))}</span>
      </div>
      <p class="os-title">${esc(o.title)}${o.payment_mode === 'demo' ? ' <span class="sample">Demo order</span>' : ''}</p>
      ${track}
      ${action}
      <div class="os-grid">
        <div>${itemsTable(o)}${totals(o)}</div>
        <dl class="os-facts">
          ${o.decoration ? `<div><dt>Decoration</dt><dd>${esc(o.decoration)}${o.extras ? ' + ' + esc(o.extras) : ''}</dd></div>` : ''}
          ${o.placement ? `<div><dt>Placement</dt><dd>${esc(o.placement)}</dd></div>` : ''}
          ${o.artwork_name ? `<div><dt>Logo file</dt><dd>${esc(o.artwork_name)}</dd></div>` : ''}
          <div><dt>Getting it</dt><dd>${o.fulfillment === 'delivery' ? 'Local delivery' + (o.address ? ': ' + esc(o.address) : '') : 'Pickup in Biddeford'}</dd></div>
          ${o.need_by ? `<div><dt>Need by</dt><dd>${esc(o.need_by)}</dd></div>` : ''}
          ${o.notes ? `<div><dt>Notes</dt><dd>${esc(o.notes)}</dd></div>` : ''}
        </dl>
      </div>
      <p class="os-help">Questions about your order? Call or text <a href="tel:+12074992700">(207) 499-2700</a>.</p>
    </section>`,
  });
}

module.exports = { layout, dealsPage, dealPage, orderBuilderPage, demoCheckoutPage, statusPage, list };
