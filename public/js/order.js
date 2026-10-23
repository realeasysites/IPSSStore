/* Hat order builder: decoration -> hats -> logo -> checkout, with live quantity-break pricing.
   The server re-prices every order; this is only for display. */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var money = function (c) { return '$' + (c / 100).toFixed(2).replace(/\.00$/, ''); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var SW = { 'black': '#151515', 'charcoal': '#3a3a3c', 'grey': '#9a9a9a', 'navy': '#1e2a4a', 'loden': '#4e5a3a', 'royal blue': '#2347d6', 'white': '#ffffff', 'safety orange': '#ff6a13', 'camo': 'repeating-linear-gradient(45deg,#5b5a3c 0 5px,#7d6e4b 5px 10px,#3f3f2c 10px 14px)' };
  function swatch(name) {
    var parts = name.toLowerCase().split('/').map(function (s) { return s.trim(); });
    if (parts.length === 2) return 'linear-gradient(135deg,' + (SW[parts[0]] || '#888') + ' 50%,' + (SW[parts[1]] || '#888') + ' 50%)';
    return SW[parts[0]] || '#888';
  }

  var form = $('#builder'), C = null, step = 0, LAST = 3;
  var steps = $$('.b-step'), tabs = $$('.b-steps button');
  var nextLabels = ['Next: pick hats', 'Next: upload logo', 'Next: checkout'];

  function state() {
    var decoration = (form.querySelector('input[name=decoration]:checked') || {}).value;
    var extras = $$('input[name=extra]:checked').map(function (i) { return i.value; });
    var items = $$('input[data-style]').map(function (i) {
      return { style: i.getAttribute('data-style'), color: i.getAttribute('data-color'), qty: Math.max(0, Math.floor(Number(i.value) || 0)) };
    }).filter(function (i) { return i.qty > 0; });
    return { decoration: decoration, extras: extras, items: items };
  }

  function price(s) {
    var dec = C.decorations.filter(function (d) { return d.id === s.decoration; })[0];
    var exC = s.extras.reduce(function (t, id) { var e = C.extras.filter(function (x) { return x.id === id; })[0]; return t + (e ? e.cents : 0); }, 0);
    var qty = s.items.reduce(function (t, i) { return t + i.qty; }, 0);
    var base = dec.breaks[0][1];
    dec.breaks.forEach(function (b) { if (qty >= b[0]) base = b[1]; });
    var next = null;
    for (var k = 0; k < dec.breaks.length; k++) { if (dec.breaks[k][0] > qty && dec.breaks[k][1] < base) { next = { at: dec.breaks[k][0], more: dec.breaks[k][0] - qty, save: base - dec.breaks[k][1] }; break; } }
    var sub = 0;
    var lines = s.items.map(function (i) {
      var st = C.styles.filter(function (x) { return x.id === i.style; })[0];
      var unit = base + st.adj + exC;
      sub += unit * i.qty;
      return { name: st.name, color: i.color, qty: i.qty, unit: unit, line: unit * i.qty };
    });
    var tax = Math.round(sub * (C.taxRate || 0));
    return { dec: dec, qty: qty, base: base + exC, next: next, lines: lines, sub: sub, tax: tax, total: sub + tax };
  }

  function render() {
    var s = state(), p = price(s);
    $('#sumDeco').textContent = p.dec.name + (s.extras.length ? ' + ' + s.extras.length + ' add-on' + (s.extras.length > 1 ? 's' : '') : '');
    $('#sumLines').innerHTML = p.lines.length
      ? p.lines.map(function (l) { return '<li><span>' + l.qty + ' × ' + esc(l.name) + '<small>' + esc(l.color) + '</small></span><b>' + money(l.line) + '</b></li>'; }).join('')
      : '<li class="muted">No hats yet</li>';
    $('#sumQty').textContent = p.qty;
    $('#sumEach').textContent = p.qty ? 'from ' + money(p.base) : 'from ' + money(p.dec.breaks[p.dec.breaks.length - 1][1]);
    var br = $('#sumBreak');
    if (p.qty < C.minimum) { br.className = 'sum-break warn'; br.textContent = p.qty ? 'Add ' + (C.minimum - p.qty) + ' more to reach the ' + C.minimum + '-hat minimum.' : 'Minimum ' + C.minimum + ' hats total.'; }
    else if (p.next) { br.className = 'sum-break'; br.textContent = 'Add ' + p.next.more + ' more and every hat drops ' + money(p.next.save) + '.'; }
    else { br.className = 'sum-break good'; br.textContent = 'You’re at the best price.'; }
    $('#sumTaxRow').hidden = !C.taxRate;
    $('#sumTax').textContent = money(p.tax);
    $('#sumTotal').textContent = money(p.total);
    $('#mQty').textContent = p.qty + ' hat' + (p.qty === 1 ? '' : 's');
    $('#mTotal').textContent = money(p.total);
    $('#payBtn').textContent = (C.payment === 'demo' ? 'Continue to checkout · ' : 'Pay ') + money(p.total);
    $('#breakTable').innerHTML = '<caption>' + esc(p.dec.name) + ' price per hat</caption><tr>' +
      p.dec.breaks.map(function (b, i) { var on = p.qty >= b[0] && (i === p.dec.breaks.length - 1 || p.qty < p.dec.breaks[i + 1][0]); return '<th' + (on ? ' class="on"' : '') + '>' + b[0] + '+</th>'; }).join('') + '</tr><tr>' +
      p.dec.breaks.map(function (b, i) { var on = p.qty >= b[0] && (i === p.dec.breaks.length - 1 || p.qty < p.dec.breaks[i + 1][0]); return '<td' + (on ? ' class="on"' : '') + '>' + money(b[1]) + '</td>'; }).join('') + '</tr>';
    return p;
  }

  function build() {
    $('#sampleBanner').hidden = !C.sample;
    $('#minNote').textContent = 'Minimum ' + C.minimum + ' hats total.';
    $('#decoList').innerHTML = C.decorations.map(function (d, i) {
      return '<label class="deco"><input type="radio" name="decoration" value="' + esc(d.id) + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span class="deco-in"><b>' + esc(d.name) + '</b><span>' + esc(d.blurb) + '</span><em>from ' + money(d.breaks[d.breaks.length - 1][1]) + ' a hat</em></span></label>';
    }).join('');
    $('#extraList').innerHTML = C.extras.map(function (e) {
      return '<label class="check"><input type="checkbox" name="extra" value="' + esc(e.id) + '"><i></i>' + esc(e.name) + ' <small>+' + money(e.cents) + '</small></label>';
    }).join('');
    $('#styleList').innerHTML = C.styles.map(function (st) {
      return '<div class="style-row"><img src="' + esc(st.img) + '" alt="" loading="lazy"><div class="style-name"><h3>' + esc(st.name) + '</h3><p>' + esc(st.model) +
        (st.adj ? ' · ' + (st.adj > 0 ? '+' : '−') + money(Math.abs(st.adj)) + ' a hat' : '') + '</p></div><div class="colors">' +
        st.colors.map(function (c) {
          return '<label class="qty-cell"><i style="background:' + swatch(c) + '"></i><span>' + esc(c) + '</span><input type="number" min="0" max="5000" inputmode="numeric" placeholder="0" data-style="' + esc(st.id) + '" data-color="' + esc(c) + '" aria-label="' + esc(st.name + ', ' + c + ', quantity') + '"></label>';
        }).join('') + '</div></div>';
    }).join('');
    $('#placement').innerHTML = C.placements.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('');
    form.addEventListener('input', render);
    form.addEventListener('change', render);
    render();
  }

  function msg(t, ok) { var m = $('#bMsg'); m.className = 'form-msg ' + (t ? (ok ? 'ok' : 'err') : ''); m.textContent = t || ''; }

  function check(n) {
    var s = state(), p = price(s);
    if (n === 0 && !s.decoration) return 'Pick embroidery or a custom patch.';
    if (n === 1 && p.qty < C.minimum) return 'Add at least ' + C.minimum + ' hats total. You have ' + p.qty + '.';
    if (n === 2 && !$('#artwork').files.length && !$('#noLogo').checked) return 'Upload your logo, or check the box if you don’t have one yet.';
    if (n === 3) {
      var f = form.elements;
      if (!f.namedItem('name').value.trim()) return 'Add your name.';
      if (f.namedItem('phone').value.replace(/\D/g, '').length < 7) return 'Add a phone number.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.namedItem('email').value.trim())) return 'Add your email so we can send your mockup.';
      if ((form.querySelector('input[name=fulfillment]:checked') || {}).value === 'delivery' && !f.namedItem('address').value.trim()) return 'Add a delivery address.';
    }
    return '';
  }

  function go(n, scroll) {
    for (var i = 0; i < n; i++) { var e = check(i); if (e) { n = i; msg(e); show(n, scroll); return; } }
    msg('');
    show(n, scroll);
  }
  function show(n, scroll) {
    step = n;
    steps.forEach(function (f, i) { f.hidden = i !== n; });
    tabs.forEach(function (t, i) {
      if (i === n) t.setAttribute('aria-current', 'step'); else t.removeAttribute('aria-current');
      t.classList.toggle('done', i < n);
    });
    $('#backBtn').hidden = n === 0;
    $('#nextBtn').hidden = n === LAST;
    $('#payBtn').hidden = n !== LAST;
    if (n < LAST) $('#nextBtn').textContent = nextLabels[n];
    $('#mNext').textContent = n === LAST ? 'Pay' : 'Next';
    if (scroll !== false) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#nextBtn').addEventListener('click', function () { go(step + 1); });
  $('#backBtn').addEventListener('click', function () { msg(''); show(step - 1); });
  $('#mNext').addEventListener('click', function () { if (step === LAST) form.requestSubmit(); else go(step + 1); });
  tabs.forEach(function (t) { t.addEventListener('click', function () { go(Number(t.getAttribute('data-go'))); }); });

  // logo drop zone
  var drop = $('#drop'), file = $('#artwork'), prev = $('#dropPrev');
  function showFile() {
    var f = file.files[0];
    $('.drop-txt b', drop).textContent = f ? f.name : 'Drop your logo here or tap to choose';
    drop.classList.toggle('has', !!f);
    if (f && /^image\/(png|jpe?g|gif|webp)$/.test(f.type)) { prev.src = URL.createObjectURL(f); prev.hidden = false; } else { prev.hidden = true; }
    if (f) $('#noLogo').checked = false;
  }
  file.addEventListener('change', showFile);
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) { file.files = e.dataTransfer.files; showFile(); } });

  $$('input[name=fulfillment]').forEach(function (r) { r.addEventListener('change', function () { $('.addr', form).hidden = r.value !== 'delivery' || !r.checked; }); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    for (var i = 0; i <= LAST; i++) { var err = check(i); if (err) { msg(err); show(i); return; } }
    var s = state(), fd = new FormData(form);
    fd.delete('decoration'); fd.delete('extra');
    fd.append('decoration', s.decoration);
    fd.append('extras', JSON.stringify(s.extras));
    fd.append('items', JSON.stringify(s.items));
    var q = new URLSearchParams(location.search), src = q.get('utm_source') || q.get('ref') || '';
    try { if (!src && document.referrer) src = new URL(document.referrer).hostname; } catch (x) {}
    fd.append('source', src || 'direct');
    var btn = $('#payBtn'); btn.disabled = true; $('#mNext').disabled = true; msg('Sending your order…', true);
    fetch('/api/orders/custom', { method: 'POST', body: fd })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) { if (window.saTrack) window.saTrack('quote_click', 'hat order'); location.href = res.j.redirect; }
        else { msg(res.j.error || 'Something went wrong. Please call (207) 499-2700.'); btn.disabled = false; $('#mNext').disabled = false; }
      })
      .catch(function () { msg('Could not send. Please call (207) 499-2700.'); btn.disabled = false; $('#mNext').disabled = false; });
  });

  fetch('/api/catalog').then(function (r) { return r.json(); }).then(function (c) { C = c; build(); show(0, false); })
    .catch(function () { msg('The order form could not load. Please call (207) 499-2700.'); });
})();
