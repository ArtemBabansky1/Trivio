/* =====================================================================
   TRIVIO v2 · Карусели
   — stories (услуги) и мозаика вебинаров: drag с инерцией + стрелки
   — галерея кейсов: на десктопе пин + горизонтальный scrub,
     на тач/узких экранах — обычный drag
   ===================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hasGsap() {
    return typeof window.gsap !== 'undefined' && typeof window.Draggable !== 'undefined';
  }

  /* Нативный fallback: горизонтальный скролл колесом/тачем */
  function nativeFallback(viewport) {
    viewport.style.overflowX = 'auto';
    viewport.classList.add('no-scrollbar');
  }

  /* Drag-карусель с инерцией и кнопками */
  function dragCarousel(opts) {
    var viewport = document.querySelector(opts.viewport);
    var track = document.querySelector(opts.track);
    if (!viewport || !track) { return null; }

    if (!hasGsap()) { nativeFallback(viewport); return null; }

    var drag = null;

    function maxShift() {
      return Math.min(0, viewport.clientWidth - track.scrollWidth);
    }

    function build() {
      if (drag) { drag.kill(); }
      drag = window.Draggable.create(track, {
        type: 'x',
        bounds: { minX: maxShift(), maxX: 0 },
        inertia: typeof window.InertiaPlugin !== 'undefined',
        edgeResistance: 0.82,
        cursor: 'grab',
        activeCursor: 'grabbing',
        allowNativeTouchScrolling: true
      })[0];
    }

    function step() {
      var card = track.children[0];
      var gap = parseFloat(getComputedStyle(track).gap) || 16;
      return card ? card.offsetWidth + gap : 320;
    }

    function shiftBy(dir) {
      /* шаг строго по сетке карточек: индекс от текущей позиции, без дрейфа
         при повторных кликах во время анимации */
      var s = step();
      var x = window.gsap.getProperty(track, 'x');
      var idx = Math.round(-x / s) + dir;
      var target = Math.max(maxShift(), Math.min(0, -idx * s));
      window.gsap.to(track, { x: target, duration: 0.7, ease: 'power3.out', overwrite: 'auto', onUpdate: function () { if (drag) { drag.update(); } } });
    }

    if (opts.prev) {
      var prevBtn = document.querySelector(opts.prev);
      if (prevBtn) { prevBtn.addEventListener('click', function () { shiftBy(-1); }); }
    }
    if (opts.next) {
      var nextBtn = document.querySelector(opts.next);
      if (nextBtn) { nextBtn.addEventListener('click', function () { shiftBy(1); }); }
    }

    build();
    window.addEventListener('resize', debounce(build, 200));
    return drag;
  }

  /* Кейсы: пин + горизонтальный scrub (только десктоп, без reduced-motion) */
  function casesGallery() {
    var pinEl = document.getElementById('casesPin');
    var gallery = document.getElementById('casesGallery');
    var track = document.getElementById('casesTrack');
    if (!pinEl || !gallery || !track) { return; }

    if (!hasGsap() || typeof window.ScrollTrigger === 'undefined') {
      nativeFallback(gallery);
      return;
    }

    var mm = window.gsap.matchMedia();

    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', function () {
      var distance = function () {
        return Math.max(0, track.scrollWidth - window.innerWidth + parseFloat(getComputedStyle(track).paddingLeft));
      };
      var tween = window.gsap.to(track, {
        x: function () { return -distance(); },
        ease: 'none',
        scrollTrigger: {
          trigger: pinEl,
          pin: true,
          scrub: 1,
          start: 'top 12%',
          end: function () { return '+=' + distance(); },
          invalidateOnRefresh: true
        }
      });
      return function () {
        if (tween.scrollTrigger) { tween.scrollTrigger.kill(); }
        tween.kill();
        window.gsap.set(track, { x: 0 });
      };
    });

    mm.add('(max-width: 1023.98px), (prefers-reduced-motion: reduce)', function () {
      var drag = window.Draggable.create(track, {
        type: 'x',
        bounds: { minX: Math.min(0, gallery.clientWidth - track.scrollWidth), maxX: 0 },
        inertia: typeof window.InertiaPlugin !== 'undefined',
        edgeResistance: 0.82,
        allowNativeTouchScrolling: true
      })[0];
      return function () { drag.kill(); window.gsap.set(track, { x: 0 }); };
    });
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* Hero-слайдер: новости и вебинары, автосмена по таймеру */
  function heroSlider() {
    var root = document.getElementById('heroSlider');
    if (!root) { return; }
    var slides = root.querySelectorAll('.hero__slide');
    if (slides.length < 2) { return; }
    var count = root.querySelector('.hero__slider-count');
    var bar = root.querySelector('.hero__slider-track i');
    var DURATION = 5000;
    var idx = 0;

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function show(n) {
      slides[idx].classList.remove('is-active');
      idx = (n + slides.length) % slides.length;
      slides[idx].classList.add('is-active');
      if (count) { count.textContent = pad(idx + 1) + ' / ' + pad(slides.length); }
      if (bar) {
        bar.style.transition = 'none';
        bar.style.width = '0%';
        void bar.offsetWidth; /* перезапуск транзишена прогресса */
        bar.style.transition = 'width ' + DURATION + 'ms linear';
        bar.style.width = '100%';
      }
    }

    if (reduceMotion) {
      if (bar) { bar.style.width = '100%'; }
      return;
    }
    show(0);
    setInterval(function () { show(idx + 1); }, DURATION);
  }

  function init() {
    heroSlider();
    if (hasGsap() && typeof window.InertiaPlugin !== 'undefined') {
      window.gsap.registerPlugin(window.Draggable, window.InertiaPlugin);
    } else if (hasGsap()) {
      window.gsap.registerPlugin(window.Draggable);
    }

    dragCarousel({ viewport: '#storiesCarousel', track: '#storiesTrack', prev: '#storiesPrev', next: '#storiesNext' });
    dragCarousel({ viewport: '#liveMosaic', track: '#liveTrack', prev: '#livePrev', next: '#liveNext' });
    casesGallery();

    /* При reduced-motion достаточно нативного скролла без drag-инерции */
    if (reduceMotion) {
      var g = document.getElementById('casesGallery');
      if (g && !hasGsap()) { nativeFallback(g); }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
