/* =====================================================================
   TRIVIO v2 · Анимации (GSAP + Lenis)
   Принцип: контент никогда не прячется через CSS — стартовые состояния
   ставит JS прямо перед анимацией. Нет GSAP / reduced-motion → страница
   полностью видима и статична.
   ===================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); }
    else { fn(); }
  }

  ready(function () {
    if (typeof window.gsap === 'undefined') { return; }
    var gsap = window.gsap;

    if (typeof window.ScrollTrigger !== 'undefined') { gsap.registerPlugin(window.ScrollTrigger); }
    if (typeof window.SplitText !== 'undefined') { gsap.registerPlugin(window.SplitText); }

    /* Магнитные кнопки убраны — hover ограничен сменой цвета/бордера (DESIGN.md §2.5) */

    if (reduceMotion) { return; }
    var ST = window.ScrollTrigger;

    /* ---------- Lenis smooth scroll + синхронизация с ScrollTrigger ---------- */
    if (typeof window.Lenis !== 'undefined' && ST) {
      var lenis = new window.Lenis({ lerp: 0.1, anchors: true });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
      window.trivioLenis = lenis;
    }

    /* ---------- SplitText-заголовки: строки в масках ---------- */
    function splitHeadings() {
      if (typeof window.SplitText === 'undefined' || !ST) { return; }
      document.querySelectorAll('[data-split]').forEach(function (el) {
        var inHero = !!el.closest('.hero');
        var split = new window.SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
        gsap.set(split.lines, { yPercent: 110, transformOrigin: '0% 100%' });
        var tweenIn = function () {
          gsap.to(split.lines, { yPercent: 0, duration: 1.1, stagger: 0.08, ease: 'power4.out' });
        };
        if (inHero) {
          el.__heroReveal = tweenIn; /* стартует из таймлайна прелоадера */
        } else {
          ST.create({ trigger: el, start: 'top 82%', once: true, onEnter: tweenIn });
        }
      });
    }

    /* ---------- Появление абзацев / пилюль / карточек ---------- */
    function reveals() {
      if (!ST) { return; }
      var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
      var heroEls = els.filter(function (el) { return el.closest('.hero'); });
      var rest = els.filter(function (el) { return !el.closest('.hero'); });

      gsap.set(rest, { opacity: 0, y: 24 });
      ST.batch(rest, {
        start: 'top 88%',
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out', overwrite: true });
        }
      });

      window.__trivioHeroEls = heroEls; /* герой стартует после прелоадера */
      gsap.set(heroEls, { opacity: 0, y: 24 });
    }

    /* ---------- Hero: таймлайн после прелоадера ---------- */
    function heroIntro() {
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      var title = document.querySelector('.hero [data-split]');
      var booking = document.getElementById('heroSlider');

      if (window.__trivioHeroEls && window.__trivioHeroEls.length) {
        var tag = window.__trivioHeroEls.filter(function (el) { return el.classList.contains('hero__tag'); });
        var restHero = window.__trivioHeroEls.filter(function (el) { return !el.classList.contains('hero__tag'); });
        if (tag.length) { tl.to(tag, { opacity: 1, y: 0, duration: 0.6 }, 0); }
        if (title && title.__heroReveal) { tl.add(function () { title.__heroReveal(); }, 0.15); }
        if (restHero.length) { tl.to(restHero, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }, 0.55); }
      } else if (title && title.__heroReveal) {
        title.__heroReveal();
      }

      if (booking) {
        /* единый reveal (DESIGN.md §7.1), без scale/blur и вечного float */
        gsap.set(booking, { opacity: 0, y: 24 });
        tl.to(booking, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.85);
      }
    }
    /* Интро hero стартует, когда готовы ОБА условия:
       прелоадер закончился И boot() подготовил сплиты/стартовые состояния */
    var heroStarted = false;
    var booted = false;
    function startHero() {
      if (heroStarted || !booted) { return; }
      heroStarted = true;
      heroIntro();
    }
    document.addEventListener('trivio:preloader-done', startHero, { once: true });
    setTimeout(startHero, 3600); /* страховка */

    /* ---------- Параллакс фото ---------- */
    function parallax() {
      if (!ST) { return; }
      document.querySelectorAll('[data-parallax]').forEach(function (layer) {
        var amp = parseFloat(layer.getAttribute('data-parallax')) || 10;
        var wrap = layer.closest('.parallax') || layer.parentElement;
        gsap.fromTo(layer, { yPercent: -amp / 2 }, {
          yPercent: amp / 2,
          ease: 'none',
          scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    }

    /* ---------- Счётчики ---------- */
    function counters() {
      if (!ST) { return; }
      document.querySelectorAll('[data-counter]').forEach(function (el) {
        var target = parseInt(el.getAttribute('data-counter'), 10) || 0;
        var obj = { v: 0 };
        ST.create({
          trigger: el, start: 'top 88%', once: true,
          onEnter: function () {
            gsap.to(obj, {
              v: target, duration: 1.2, ease: 'power2.out',
              onUpdate: function () {
                el.textContent = Math.round(obj.v).toLocaleString('ru-RU').replace(/ /g, ' ');
              }
            });
          }
        });
      });
    }

    /* ---------- Marquee логотипов ---------- */
    function marquee() {
      var track = document.getElementById('marqueeTrack');
      if (!track) { return; }
      track.innerHTML += track.innerHTML; /* бесшовный дубль */
      var tween = gsap.to(track, { xPercent: -50, duration: 36, ease: 'none', repeat: -1 });
      track.addEventListener('mouseenter', function () { gsap.to(tween, { timeScale: 0.25, duration: 0.4 }); });
      track.addEventListener('mouseleave', function () { gsap.to(tween, { timeScale: 1, duration: 0.4 }); });
      /* ускорение от скролла убрано — marquee идёт с постоянной скоростью (DESIGN.md §7.5) */
    }

    /* ---------- Роли: гигантские цифры поднимаются из-под кромки ---------- */
    function roleNumbers() {
      if (!ST) { return; }
      var cards = document.querySelectorAll('.roles__card');
      if (!cards.length) { return; }
      gsap.set(cards, { opacity: 0, y: 40 });
      ST.batch(cards, {
        start: 'top 85%', once: true,
        onEnter: function (batch) {
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' });
        }
      });
      document.querySelectorAll('.roles__num').forEach(function (num, i) {
        gsap.from(num, {
          yPercent: 55,
          ease: 'none',
          scrollTrigger: {
            trigger: num.closest('.roles__card'),
            start: 'top 92%', end: 'top 40%',
            scrub: 0.6 + i * 0.15
          }
        });
      });
    }

    /* ---------- Возможности: бары графика и чат (входы — reveal, DESIGN.md §7) ---------- */
    function featureMocks() {
      if (!ST) { return; }

      /* график аналитики: бары растут, значения досчитываются */
      var chart = document.querySelector('.mock--analytics');
      if (chart) {
        var chartBars = chart.querySelectorAll('.mock__bar');
        var chartFoot = chart.querySelector('.mock__foot');
        var chartTl = gsap.timeline({
          scrollTrigger: { trigger: chart, start: 'top 72%', once: true }
        });
        chartBars.forEach(function (bar, i) {
          var fill = bar.querySelector('i');
          var val = bar.querySelector('em');
          var at = i * 0.14;
          chartTl.from(fill, {
            scaleY: 0, transformOrigin: 'bottom',
            duration: 0.9, ease: 'power3.out'
          }, at);
          if (val) {
            var target = parseInt(val.textContent, 10) || 0;
            var counter = { v: 0 };
            gsap.set(val, { opacity: 0, y: 8 });
            chartTl.to(val, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, at + 0.15);
            chartTl.to(counter, {
              v: target, duration: 0.8, ease: 'power2.out',
              onUpdate: function () { val.textContent = Math.round(counter.v) + '%'; }
            }, at + 0.15);
          }
        });
        if (chartFoot) {
          chartTl.from(chartFoot, { opacity: 0, y: 14, duration: 0.5, ease: 'power2.out' }, '>-0.4');
        }
      }

      /* скидки спецтарифов: единый reveal */
      var discounts = document.querySelectorAll('.mock--tariff .mock__discounts b');
      if (discounts.length) {
        gsap.set(discounts, { opacity: 0, y: 24 });
        ST.create({
          trigger: '.mock--tariff', start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(discounts, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
          }
        });
      }

      /* сообщения чата: единый reveal */
      var msgs = document.querySelectorAll('#supportChat .chat__msg');
      if (msgs.length) {
        gsap.set(msgs, { opacity: 0, y: 24 });
        ST.create({
          trigger: '#supportChat', start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(msgs, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
          }
        });
      }
    }

    /* ---------- Кейсы: тег-пилюли — единый reveal ---------- */
    function caseExtras() {
      if (!ST) { return; }
      var pills = document.querySelectorAll('.cases__tags .pill');
      if (!pills.length) { return; }
      gsap.set(pills, { opacity: 0, y: 24 });
      ST.create({
        trigger: '.cases__gallery', start: 'top 80%', once: true,
        onEnter: function () {
          gsap.to(pills, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
        }
      });
    }

    /* ---------- Hero: фото плавно увеличивается по скроллу (scrub, §7.3) ---------- */
    function heroZoom() {
      if (!ST) { return; }
      var img = document.querySelector('.hero__bg .ph > img');
      if (!img) { return; }
      gsap.to(img, {
        scale: 1.1, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
    }

    /* Порядок: сначала сплиты (меняют DOM), затем всё остальное */
    var boot = function () {
      splitHeadings();
      reveals();
      parallax();
      counters();
      marquee();
      roleNumbers();
      featureMocks();
      caseExtras();
      heroZoom();
      if (ST) { ST.refresh(); }
      booted = true;
      if (window.__trivioPreloaderDone) { startHero(); }
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(boot);
    } else {
      boot();
    }
  });
})();
