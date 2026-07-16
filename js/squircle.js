/* =====================================================================
   TRIVIO v2 · Сквирклы (iOS corner smoothing 0.6)
   Порт алгоритма figma-squircle (MIT, github.com/phamfoo/figma-squircle):
   строит superellipse-путь и вешает clip-path; пересчёт на ResizeObserver.
   Fallback — обычный border-radius (уже задан в CSS).
   ===================================================================== */
(function () {
  'use strict';

  var SMOOTHING = 0.6;
  var RADII = { xl: 40, l: 28, m: 20 };

  function toRad(deg) { return (deg * Math.PI) / 180; }

  /* Параметры одного угла (radius уже ограничен бюджетом) */
  function cornerParams(radius, smoothing, budget) {
    var maxSmoothing = budget / radius - 1;
    var s = Math.min(smoothing, Math.max(0, maxSmoothing));
    var p = Math.min((1 + s) * radius, budget);

    var arcMeasure = 90 * (1 - s);
    var arcSectionLength = Math.sin(toRad(arcMeasure / 2)) * radius * Math.SQRT2;
    var angleAlpha = (90 - arcMeasure) / 2;
    var p3ToP4Distance = radius * Math.tan(toRad(angleAlpha / 2));
    var angleBeta = 45 * s;
    var c = p3ToP4Distance * Math.cos(toRad(angleBeta));
    var d = c * Math.tan(toRad(angleBeta));
    var b = (p - arcSectionLength - c - d) / 3;
    var a = 2 * b;

    return { a: a, b: b, c: c, d: d, p: p, arc: arcSectionLength, r: radius };
  }

  function n(v) { return +v.toFixed(3); }

  function squirclePath(w, h, radius) {
    var budget = Math.min(w, h) / 2;
    var r = Math.min(radius, budget);
    if (r <= 0 || w <= 0 || h <= 0) { return ''; }
    var q = cornerParams(r, SMOOTHING, budget);

    return (
      'M ' + n(w - q.p) + ' 0 ' +
      'c ' + n(q.a) + ' 0 ' + n(q.a + q.b) + ' 0 ' + n(q.a + q.b + q.c) + ' ' + n(q.d) + ' ' +
      'a ' + n(q.r) + ' ' + n(q.r) + ' 0 0 1 ' + n(q.arc) + ' ' + n(q.arc) + ' ' +
      'c ' + n(q.d) + ' ' + n(q.c) + ' ' + n(q.d) + ' ' + n(q.b + q.c) + ' ' + n(q.d) + ' ' + n(q.a + q.b + q.c) + ' ' +
      'L ' + n(w) + ' ' + n(h - q.p) + ' ' +
      'c 0 ' + n(q.a) + ' 0 ' + n(q.a + q.b) + ' ' + n(-q.d) + ' ' + n(q.a + q.b + q.c) + ' ' +
      'a ' + n(q.r) + ' ' + n(q.r) + ' 0 0 1 ' + n(-q.arc) + ' ' + n(q.arc) + ' ' +
      'c ' + n(-q.c) + ' ' + n(q.d) + ' ' + n(-(q.b + q.c)) + ' ' + n(q.d) + ' ' + n(-(q.a + q.b + q.c)) + ' ' + n(q.d) + ' ' +
      'L ' + n(q.p) + ' ' + n(h) + ' ' +
      'c ' + n(-q.a) + ' 0 ' + n(-(q.a + q.b)) + ' 0 ' + n(-(q.a + q.b + q.c)) + ' ' + n(-q.d) + ' ' +
      'a ' + n(q.r) + ' ' + n(q.r) + ' 0 0 1 ' + n(-q.arc) + ' ' + n(-q.arc) + ' ' +
      'c ' + n(-q.d) + ' ' + n(-q.c) + ' ' + n(-q.d) + ' ' + n(-(q.b + q.c)) + ' ' + n(-q.d) + ' ' + n(-(q.a + q.b + q.c)) + ' ' +
      'L 0 ' + n(q.p) + ' ' +
      'c 0 ' + n(-q.a) + ' 0 ' + n(-(q.a + q.b)) + ' ' + n(q.d) + ' ' + n(-(q.a + q.b + q.c)) + ' ' +
      'a ' + n(q.r) + ' ' + n(q.r) + ' 0 0 1 ' + n(q.arc) + ' ' + n(-q.arc) + ' ' +
      'c ' + n(q.c) + ' ' + n(-q.d) + ' ' + n(q.b + q.c) + ' ' + n(-q.d) + ' ' + n(q.a + q.b + q.c) + ' ' + n(-q.d) + ' ' +
      'Z'
    );
  }

  function radiusFor(el) {
    var kind = el.getAttribute('data-squircle');
    return RADII[kind] || RADII.l;
  }

  var pending = new Set();
  var rafId = 0;

  function flush() {
    rafId = 0;
    pending.forEach(function (el) {
      var w = el.offsetWidth;
      var h = el.offsetHeight;
      if (!w || !h) { return; }
      var path = squirclePath(w, h, radiusFor(el));
      if (path) {
        el.style.clipPath = 'path("' + path + '")';
        el.classList.add('squircled');
      }
    });
    pending.clear();
  }

  function schedule(el) {
    pending.add(el);
    if (!rafId) { rafId = requestAnimationFrame(flush); }
  }

  function init() {
    var els = document.querySelectorAll('[data-squircle]');
    if (!els.length) { return; }

    /* Нет clip-path: path() (старые браузеры) — остаёмся на border-radius */
    if (!(window.CSS && CSS.supports && CSS.supports('clip-path', 'path("M 0 0 L 1 0 Z")'))) {
      return;
    }

    var ro = new ResizeObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) { schedule(entries[i].target); }
    });

    els.forEach(function (el) {
      ro.observe(el);
      schedule(el);
    });

    window.trivioSquircle = { refresh: function () { els.forEach(schedule); } };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
