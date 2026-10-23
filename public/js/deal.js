(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var money = function (c) { return '$' + (c / 100).toFixed(2).replace(/\.00$/, ''); };
  var form = $('#dealForm');
  if (!form) return;
  var D = JSON.parse(form.getAttribute('data-deal'));
  var msg = $('#dealMsg'), btn = $('#dealSubmit');

  function items() {
    return $$('input[data-size]').map(function (i) { return { size: i.getAttribute('data-size'), qty: Math.max(0, Math.floor(Number(i.value) || 0)) }; })
      .filter(function (i) { return i.qty > 0; });
  }
  function render() {
    var q = items().reduce(function (t, i) { return t + i.qty; }, 0);
    $('#dealTotal').textContent = money(q * D.price) + (q > 1 ? ' (' + q + ' × ' + money(D.price) + ')' : '');
  }
  form.addEventListener('input', render);
  render();

  $$('input[name=fulfillment]').forEach(function (r) { r.addEventListener('change', function () { $('.addr', form).hidden = !(r.value === 'delivery' && r.checked); }); });

  var file = $('input[type=file]', form);
  if (file) file.addEventListener('change', function () {
    var f = file.files[0];
    $('.drop-txt b', form).textContent = f ? f.name : 'Upload your logo';
    file.closest('.drop').classList.toggle('has', !!f);
  });

  // sharing
  var share = $('.share');
  if (share) {
    var url = share.getAttribute('data-url'), title = share.getAttribute('data-title');
    var native = $('[data-share=native]', share);
    if (navigator.share) native.hidden = false;
    native.addEventListener('click', function () { navigator.share({ title: title, url: url }).catch(function () {}); });
    $('[data-share=copy]', share).addEventListener('click', function (e) {
      var b = e.currentTarget;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = 'Copied!'; }, function () { window.prompt('Copy this link:', url); })
        .then(function () { setTimeout(function () { b.textContent = 'Copy link'; }, 1800); });
      if (window.saTrack) window.saTrack('social', 'copy deal link');
    });
  }

  function say(t, ok) { msg.className = 'form-msg ' + (ok ? 'ok' : 'err'); msg.textContent = t; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var it = items(), f = form.elements;
    if (!it.length) return say('Add a quantity.');
    if (D.needsLogo && file && !file.files.length) return say('Upload your logo so we can make your mockup.');
    if (!f.namedItem('name').value.trim()) return say('Add your name.');
    if (f.namedItem('phone').value.replace(/\D/g, '').length < 7) return say('Add a phone number.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.namedItem('email').value.trim())) return say('Add your email for order updates.');
    var fd = new FormData(form);
    fd.append('deal_id', D.id);
    fd.append('items', JSON.stringify(it));
    var q = new URLSearchParams(location.search);
    fd.append('source', q.get('utm_source') || q.get('ref') || (document.referrer ? 'referral' : 'direct'));
    btn.disabled = true; say('Sending…', true);
    fetch('/api/orders/deal', { method: 'POST', body: fd })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) { if (window.saTrack) window.saTrack('quote_click', 'deal order'); location.href = res.j.redirect; }
        else { say(res.j.error || 'Something went wrong. Please call (207) 499-2700.'); btn.disabled = false; }
      })
      .catch(function () { say('Could not send. Please call (207) 499-2700.'); btn.disabled = false; });
  });
})();
