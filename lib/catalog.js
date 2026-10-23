// Hat builder catalog + pricing. SAMPLE PRICES for the trial: replace with Imagepro's real price list.
// Prices are in cents. "breaks" = [minimum total hats, price per hat].
const CATALOG = {
  sample: true,
  minimum: 12,
  maxTotal: 5000,
  decorations: [
    {
      id: 'embroidery',
      name: 'Embroidery',
      blurb: 'Your logo stitched right into the front of the hat. Clean, classic, lasts forever.',
      breaks: [[12, 2200], [24, 1900], [48, 1700], [72, 1600], [144, 1400]],
    },
    {
      id: 'patch',
      name: 'Custom patch',
      blurb: 'A raised custom patch with your logo, front and center. The look crews love.',
      breaks: [[12, 2600], [24, 2300], [48, 2000], [72, 1800], [144, 1600]],
    },
  ],
  extras: [
    { id: 'side', name: 'Small logo or flag on the side', cents: 400 },
    { id: 'back', name: 'Text across the back', cents: 400 },
  ],
  styles: [
    {
      id: 'trucker',
      name: 'Trucker cap',
      model: 'Mesh back snapback',
      adj: 0,
      img: '/img/work/field-service-cap-grey.jpg',
      colors: ['Black', 'Charcoal / Black', 'Grey / Black', 'Navy', 'Loden'],
    },
    {
      id: 'flatbill',
      name: 'Flat bill snapback',
      model: '7-panel, flat bill',
      adj: 200,
      img: '/img/work/salazar-landscaping-patch.jpg',
      colors: ['Black', 'Charcoal', 'Camo', 'Grey / Black'],
    },
    {
      id: 'performance',
      name: 'Performance cap',
      model: 'Structured, curved bill',
      adj: 200,
      img: '/img/work/imagepro-patch-cap.jpg',
      colors: ['Black', 'Royal blue', 'Grey', 'White'],
    },
    {
      id: 'beanie',
      name: 'Cuffed beanie',
      model: 'Knit, one size',
      adj: -300,
      img: '/img/work/two-brothers-beanies.jpg',
      colors: ['Black', 'Charcoal', 'Navy', 'Safety orange'],
    },
  ],
  placements: ['Front center', 'Front, slightly left', 'Front, slightly right'],
};

function baseFor(decoration, qty) {
  let price = decoration.breaks[0][1];
  for (const [min, cents] of decoration.breaks) if (qty >= min) price = cents;
  return price;
}

function nextBreak(decoration, qty) {
  const now = baseFor(decoration, qty);
  for (const [min, cents] of decoration.breaks) {
    if (min > qty && cents < now) return { at: min, more: min - qty, cents, save: now - cents };
  }
  return null;
}

// items: [{style, color, qty}]  extras: ['side', ...]
function quote({ decoration, items, extras }) {
  const dec = CATALOG.decorations.find((d) => d.id === decoration);
  if (!dec) return { error: 'Pick embroidery or a custom patch.' };
  const ex = (Array.isArray(extras) ? extras : []).map((id) => CATALOG.extras.find((e) => e.id === id)).filter(Boolean);
  const exCents = ex.reduce((s, e) => s + e.cents, 0);
  const lines = [];
  let total = 0;
  for (const it of Array.isArray(items) ? items : []) {
    const st = CATALOG.styles.find((s) => s.id === it.style);
    const qty = Math.floor(Number(it.qty));
    if (!st || !st.colors.includes(it.color) || !(qty > 0)) continue;
    lines.push({ style: st.id, styleName: st.name, color: it.color, qty });
    total += qty;
  }
  if (total > CATALOG.maxTotal) return { error: 'For orders over ' + CATALOG.maxTotal + ' hats, please call the shop.' };
  const base = baseFor(dec, total);
  let subtotal = 0;
  lines.forEach((l) => {
    const st = CATALOG.styles.find((s) => s.id === l.style);
    l.unit = base + st.adj + exCents;
    l.line = l.unit * l.qty;
    subtotal += l.line;
  });
  const rate = Math.max(0, Number(process.env.TAX_RATE || 0));
  const tax = Math.round(subtotal * rate);
  return {
    decoration: dec.id,
    decorationName: dec.name,
    extras: ex.map((e) => e.name),
    totalQty: total,
    minimum: CATALOG.minimum,
    belowMinimum: total < CATALOG.minimum,
    base,
    next: nextBreak(dec, total),
    lines,
    subtotal,
    taxRate: rate,
    tax,
    total: subtotal + tax,
  };
}

module.exports = { CATALOG, quote };
