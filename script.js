(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // ---- Theme toggle (with a wipe via View Transitions where supported) ----
  var btn = $('#theme');
  var icon = $('svg', btn);
  var rot = 0;
  function isDark() {
    var t = root.dataset.theme;
    return t === 'dark';
  }
  function syncMeta() {
    var m = $('meta[name="theme-color"]');
    if (m) m.content = isDark() ? '#0e1218' : '#f0f2f5';
  }
  function setTheme(next) {
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncMeta();
  }
  btn.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    if (!reduce) { rot += 180; icon.style.transform = 'rotate(' + rot + 'deg)'; }
    if (document.startViewTransition && !reduce) document.startViewTransition(function () { setTheme(next); });
    else setTheme(next);
  });
  syncMeta();

  // ---- Rulers: numbered labels, scroll marker + readout, pointer ghost ----
  var rx = $('#rulerX'), ry = $('#rulerY');
  var mx = $('#markerX'), my = $('#markerY');
  var gx = $('#ghostX'), gy = $('#ghostY');
  var pct = $('#pct');
  var tl = $('#timeline');
  var rxLeft = 0;

  function labels(ruler, length, horizontal) {
    $$('.n', ruler).forEach(function (n) { n.remove(); });
    for (var p = 0; p < length; p += 100) {
      var s = document.createElement('span');
      s.className = 'n';
      s.textContent = p;
      s.style[horizontal ? 'left' : 'top'] = p + 'px';
      ruler.appendChild(s);
    }
  }
  function build() {
    labels(rx, window.innerWidth, true);
    if (getComputedStyle(ry).display !== 'none') labels(ry, window.innerHeight, false);
    rxLeft = rx.getBoundingClientRect().left;
  }

  var ticking = false;
  var moved = false;
  function update() {
    ticking = false;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    var f = Math.min(1, Math.max(0, window.scrollY / max));
    var x = f * (rx.clientWidth - 2);
    mx.style.left = x + 'px';
    my.style.top = f * (ry.clientHeight - 2) + 'px';
    pct.textContent = Math.round(f * 100) + '%';
    pct.style.transform = 'translateX(' + (f > 0.88 ? x - pct.offsetWidth - 2 : x + 4) + 'px)';
    if (tl && !reduce) {
      var r = tl.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (window.innerHeight * 0.65 - r.top) / r.height));
      tl.style.setProperty('--tl', p.toFixed(3));
    }
    if (moved) pointerFrame();
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', function () { build(); update(); });

  // ---- Pointer: ruler ghost tick, card spotlight (fine pointers only) ----
  var px = 0, py = 0, target = null, pTick = false;

  function pointerFrame() {
    pTick = false;
    gx.style.transform = 'translateX(' + (px - rxLeft) + 'px)';
    gy.style.transform = 'translateY(' + py + 'px)';

    var card = target && target.closest && target.closest('.card');
    if (card) {
      var cr = card.getBoundingClientRect();
      card.style.setProperty('--mx', (px - cr.left) + 'px');
      card.style.setProperty('--my', (py - cr.top) + 'px');
    }
  }
  // ---- Custom cursor: white dot with mix-blend-mode: difference, grows over text ----
  var cur = null, cx = 0, cy = 0, curRun = false, curSeen = false;
  var BIG = 'a, button, h1, h2, h3, h4, h5, h6, p, li, label, blockquote, dt, dd, figcaption, .brand, .label';
  var FIELD = 'input, textarea, select';
  function curLoop() {
    var k = reduce ? 1 : 0.22;
    cx += (px - cx) * k; cy += (py - cy) * k;
    cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    if (Math.abs(px - cx) > 0.1 || Math.abs(py - cy) > 0.1) requestAnimationFrame(curLoop);
    else curRun = false;
  }
  function curKick() { if (!curRun) { curRun = true; requestAnimationFrame(curLoop); } }

  if (fine) {
    cur = document.createElement('div');
    cur.className = 'cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<i></i>';
    document.body.appendChild(cur);
    root.classList.add('cursor-on');

    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      px = e.clientX; py = e.clientY; target = e.target; moved = true;
      if (!pTick) { pTick = true; requestAnimationFrame(pointerFrame); }

      if (!curSeen) { curSeen = true; cx = px; cy = py; }
      var el = target && target.closest ? target : null;
      cur.classList.toggle('is-field', !!(el && el.closest(FIELD)));
      cur.classList.toggle('is-big', !!(el && el.closest(BIG) && !el.closest(FIELD)));
      cur.classList.add('is-on');
      curKick();
    }, { passive: true });
    document.addEventListener('pointerdown', function () { cur.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { cur.classList.remove('is-down'); });
    document.documentElement.addEventListener('mouseleave', function () { cur.classList.remove('is-on'); });
    document.documentElement.addEventListener('mouseenter', function () { if (curSeen) cur.classList.add('is-on'); });
  }

  // ---- Reveal on scroll, label typing, count-up ----
  var hasIO = 'IntersectionObserver' in window;
  if (!reduce && hasIO) {
    var seen = function (io) {
      return function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        });
      };
    };
    var ioItems = new IntersectionObserver(function (es) { seen(ioItems)(es); }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    var ioSections = new IntersectionObserver(function (es) { seen(ioSections)(es); }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    $$('.sec-head').forEach(function (el) { el.classList.add('reveal-h'); ioItems.observe(el); });
    $$('section.wrap:not(.hero)').forEach(function (el) { el.classList.add('mk'); ioSections.observe(el); });
    $$('.job, .card, .skills > div, .contact > *').forEach(function (el) {
      var i = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.setProperty('--i', Math.min(i, 4));
      el.classList.add('reveal');
      ioItems.observe(el);
    });

    $$('[data-count]').forEach(function (el) {
      var to = +el.dataset.count;
      el.textContent = '0';
      setTimeout(function () {
        var t0 = null;
        requestAnimationFrame(function step(t) {
          if (t0 === null) t0 = t;
          var p = Math.min(1, (t - t0) / 1100);
          el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        });
      }, 900);
    });
  }

  // ---- Nav: active section ----
  var nav = $('.nav');
  var links = {};
  $$('a', nav).forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  function setActive(id) {
    Object.keys(links).forEach(function (k) {
      var on = k === id;
      links[k].classList.toggle('active', on);
      if (on) links[k].setAttribute('aria-current', 'true'); else links[k].removeAttribute('aria-current');
    });
    var a = links[id];
    if (a && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
  }
  if (hasIO) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    $$('main section[id]').forEach(function (s) { sio.observe(s); });
  }

  // ---- Mobile menu ----
  var header = $('.top'), menu = $('#menu');
  function closeMenu() { header.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
  menu.addEventListener('click', function () {
    menu.setAttribute('aria-expanded', header.classList.toggle('open'));
  });
  $$('a', nav).forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && header.classList.contains('open')) { closeMenu(); menu.focus(); }
  });
  document.addEventListener('click', function (e) { if (!header.contains(e.target)) closeMenu(); });
  window.matchMedia('(min-width: 768px)').addEventListener('change', closeMenu);

  // ---- Footer year ----
  $('#year').textContent = new Date().getFullYear();

  // ---- Contact form (Formspree, mailto fallback) ----
  var form = $('#form');
  var status = $('#status');
  var EMAIL = 'shahfahadiffi@gmail.com';
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var configured = form.action.indexOf('YOUR_FORM_ID') === -1;
    if (!configured) {
      var body = (data.get('message') || '') + '\n\n— ' + data.get('name');
      location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Portfolio message from ' + data.get('name')) + '&body=' + encodeURIComponent(body);
      return;
    }
    status.className = 'status'; status.textContent = 'Sending…';
    fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error();
        form.reset(); status.className = 'status ok'; status.textContent = '✓ Thanks, message sent.';
      })
      .catch(function () { status.textContent = 'Could not send. Please email ' + EMAIL + ' directly.'; });
  });

  // ---- Tech strip: auto-scrolls, and page scrolling pushes it faster ----
  var mq = $('.marquee');
  if (mq && !reduce) {
    mq.classList.add('is-js');
    var half = 0, x = 0, last = 0, lastY = window.scrollY, boost = 0, visible = true, hover = false;
    var measure = function () { half = mq.scrollWidth / 2; };
    measure(); window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    window.addEventListener('scroll', function () {
      var y = window.scrollY; boost += (y - lastY) * 1.6; lastY = y;
      boost = Math.max(-1400, Math.min(1400, boost));
    }, { passive: true });
    mq.addEventListener('mouseenter', function () { hover = true; });
    mq.addEventListener('mouseleave', function () { hover = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(mq);
    }
    requestAnimationFrame(function tick(t) {
      var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      if (visible && half) {
        var v = (hover ? 0 : 45) + boost;   // px/s: base drift + scroll push
        x -= v * dt;
        x = ((x % half) + half) % half - half;  // keep within [-half, 0)
        mq.style.transform = 'translate3d(' + x + 'px,0,0)';
      }
      boost *= Math.pow(0.04, dt);            // ease the push back to the base speed
      requestAnimationFrame(tick);
    });
  }

  build(); update();
})();
