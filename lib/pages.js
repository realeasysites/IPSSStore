// Server-rendered pages (Nike-style storefront on the Imagepro v1 brand).
const { esc } = require('./mailer');
const O = require('./orders');
const P = require('./pricing');

const PHONE = '(207) 499-2700', TEL = '+12074992700', EMAIL = 'imageprospd@gmail.com';
const FB_URL = 'https://www.facebook.com/imageproscreenprint', IG_URL = 'https://www.instagram.com/imagepro_screenprint';
const ICON = {
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 13H7L6 8z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.9.4-1.7 1.8-1.7h1.6V3.8s-1.4-.3-2.8-.3c-2.8 0-4.5 1.7-4.5 4.7v2.3H6.7v3.3h2.9V22h3.9z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
  arrowL: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};

/* ---------- swatches ---------- */
const SW = { white: '#ffffff', black: '#111111', charcoal: '#3c3c3c', 'sport grey': '#a7a8aa', grey: '#9a9a9a', gray: '#9a9a9a', navy: '#1f2a44', royal: '#1d4ed8', 'royal blue': '#1d4ed8', red: '#c8102e', 'forest green': '#1f4d2b', 'safety green': '#c6f432', 'safety orange': '#ff6a13', maroon: '#6b1f2a', pepper: '#5a5a58', granite: '#8c8c8a', 'blue jean': '#5b7a99', moss: '#6b6b45', loden: '#4e5a3a', camo: 'repeating-linear-gradient(45deg,#5b5a3c 0 5px,#7d6e4b 5px 10px,#3f3f2c 10px 14px)', heather: '#b9b9b9', purple: '#4b2e83', gold: '#d4a017', orange: '#f26b21', pink: '#f4a7c0', brown: '#5b3a29', sand: '#d8c8a8', olive: '#5a5f2a' };
function swatch(name) {
  const parts = String(name).toLowerCase().split('/').map((s) => s.trim());
  if (parts.length === 2) return `linear-gradient(135deg,${SW[parts[0]] || '#bbb'} 50%,${SW[parts[1]] || '#bbb'} 50%)`;
  return SW[parts[0]] || '#cccccc';
}

const STYLE_LABEL = { tee: 'T-Shirt', longsleeve: 'Long Sleeve', hoodie: 'Hoodie', crewneck: 'Crewneck', youth: 'Youth', premium: 'Premium Tee', hat: 'Hat', beanie: 'Beanie' };
const CATS = [
  ['tees', 'T-Shirts'], ['longsleeve', 'Long Sleeve'], ['hoodies', 'Hoodies'], ['crewnecks', 'Crewnecks'], ['youth', 'Youth'], ['hats', 'Hats & Beanies'],
];
const catName = (c) => (CATS.find((x) => x[0] === c) || [c, c])[1];

function media(item, cls, eager) {
  if (item.photo) return `<img class="${cls}" src="${esc(item.photo)}" alt="${esc(item.title || item.name)}"${eager ? '' : ' loading="lazy"'}>`;
  return `<div class="${cls} ph"><img src="/img/ph/${esc(item.style || 'tee')}.svg" alt=""><span>Photo coming soon</span></div>`;
}

/* ---------- layout ---------- */
function layout({ title, desc, path, image, body, robots, scripts, promo }) {
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
<meta name="theme-color" content="#ffffff">
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
<link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/site.css">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Imagepro Screenprint',
    description: 'Custom screen printing, embroidery, patch hats, package deals and online ordering for businesses, teams and events in Southern Maine.',
    telephone: TEL, email: EMAIL, image: site + '/img/og.jpg', url: site + '/',
    address: { '@type': 'PostalAddress', addressLocality: 'Biddeford', addressRegion: 'ME', postalCode: '04005', addressCountry: 'US' },
    areaServed: ['Biddeford', 'Saco', 'Scarborough', 'Portland', 'Kennebunk', 'Arundel', 'Wells', 'Limerick', 'Waterboro', 'York County, ME'],
    sameAs: [FB_URL, IG_URL],
  }).replace(/</g, '\\u003c')}</script>
</head>
<body>
<div class="util">
  <span>Biddeford, Maine · Free proof on every order</span>
  <nav aria-label="Help"><a href="/#quote">Get a quote</a><a href="mailto:${EMAIL}">Email us</a><a href="tel:${TEL}">${PHONE}</a></nav>
</div>
<header class="hdr">
  <a class="hdr-logo" href="/" aria-label="Imagepro Screenprint home"><img src="/img/logo-wordmark.png" alt="Imagepro Screenprint" width="1400" height="337"></a>
  <nav class="hdr-nav" id="nav" aria-label="Main">
    <a href="/packages">Package Deals</a>
    <a href="/custom">Custom Order</a>
    <a href="/custom?cat=tees">Tees</a>
    <a href="/custom?cat=hoodies">Hoodies</a>
    <a href="/custom?cat=hats">Hats</a>
    <a href="/#stores">Team Stores</a>
    <span class="nav-extra"><a href="/#quote">Get a quote</a><a href="tel:${TEL}">Call ${PHONE}</a><a href="${FB_URL}" target="_blank" rel="noopener" data-social="facebook">Facebook</a><a href="${IG_URL}" target="_blank" rel="noopener" data-social="instagram">Instagram</a></span>
  </nav>
  <div class="hdr-icons">
    <a class="ico" href="${FB_URL}" target="_blank" rel="noopener" aria-label="Imagepro on Facebook" data-social="facebook">${ICON.fb}</a>
    <a class="ico" href="${IG_URL}" target="_blank" rel="noopener" aria-label="Imagepro on Instagram" data-social="instagram">${ICON.ig}</a>
    <a class="ico bag" href="/bag" aria-label="Bag">${ICON.bag}<span class="bag-n" id="bagN" hidden>0</span></a>
    <button class="menu" id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><span></span><span></span></button>
  </div>
</header>
${promo === false ? '' : `<div class="promo"><p><b>Package deals are here.</b> Grab a package, upload your logo, we print it. <a href="/packages">Shop packages</a></p></div>`}
<main>
${body}
</main>
<footer class="foot">
  <div class="foot-cols">
    <div><h4>Shop</h4><a href="/packages">Package Deals</a><a href="/custom">Custom Order</a><a href="/custom?cat=tees">T-Shirts</a><a href="/custom?cat=hoodies">Hoodies</a><a href="/custom?cat=hats">Hats &amp; Beanies</a><a href="/custom?cat=youth">Youth</a></div>
    <div><h4>Help</h4><a href="/#quote">Get a quote</a><a href="tel:${TEL}">Call or text ${PHONE}</a><a href="mailto:${EMAIL}">${EMAIL}</a><a href="/#proofs">How proofs work</a></div>
    <div><h4>Imagepro</h4><a href="/#work">Our work</a><a href="/#stores">Team &amp; crew stores</a><a href="/#reviews">Reviews</a><a href="/#area">Where we work</a></div>
    <div class="foot-social"><a href="${FB_URL}" target="_blank" rel="noopener" aria-label="Facebook" data-social="facebook">${ICON.fb}</a><a href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram" data-social="instagram">${ICON.ig}</a></div>
  </div>
  <div class="foot-bar"><span>© ${new Date().getFullYear()} Imagepro Screenprint · Biddeford, Maine</span><a class="credit" href="https://getrealeasysites.com" target="_blank" rel="noopener">Website by Real Easy Sites</a></div>
</footer>
<nav class="dock" aria-label="Quick contact">
  <a href="tel:${TEL}">Call</a><a href="sms:${TEL}">Text</a><a class="dock-go" href="/packages">Shop</a>
</nav>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/js/track.js" defer></script>
<script src="/js/store.js" defer></script>
${(scripts || []).map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

/* ---------- cards ---------- */
function packageCard(p) {
  const colors = P.list(p.colors);
  const per = p.sell_mode === 'pack' ? Math.round(p.price_cents / p.pack_qty) : p.price_cents;
  return `<a class="pcard" href="/packages/${esc(p.slug)}" data-group="${esc(p.group_name)}" data-qty="${p.sell_mode === 'pack' ? p.pack_qty : 0}">
    ${media(p, 'pcard-img')}
    <div class="pcard-meta">
      ${p.badge ? `<p class="flag">${esc(p.badge)}</p>` : ''}
      <h3>${esc(p.title)}</h3>
      <p class="sub">${p.sell_mode === 'pack' ? `${p.pack_qty} pieces · ` : ''}${esc(p.garment || STYLE_LABEL[p.style] || '')}</p>
      ${colors.length ? `<p class="sub">${colors.length} Color${colors.length > 1 ? 's' : ''}</p>` : ''}
      <p class="price">${O.money(p.price_cents)}${p.sell_mode === 'pack' ? ` <span>${O.money(per)}/pc</span>` : ''}</p>
    </div>
  </a>`;
}

function productCard(p) {
  const b = P.breaksOf(p);
  const from = b.length ? b[b.length - 1][1] : 0;
  const colors = P.list(p.colors);
  return `<a class="pcard" href="/custom/${esc(p.slug)}" data-cat="${esc(p.category)}">
    ${media(p, 'pcard-img')}
    <div class="pcard-meta">
      <h3>${esc(p.name)}</h3>
      <p class="sub">${esc(p.garment || catName(p.category))}</p>
      ${colors.length ? `<p class="sub">${colors.length} Color${colors.length > 1 ? 's' : ''} · Min ${p.min_qty}</p>` : ''}
      <p class="price">From ${O.money(from)}<span> each</span></p>
    </div>
  </a>`;
}

/* ---------- home ---------- */
function homePage(packages) {
  const gal = [
    ['tees', '/img/work/dc-concrete.jpg', 'DC Concrete · Custom tee'], ['hats', '/img/work/field-service-cap-grey.jpg', 'Field Service · Patch cap'],
    ['tees hats', '/img/work/207-paint-co.jpg', '207 Paint Co · Tee & cap'], ['hoodies', '/img/work/catchem-up-sportfishing.jpg', 'Catchem Up Sportfishing · Hoodie'],
    ['hats', '/img/work/salazar-landscaping-patch.jpg', 'Salazar Landscaping & Painting · Patch hat'], ['tees', '/img/work/berry-whipz.jpg', 'Berry Whipz Mobile · Full-color tee'],
    ['hats tees', '/img/work/seavey-builders-hats.jpg', 'Seavey Builders · Hats & tee'], ['hoodies', '/img/work/walkers-excavation.jpg', "Walker's Excavation & Construction"],
    ['hats', '/img/work/two-brothers-beanies.jpg', 'Two Brothers Lawn Care · Beanies'], ['tees', '/img/work/nappi-autoworks.jpg', 'Nappi Autoworks · Tee'],
    ['hivis', '/img/work/patricks-landscaping-vest.jpg', "Patrick's Landscaping · Hi-vis vest"], ['hats', '/img/work/field-service-cap-camo.jpg', 'Field Service · Camo cap'],
    ['tees', '/img/work/two-brothers-lawn-care.jpg', 'Two Brothers Lawn Care · Crew tee'], ['hoodies', '/img/work/dnb-trucking.jpg', 'DNB Trucking · Hoodie'],
    ['tees', '/img/work/maine-4h-dairy-team.jpg', 'Maine 4-H Dairy Team · Team shirt'],
    ['hats', '/img/work/imagepro-patch-cap.jpg', 'Imagepro · Our own patch cap'],
  ];
  const body = `
<section class="hero">
  <div class="hero-media"><img src="/img/work/catchem-up-sportfishing.jpg" alt="Full-color custom hoodie printed by Imagepro for Catchem Up Sportfishing" width="1100" height="825"></div>
  <div class="hero-copy">
    <img class="hero-logo" src="/img/logo-wordmark.png" alt="Imagepro Screenprint" width="1400" height="337">
    <h1>Dress like a pro.</h1>
    <p>Custom screen printing, embroidery and patch hats for crews, teams and businesses across Southern Maine.</p>
    <div class="hero-btns"><a class="pill pill-black" href="/packages" data-quote>Shop Package Deals</a><a class="pill pill-line" href="/custom" data-quote>Build a Custom Order</a></div>
  </div>
</section>

<section class="sec" id="packages">
  <div class="row-head"><h2>Package Deals</h2><div class="row-tools"><a class="link-u" href="/packages">Shop all</a><button class="arrow" data-scroll="pkgRow" data-dir="-1" aria-label="Scroll left">${ICON.arrowL}</button><button class="arrow" data-scroll="pkgRow" data-dir="1" aria-label="Scroll right">${ICON.arrowR}</button></div></div>
  <div class="rail" id="pkgRow">${packages.map(packageCard).join('')}</div>
</section>

<section class="sec">
  <div class="row-head"><h2>Shop by Category</h2></div>
  <div class="cats">
    <a class="cat" href="/custom?cat=tees"><img src="/img/work/dc-concrete.jpg" alt="Custom printed tee" loading="lazy"><span class="cat-label">T-Shirts</span><span class="pill pill-white">Shop</span></a>
    <a class="cat" href="/custom?cat=hoodies"><img src="/img/work/walkers-excavation.jpg" alt="Custom printed hoodie" loading="lazy"><span class="cat-label">Hoodies &amp; Crewnecks</span><span class="pill pill-white">Shop</span></a>
    <a class="cat" href="/custom?cat=hats"><img src="/img/work/field-service-cap-grey.jpg" alt="Custom patch hat" loading="lazy"><span class="cat-label">Hats &amp; Beanies</span><span class="pill pill-white">Shop</span></a>
    <a class="cat" href="/custom?cat=youth"><img src="/img/work/maine-4h-dairy-team.jpg" alt="Custom team shirt" loading="lazy"><span class="cat-label">Youth &amp; Teams</span><span class="pill pill-white">Shop</span></a>
  </div>
</section>

<section class="sec feature" id="proofs">
  <div class="feature-media"><img src="/img/work/salazar-landscaping-patch.jpg" alt="Custom patch hat" loading="lazy"></div>
  <div class="feature-copy">
    <p class="kicker">Custom Order</p>
    <h2>Built your way.</h2>
    <p>Pick your blank, your colors and your sizes. Choose where the print goes and how many ink colors. Upload your logo and check out. You'll see the price before you pay.</p>
    <p>Every order comes with a <b>free proof</b>. We print only after you approve it.</p>
    <a class="pill pill-black" href="/custom" data-quote>Start a Custom Order</a>
  </div>
</section>

<section class="stores" id="stores">
  <div class="stores-in">
    <p class="kicker">Team &amp; Crew Stores</p>
    <h2>Stop chasing sizes on a clipboard.</h2>
    <p>Ordering for a whole crew, team or fundraiser? We set up an online store with your designs. Share one link, everyone orders their own size and pays for their own gear, and we print it all together.</p>
    <a class="pill pill-yellow" href="#quote" data-prefill="Team / crew store">Ask About a Store</a>
  </div>
</section>

<section class="sec" id="work">
  <div class="row-head"><h2>Fresh Off the Press</h2>
    <div class="chips" role="group" aria-label="Filter work"><button class="chip on" data-filter="all">All</button><button class="chip" data-filter="tees">Tees</button><button class="chip" data-filter="hoodies">Hoodies</button><button class="chip" data-filter="hats">Hats</button><button class="chip" data-filter="hivis">Hi-Vis</button></div>
  </div>
  <div class="gallery" id="gallery">${gal.map((g) => `<figure data-cat="${g[0]}"><button type="button" class="g-btn"><img src="${g[1]}" alt="${esc(g[2])}" loading="lazy"></button><figcaption>${esc(g[2])}</figcaption></figure>`).join('')}</div>
</section>

<section class="sec essentials">
  <h2>What We Print</h2>
  <div class="ess">
    <div><h3>Screen Printing</h3><p>Bold, durable ink for crew tees, hoodies and team orders.</p><a href="/custom?cat=tees">Shop tees</a></div>
    <div><h3>Embroidery</h3><p>Stitched logos on hats, polos and jackets.</p><a href="/custom?cat=hats">Shop hats</a></div>
    <div><h3>Patch Hats</h3><p>Raised custom patches on flat bills, truckers and beanies.</p><a href="/custom?cat=hats">Shop hats</a></div>
    <div><h3>Digital Print</h3><p>Full color and fine detail for smaller runs.</p><a href="#quote" data-prefill="Something else">Get a quote</a></div>
    <div><h3>Hi-Vis &amp; Safety</h3><p>Vests and safety wear with your name on the back.</p><a href="#quote" data-prefill="Hi-vis / safety wear">Get a quote</a></div>
    <div><h3>Logo Design</h3><p>No logo yet? We design it or clean it up for print.</p><a href="#quote" data-prefill="Logo design">Get a quote</a></div>
  </div>
</section>

<section class="reviews" id="reviews">
  <p class="big-stat">98%</p>
  <p class="stat-cap">of Facebook reviewers recommend Imagepro · <a href="${FB_URL}/reviews" target="_blank" rel="noopener" data-social="facebook">24 reviews</a></p>
  <blockquote>“Brian is a great guy to deal with. Very reasonably priced, quality work. Would highly recommend.”</blockquote>
  <p class="who">Niko Seavey, Facebook review</p>
</section>

<section class="sec quote" id="quote">
  <div class="quote-copy">
    <h2>Need something different?</h2>
    <p>Hi-vis, digital print, logo design, promo products, or a big job you'd rather talk through. Tell us what you need and we'll get back to you with a price.</p>
    <ul class="contact">
      <li><span>Call or text</span><a href="tel:${TEL}">${PHONE}</a></li>
      <li><span>Email</span><a href="mailto:${EMAIL}">${EMAIL}</a></li>
      <li id="area"><span>Serving</span>Biddeford, Saco, Scarborough, Portland, Kennebunk, Arundel, Wells, Limerick, Waterboro and all of York County</li>
    </ul>
  </div>
  <form class="qform" id="quoteForm" novalidate>
    <div class="hp" aria-hidden="true"><label>Company <input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>
    <input type="hidden" name="source" id="srcField">
    <div class="two"><label>Name *<input name="name" required autocomplete="name"></label><label>Phone *<input name="phone" type="tel" required autocomplete="tel"></label></div>
    <label>Email<input name="email" type="email" autocomplete="email"></label>
    <div class="two">
      <label>What do you need?<select name="item" id="itemSel"><option value="">Choose one</option><option>T-shirts</option><option>Hoodies / sweatshirts</option><option>Hats / beanies</option><option>Hi-vis / safety wear</option><option>Team / crew store</option><option>Logo design</option><option>Promo products</option><option>Something else</option></select></label>
      <label>How many?<select name="quantity"><option value="">Not sure yet</option><option>1 to 11</option><option>12 to 24</option><option>25 to 49</option><option>50 to 99</option><option>100+</option></select></label>
    </div>
    <div class="two">
      <label>Print type<select name="method"><option value="">Help me pick</option><option>Screen printing</option><option>Embroidery</option><option>Digital print</option><option>Patch</option></select></label>
      <label>Needed by<input name="deadline" placeholder="Date or event"></label>
    </div>
    <label>Tell us about the job<textarea name="details" rows="4" placeholder="Colors, sizes, where the print goes"></textarea></label>
    <fieldset class="pref"><legend>Best way to reach you</legend><label><input type="radio" name="contact_pref" value="Call" checked> Call</label><label><input type="radio" name="contact_pref" value="Text"> Text</label><label><input type="radio" name="contact_pref" value="Email"> Email</label></fieldset>
    <button class="pill pill-black wide" type="submit" id="quoteBtn">Send My Request</button>
    <p class="form-msg" id="quoteMsg" role="status" aria-live="polite"></p>
  </form>
</section>

<div class="lightbox" id="lightbox" hidden><button class="lb-x" id="lbClose" aria-label="Close">×</button><button class="lb-nav lb-prev" id="lbPrev" aria-label="Previous">‹</button><img id="lbImg" alt=""><button class="lb-nav lb-next" id="lbNext" aria-label="Next">›</button><p id="lbCap"></p></div>`;
  return layout({
    title: 'Imagepro Screenprint | Custom Screen Printing, Embroidery & Package Deals in Biddeford, ME',
    desc: 'Shop package deals or build a custom order online: screen printed tees, hoodies, youth apparel and patch hats with a free proof before we print. Biddeford, Maine.',
    path: '/',
    body,
    scripts: ['/js/home.js'],
  });
}

/* ---------- package deals ---------- */
function packagesPage(packages) {
  const groups = [...new Set(packages.map((p) => p.group_name))];
  const qtys = [...new Set(packages.filter((p) => p.sell_mode === 'pack').map((p) => p.pack_qty))].sort((a, b) => b - a);
  const body = `
<section class="plp">
  <div class="plp-head"><h1>Package Deals <span id="plpCount">(${packages.length})</span></h1><p>Our best prices on the blanks crews order most. Pick your color and sizes, upload your logo, and we'll send a free proof before we print.</p></div>
  <div class="plp-wrap">
    <aside class="filters" aria-label="Filters">
      <h2>Style</h2>${groups.map((g) => `<label><input type="checkbox" class="f-group" value="${esc(g)}"> ${esc(g)}</label>`).join('')}
      ${qtys.length ? `<h2>Quantity</h2>${qtys.map((q) => `<label><input type="checkbox" class="f-qty" value="${q}"> ${q} pieces</label>`).join('')}` : ''}
      <div class="note"><b>Need more ink colors or a second print location?</b> <a href="/custom">Build a custom order</a> instead.</div>
    </aside>
    <div class="grid" id="plpGrid">${packages.length ? packages.map(packageCard).join('') : '<p class="empty">No packages right now. <a href="/custom">Build a custom order</a>.</p>'}</div>
  </div>
</section>`;
  return layout({ title: 'Package Deals | Imagepro Screenprint', desc: 'Package deals on custom printed tees, long sleeves, hoodies and youth shirts. Free proof before we print.', path: '/packages', body, scripts: ['/js/plp.js'] });
}

function sizeGrid(sizes, plus, plusCents) {
  return `<div class="sizes">${sizes.map((s) => `<label class="size"><span>${esc(s)}${plus.includes(s) && plusCents ? `<small>+${O.money(plusCents)}</small>` : ''}</span><input type="number" min="0" max="5000" inputmode="numeric" placeholder="0" data-size="${esc(s)}" aria-label="Quantity in size ${esc(s)}"></label>`).join('')}</div>`;
}
function colorPick(colors) {
  return `<div class="swatches" role="radiogroup" aria-label="Color">${colors.map((c, i) => `<label class="sw" title="${esc(c)}"><input type="radio" name="color" value="${esc(c)}"${i === 0 ? ' checked' : ''}><i style="background:${swatch(c)}"></i><span class="sr">${esc(c)}</span></label>`).join('')}</div>`;
}
function logoBox() {
  return `<label class="drop"><input type="file" name="artwork" accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.ai,.eps,.psd"><span class="drop-txt"><b>Upload your logo</b><small>PNG, JPG, PDF, AI, EPS or SVG · up to 20 MB · a phone photo works</small></span></label>
    <label class="check"><input type="checkbox" name="no_logo" value="1"> I don't have a logo file yet. Help me with it.</label>`;
}
const perks = `<ul class="perks"><li>${ICON.check}Free proof. We print only after you approve it.</li><li>${ICON.check}Pick up in Biddeford or local delivery</li><li>${ICON.check}Questions? Call or text <a href="tel:${TEL}">${PHONE}</a></li></ul>`;
const share = (url, title) => `<div class="share" data-url="${esc(url)}" data-title="${esc(title)}"><span>Share</span><button type="button" data-share="copy">Copy link</button><a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" data-social="facebook">Facebook</a><button type="button" data-share="native" hidden>More…</button></div>`;

function packagePage(p) {
  const colors = P.list(p.colors), sizes = P.list(p.sizes), plus = P.list(p.plus_sizes), locs = P.list(p.locations);
  const per = p.sell_mode === 'pack' ? Math.round(p.price_cents / p.pack_qty) : p.price_cents;
  const url = O.site() + '/packages/' + p.slug;
  const data = { id: p.id, mode: p.sell_mode, pack: p.pack_qty, price: p.price_cents, plus, plusCents: p.plus_cents, needsLogo: !!p.needs_logo };
  const body = `
<section class="pdp">
  <div class="pdp-media">${media(p, 'pdp-img', true)}</div>
  <form class="pdp-buy" id="buyForm" data-kind="package" data-cfg="${esc(JSON.stringify(data))}" novalidate>
    ${p.is_sample ? '<p class="sample">Sample package · prices shown are placeholders</p>' : ''}
    ${p.badge ? `<p class="flag">${esc(p.badge)}</p>` : ''}
    <h1>${esc(p.title)}</h1>
    <p class="pdp-sub">${p.sell_mode === 'pack' ? `${p.pack_qty} Piece Package · ` : ''}${esc(p.garment || STYLE_LABEL[p.style] || '')}</p>
    <p class="pdp-price">${O.money(p.price_cents)}${p.sell_mode === 'pack' ? ` <small>${O.money(per)} per piece</small>` : ' <small>each</small>'}</p>
    ${p.includes ? `<p class="pdp-inc">Includes ${esc(p.includes)}.</p>` : ''}
    ${p.blurb ? `<p class="pdp-blurb">${esc(p.blurb)}</p>` : ''}
    ${colors.length ? `<fieldset class="opt"><legend>Select Color <b id="colorName">${esc(colors[0])}</b></legend>${colorPick(colors)}</fieldset>` : ''}
    <fieldset class="opt"><legend>Select Sizes ${p.sell_mode === 'pack' ? `<b>must add up to ${p.pack_qty}</b>` : ''}</legend>
      ${sizeGrid(sizes.length ? sizes : ['One size'], plus, p.plus_cents)}
      ${p.sell_mode === 'pack' ? `<div class="meter"><div class="meter-bar"><i id="meterFill"></i></div><p id="meterTxt">0 of ${p.pack_qty} pieces</p></div>` : ''}
    </fieldset>
    ${locs.length > 1 ? `<fieldset class="opt"><legend>Print Location</legend><div class="seg">${locs.map((l, i) => `<label><input type="radio" name="location" value="${esc(l)}"${i === 0 ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>` : locs.length ? `<input type="hidden" name="location" value="${esc(locs[0])}">` : ''}
    ${p.needs_logo ? `<fieldset class="opt"><legend>Your Logo</legend>${logoBox()}</fieldset>` : ''}
    <label class="opt notes">Notes for the shop<textarea name="notes" rows="2" placeholder="Ink color, logo size, anything we should know"></textarea></label>
    <div class="pdp-total"><span>Total</span><b id="liveTotal">${O.money(p.price_cents)}</b></div>
    <button class="pill pill-black wide big" type="submit" id="addBtn">Add to Bag</button>
    <p class="form-msg" id="buyMsg" role="status" aria-live="polite"></p>
    ${perks}
    <details class="acc"><summary>What's included</summary><p>${esc(p.includes || 'Printing on one location.')}. ${p.plus_cents && plus.length ? `${plus.join(', ')} add ${O.money(p.plus_cents)} each.` : ''} Need more ink colors or a second location? <a href="/custom">Build a custom order</a>.</p></details>
    <details class="acc"><summary>How ordering works</summary><p>Add your package to the bag and check out. We email you a free proof of your logo on the garment, you approve it (or ask for changes), and then we print. You'll get an email when it's ready.</p></details>
    ${share(url, p.title)}
  </form>
</section>`;
  return layout({ title: `${p.title} | Imagepro Screenprint`, desc: `${O.money(p.price_cents)} for ${p.sell_mode === 'pack' ? p.pack_qty + ' pieces' : 'each'}. ${p.blurb || ''}`.slice(0, 200), path: '/packages/' + p.slug, image: p.photo || '/img/og.jpg', body, scripts: ['/js/buy.js'] });
}

/* ---------- custom order ---------- */
function customPage(products) {
  const used = CATS.filter((c) => products.some((p) => p.category === c[0]));
  const body = `
<section class="plp">
  <div class="plp-head"><h1>Custom Order <span id="plpCount">(${products.length})</span></h1><p>Pick a blank to start. Choose your colors, sizes, print locations and ink colors, upload your logo, and see your price before you check out.</p></div>
  <div class="tabs" role="group" aria-label="Category"><button class="tab on" data-cat="">All</button>${used.map((c) => `<button class="tab" data-cat="${c[0]}">${esc(c[1])}</button>`).join('')}</div>
  <div class="grid grid-4" id="plpGrid">${products.map(productCard).join('')}</div>
</section>`;
  return layout({ title: 'Custom Order | Imagepro Screenprint', desc: 'Build a custom order online: tees, long sleeves, hoodies, crewnecks, youth and hats. Pick colors, sizes, print locations and ink colors, upload your logo.', path: '/custom', body, scripts: ['/js/plp.js'] });
}

function configurePage(p, S) {
  const colors = P.list(p.colors), sizes = P.list(p.sizes), plus = P.list(p.plus_sizes), breaks = P.breaksOf(p);
  const url = O.site() + '/custom/' + p.slug;
  const data = { id: p.id, kind: p.kind, min: p.min_qty, breaks, plus, plusCents: p.plus_cents, extraInk: S.extraInkCents, extraLoc: S.extraLocationCents, maxLoc: S.maxLocations, deco: S.hatDecorations, extras: S.hatExtras };
  const prints = p.kind === 'hat'
    ? `<fieldset class="opt"><legend>Decoration</legend><div class="cards2">${S.hatDecorations.map((d, i) => `<label class="cardopt"><input type="radio" name="decoration" value="${esc(d.id)}"${i === 0 ? ' checked' : ''}><span><b>${esc(d.name)}</b>${d.blurb ? `<small>${esc(d.blurb)}</small>` : ''}<em>${d.cents ? '+' + O.money(d.cents) + ' each' : 'Included'}</em></span></label>`).join('')}</div></fieldset>
       ${S.hatExtras.length ? `<fieldset class="opt"><legend>Add-ons</legend>${S.hatExtras.map((x) => `<label class="check"><input type="checkbox" name="extra" value="${esc(x.id)}"> ${esc(x.name)} <small>+${O.money(x.cents)} each</small></label>`).join('')}</fieldset>` : ''}`
    : `<fieldset class="opt"><legend>Print Locations <b>first location included</b></legend>
        <div class="locs">${S.locations.map((l, i) => `<div class="loc"><label class="check"><input type="checkbox" name="loc" value="${esc(l)}"${i === 0 ? ' checked' : ''}> ${esc(l)}</label>
          <label class="inks"><span>Ink colors</span> <select data-inks="${esc(l)}" aria-label="Ink colors for ${esc(l)}">${Array.from({ length: S.maxInks }, (_, k) => `<option value="${k + 1}">${k + 1} color${k ? `s (+${O.money(S.extraInkCents * k)} ea)` : ''}</option>`).join('')}</select></label></div>`).join('')}</div>
        <p class="hint">Each extra location adds ${O.money(S.extraLocationCents)} a piece. Each extra ink color adds ${O.money(S.extraInkCents)} a piece.</p>
      </fieldset>`;
  const body = `
<section class="pdp">
  <div class="pdp-media">${media(p, 'pdp-img', true)}
    <table class="breaks" aria-label="Price per piece"><caption>Price per piece, 1 color, 1 location</caption><tr>${breaks.map((b) => `<th>${b[0]}+</th>`).join('')}</tr><tr>${breaks.map((b) => `<td>${O.money(b[1])}</td>`).join('')}</tr></table>
  </div>
  <form class="pdp-buy" id="buyForm" data-kind="custom" data-cfg="${esc(JSON.stringify(data))}" novalidate>
    ${p.is_sample ? '<p class="sample">Sample item · prices shown are placeholders</p>' : ''}
    <p class="flag">${esc(catName(p.category))}</p>
    <h1>${esc(p.name)}</h1>
    <p class="pdp-sub">${esc(p.garment || '')} · Minimum ${p.min_qty}</p>
    <p class="pdp-price" id="livePer">From ${O.money(breaks.length ? breaks[breaks.length - 1][1] : 0)} <small>each</small></p>
    ${p.blurb ? `<p class="pdp-blurb">${esc(p.blurb)}</p>` : ''}
    ${colors.length ? `<fieldset class="opt"><legend>Select Color <b id="colorName">${esc(colors[0])}</b></legend>${colorPick(colors)}</fieldset>` : ''}
    <fieldset class="opt"><legend>${sizes.length > 1 ? 'Select Sizes &amp; Quantities' : 'Quantity'} <b>min ${p.min_qty}</b></legend>${sizeGrid(sizes.length ? sizes : ['One size'], plus, p.plus_cents)}</fieldset>
    ${prints}
    <fieldset class="opt"><legend>Your Logo</legend>${logoBox()}</fieldset>
    <label class="opt notes">Notes for the shop<textarea name="notes" rows="2" placeholder="Ink colors, logo size, thread colors, anything we should know"></textarea></label>
    <div class="pdp-total"><span id="liveQty">0 pieces</span><b id="liveTotal">$0</b></div>
    <p class="nudge" id="nudge">Minimum ${p.min_qty} pieces.</p>
    <button class="pill pill-black wide big" type="submit" id="addBtn">Add to Bag</button>
    <p class="form-msg" id="buyMsg" role="status" aria-live="polite"></p>
    ${perks}
    ${share(url, p.name)}
  </form>
</section>`;
  return layout({ title: `${p.name}, Custom | Imagepro Screenprint`, desc: `Custom ${p.name.toLowerCase()} with your logo. ${p.blurb || ''} Minimum ${p.min_qty}.`, path: '/custom/' + p.slug, image: p.photo || '/img/og.jpg', body, scripts: ['/js/buy.js'] });
}

/* ---------- bag + checkout ---------- */
function bagPage(items, totals) {
  const rows = items.length
    ? items.map((it) => `<article class="bag-item" data-id="${it.id}">
        ${it.price.error ? `<div class="bag-img ph"><img src="/img/ph/tee.svg" alt=""></div>` : `<div class="bag-img ph"><img src="/img/ph/${esc(it.price.style || 'tee')}.svg" alt=""></div>`}
        <div class="bag-info">
          <h3>${esc(it.price.error ? 'Item needs attention' : it.price.title)}</h3>
          ${it.price.error ? `<p class="err">${esc(it.price.error)}</p>` : `<p class="sub">${it.price.details.map(esc).join('<br>')}</p>`}
          <p class="sub">${it.artwork_name ? 'Logo: ' + esc(it.artwork_name) : it.no_logo ? 'Logo: needs help with logo' : it.price.needsLogo === false ? '' : 'Logo: none uploaded'}</p>
          ${it.notes ? `<p class="sub">Notes: ${esc(it.notes)}</p>` : ''}
          <button type="button" class="link-u rm" data-rm="${it.id}">Remove</button>
        </div>
        <p class="bag-price">${it.price.error ? '' : O.money(it.price.line)}</p>
      </article>`).join('')
    : `<div class="bag-empty"><p>There are no items in your bag.</p><a class="pill pill-black" href="/packages">Shop Package Deals</a> <a class="pill pill-line" href="/custom">Build a Custom Order</a></div>`;
  const ok = items.length && !items.some((i) => i.price.error);
  const body = `
<section class="bagpage">
  <div class="bag-list"><h1>Bag</h1>${rows}</div>
  <aside class="summary">
    <h2>Summary</h2>
    <dl><div><dt>Subtotal</dt><dd>${O.money(totals.subtotal)}</dd></div>${totals.tax ? `<div><dt>Sales tax</dt><dd>${O.money(totals.tax)}</dd></div>` : ''}<div><dt>Pickup / local delivery</dt><dd>Free</dd></div><div class="tot"><dt>Total</dt><dd>${O.money(totals.total)}</dd></div></dl>
    ${ok ? `<form id="checkout" class="co" novalidate>
      <div class="hp" aria-hidden="true"><label>Company <input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>
      <label>Name *<input name="name" autocomplete="name" required></label>
      <label>Phone *<input name="phone" type="tel" autocomplete="tel" required></label>
      <label>Email * <small>(your proof and updates go here)</small><input name="email" type="email" autocomplete="email" required></label>
      <fieldset class="seg"><label><input type="radio" name="fulfillment" value="pickup" checked><span>Pick up in Biddeford</span></label><label><input type="radio" name="fulfillment" value="delivery"><span>Local delivery</span></label></fieldset>
      <label class="addr" hidden>Delivery address<input name="address" autocomplete="street-address"></label>
      <label>Need it by? <small>(optional)</small><input name="need_by" placeholder="Date or event"></label>
      <label>Order notes <small>(optional)</small><textarea name="notes" rows="2"></textarea></label>
      <button class="pill pill-black wide big" type="submit" id="coBtn">Checkout</button>
      <p class="form-msg" id="coMsg" role="status" aria-live="polite"></p>
      <p class="fine">You'll get a free proof to approve before anything is printed.</p>
    </form>` : items.length ? '<p class="err">Remove or fix the items marked above to check out.</p>' : ''}
  </aside>
</section>`;
  return layout({ title: 'Bag | Imagepro Screenprint', path: '/bag', robots: 'noindex', body, scripts: ['/js/bag.js'], promo: false });
}

function itemsTable(o) {
  return `<div class="o-items">${O.itemsOf(o).map((i) => `<div class="o-item"><div class="bag-img ph"><img src="/img/ph/${esc(i.style || 'tee')}.svg" alt=""></div><div><h3>${esc(i.title)}</h3><p class="sub">${i.details.map(esc).join('<br>')}${i.artwork_name ? '<br>Logo: ' + esc(i.artwork_name) : ''}${i.notes ? '<br>Notes: ' + esc(i.notes) : ''}</p></div><p class="bag-price">${O.money(i.line)}</p></div>`).join('')}</div>`;
}
function totalsBlock(o) {
  return `<dl class="o-tot">${o.tax_cents ? `<div><dt>Subtotal</dt><dd>${O.money(o.subtotal_cents)}</dd></div><div><dt>Sales tax</dt><dd>${O.money(o.tax_cents)}</dd></div>` : ''}<div class="tot"><dt>Total</dt><dd>${O.money(o.total_cents)}</dd></div></dl>`;
}

function demoCheckoutPage(o) {
  const body = `<section class="checkout">
    <div><h1>Pay for ${esc(O.ref(o))}</h1>
      <p class="demo-note"><b>Demo mode.</b> No card is charged. Once Imagepro connects a Stripe account, this step becomes Stripe's secure checkout page.</p>
      <div class="fake-card" aria-hidden="true"><span>Card number</span><div>4242 4242 4242 4242</div><span>Expiry / CVC</span><div>12 / 34 · 123</div></div>
      <button class="pill pill-black wide big" id="demoPay" data-token="${esc(o.token)}">Pay ${O.money(o.total_cents)} (demo)</button>
      <p class="form-msg" id="payMsg" role="status"></p></div>
    <aside class="summary">${itemsTable(o)}${totalsBlock(o)}</aside>
  </section>`;
  return layout({ title: `Checkout ${O.ref(o)} | Imagepro Screenprint`, path: '/checkout/demo/' + o.token, robots: 'noindex,nofollow', body, scripts: ['/js/status.js'], promo: false });
}

function statusPage(o, flash) {
  const flow = o.needs_mockup ? ['paid', 'mockup_sent', 'approved', 'printing', 'ready', 'completed'] : ['paid', 'printing', 'ready', 'completed'];
  const names = { paid: 'Paid', mockup_sent: 'Proof', approved: 'Approved', printing: 'Printing', ready: o.fulfillment === 'delivery' ? 'Ready for delivery' : 'Ready for pickup', completed: 'Done' };
  const at = o.status === 'changes_requested' ? flow.indexOf('mockup_sent') : flow.indexOf(o.status);
  const track = ['awaiting_payment', 'cancelled'].includes(o.status) ? '' : `<ol class="track">${flow.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}">${esc(names[s])}</li>`).join('')}</ol>`;
  const mocks = O.mockupsOf(o);
  let action = '';
  if (o.status === 'awaiting_payment') {
    action = `<div class="panel"><h2>Payment not finished</h2><p>Your order is saved but isn't paid yet.</p><button class="pill pill-black" id="payAgain" data-token="${esc(o.token)}">Finish Checkout</button><p class="form-msg" id="payMsg" role="status"></p></div>`;
  } else if ((o.status === 'mockup_sent' || o.status === 'changes_requested') && mocks.length) {
    action = `<div class="panel proof"><h2>Your proof</h2>
      <div class="proofs">${mocks.map((m, i) => /\.pdf$/i.test(m.file) ? `<a class="pill pill-line" href="/o/${esc(o.token)}/proof/${i}" target="_blank" rel="noopener">Open proof ${mocks.length > 1 ? i + 1 : ''} (PDF)</a>` : `<a href="/o/${esc(o.token)}/proof/${i}" target="_blank" rel="noopener"><img src="/o/${esc(o.token)}/proof/${i}" alt="Proof ${i + 1}"></a>`).join('')}</div>
      ${o.status === 'changes_requested'
        ? `<p>Thanks, we got your notes: “${esc(o.change_note || '')}”. We'll send an updated proof.</p>`
        : `<button class="pill pill-black wide big" id="approveBtn" data-token="${esc(o.token)}">Looks Good, Print It</button>
           <details class="acc"><summary>Something needs to change</summary><textarea id="changeNote" rows="3" placeholder="Tell us what to change"></textarea><button class="pill pill-line" id="changeBtn" data-token="${esc(o.token)}">Send Changes</button></details>
           <p class="form-msg" id="apprMsg" role="status" aria-live="polite"></p>`}
    </div>`;
  }
  const body = `<section class="ostatus">
    ${flash ? `<p class="flash">${esc(flash)}</p>` : ''}
    <p class="kicker">Your order</p>
    <h1>${esc(O.ref(o))} <span class="stamp">${esc(O.statusLabel(o))}</span></h1>
    ${o.payment_mode === 'demo' ? '<p class="sample">Demo order · no card was charged</p>' : ''}
    ${track}${action}
    <div class="ostatus-grid"><div>${itemsTable(o)}${totalsBlock(o)}</div>
      <dl class="facts"><div><dt>Name</dt><dd>${esc(o.name)}</dd></div><div><dt>Getting it</dt><dd>${o.fulfillment === 'delivery' ? 'Local delivery' + (o.address ? ': ' + esc(o.address) : '') : 'Pickup in Biddeford'}</dd></div>${o.need_by ? `<div><dt>Need by</dt><dd>${esc(o.need_by)}</dd></div>` : ''}${o.notes ? `<div><dt>Notes</dt><dd>${esc(o.notes)}</dd></div>` : ''}</dl></div>
    <p class="help">Questions about your order? Call or text <a href="tel:${TEL}">${PHONE}</a>.</p>
  </section>`;
  return layout({ title: `Order ${O.ref(o)} | Imagepro Screenprint`, path: '/o/' + o.token, robots: 'noindex,nofollow', body, scripts: ['/js/status.js'], promo: false });
}

module.exports = { layout, homePage, packagesPage, packagePage, customPage, configurePage, bagPage, demoCheckoutPage, statusPage, CATS };
