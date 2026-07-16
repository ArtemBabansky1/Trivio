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

    /* ---------- Магнитные кнопки (работают и при reduced-motion — это hover) ---------- */
    if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
      document.querySelectorAll('[data-magnetic]').forEach(function (btn) {
        var xTo = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
        var yTo = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
        btn.addEventListener('mousemove', function (e) {
          var r = btn.getBoundingClientRect();
          xTo(Math.max(-12, Math.min(12, (e.clientX - r.left - r.width / 2) * 0.25)));
          yTo(Math.max(-12, Math.min(12, (e.clientY - r.top - r.height / 2) * 0.25)));
        });
        btn.addEventListener('mouseleave', function () { xTo(0); yTo(0); });
      });
    }

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
        gsap.set(split.lines, { yPercent: 110, rotate: 4, transformOrigin: '0% 100%' });
        var tweenIn = function () {
          gsap.to(split.lines, { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.08, ease: 'power4.out' });
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
      var booking = document.getElementById('heroBooking');

      if (window.__trivioHeroEls && window.__trivioHeroEls.length) {
        var tag = window.__trivioHeroEls.filter(function (el) { return el.classList.contains('hero__tag'); });
        var restHero = window.__trivioHeroEls.filter(function (el) { return !el.classList.contains('hero__tag'); });
        tl.to(tag, { opacity: 1, y: 0, duration: 0.6 }, 0);
        if (title && title.__heroReveal) { tl.add(function () { title.__heroReveal(); }, 0.15); }
        tl.to(restHero, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }, 0.55);
      } else if (title && title.__heroReveal) {
        title.__heroReveal();
      }

      if (booking) {
        gsap.set(booking, { opacity: 0, scale: 0.9, filter: 'blur(8px)' });
        tl.to(booking, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'power4.out' }, 0.85);
        /* бесконечный float */
        tl.add(function () {
          gsap.to(booking, { y: 8, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        });
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
      /* лёгкое ускорение от скорости скролла */
      if (window.trivioLenis) {
        window.trivioLenis.on('scroll', function (e) {
          var boost = 1 + Math.min(2.2, Math.abs(e.velocity) / 14);
          tween.timeScale(boost);
        });
      }
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

    /* ---------- Услуги: бейджи всплывают + лёгкий float ---------- */
    function serviceFloats() {
      if (!ST) { return; }
      var floats = document.querySelectorAll('[data-float]');
      if (!floats.length) { return; }
      gsap.set(floats, { scale: 0, opacity: 0 });
      ST.create({
        trigger: '.services__major', start: 'top 75%', once: true,
        onEnter: function () {
          gsap.to(floats, { scale: 1, opacity: 1, duration: 0.8, stagger: 0.14, ease: 'back.out(1.8)' });
          floats.forEach(function (f, i) {
            gsap.to(f, { y: i % 2 ? 10 : -10, duration: 2.4 + i * 0.3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
          });
        }
      });
      /* story-карточки заезжают «лесенкой» */
      var stories = document.querySelectorAll('.stories__card');
      if (stories.length) {
        gsap.set(stories, { x: 80, opacity: 0 });
        ST.create({
          trigger: '.services__stories', start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(stories, { x: 0, opacity: 1, duration: 0.9, stagger: 0.1, ease: 'power3.out' });
          }
        });
      }
    }

    /* ---------- Возможности: коллажи с rotate, бары, чат ---------- */
    function featureMocks() {
      if (!ST) { return; }
      document.querySelectorAll('.features__collage').forEach(function (collage) {
        var items = collage.querySelectorAll('.features__item');
        items.forEach(function (item, i) {
          gsap.set(item, { rotate: i % 2 ? 1.5 : -1.5 });
        });
        ST.create({
          trigger: collage, start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(items, { rotate: 0, duration: 1, stagger: 0.12, ease: 'power3.out' });
          }
        });
      });

      /* бары аналитики растут по scrub */
      var bars = document.querySelectorAll('.mock__bar i');
      if (bars.length) {
        gsap.from(bars, {
          scaleY: 0.12,
          transformOrigin: 'bottom',
          ease: 'none',
          stagger: 0.05,
          scrollTrigger: { trigger: '.mock--analytics', start: 'top 90%', end: 'top 45%', scrub: 0.8 }
        });
      }

      /* чат печатается по одному сообщению */
      var msgs = document.querySelectorAll('#supportChat .chat__msg');
      if (msgs.length) {
        gsap.set(msgs, { opacity: 0, y: 16, scale: 0.96 });
        ST.create({
          trigger: '#supportChat', start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(msgs, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.45, ease: 'power2.out' });
          }
        });
      }
    }

    /* ---------- Кейсы: тег-пилюли всплывают при входе галереи ---------- */
    function caseExtras() {
      if (!ST) { return; }
      var pills = document.querySelectorAll('.cases__tags .pill');
      if (!pills.length) { return; }
      gsap.set(pills, { scale: 0, opacity: 0 });
      ST.create({
        trigger: '.cases__gallery', start: 'top 80%', once: true,
        onEnter: function () {
          gsap.to(pills, { scale: 1, opacity: 1, duration: 0.6, stagger: 0.12, ease: 'back.out(1.7)' });
        }
      });
    }

    /* ---------- Мозаика: multi-speed вертикальный параллакс карточек ---------- */
    function liveParallax() {
      if (!ST) { return; }
      document.querySelectorAll('.live__card').forEach(function (card, i) {
        gsap.fromTo(card, { y: 18 + (i % 3) * 14 }, {
          y: -(10 + (i % 3) * 10),
          ease: 'none',
          scrollTrigger: { trigger: '.live__mosaic', start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    }

    /* ---------- Футер: водяная надпись стаггером ---------- */
    function watermark() {
      if (!ST) { return; }
      var letters = document.querySelectorAll('.footer__watermark span');
      if (!letters.length) { return; }
      gsap.set(letters, { yPercent: 60 });
      ST.create({
        trigger: '.footer__watermark', start: 'top 96%', once: true,
        onEnter: function () {
          gsap.to(letters, { yPercent: 0, duration: 1, stagger: 0.06, ease: 'power4.out' });
        }
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
      serviceFloats();
      featureMocks();
      caseExtras();
      liveParallax();
      watermark();
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
