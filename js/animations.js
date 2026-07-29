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

        /* манифест: текст перекрашивается по скролл-скрабу из серого в основной,
           волной по буквам (words+chars — чтобы переносы оставались по словам) */
        if (el.closest('.manifesto')) {
          var inkColor = getComputedStyle(el).color;
          var colorSplit = new window.SplitText(el, { type: 'words,chars' });
          gsap.fromTo(colorSplit.chars, { color: '#cdd2da' }, {
            /* duration >> stagger: каждая буква доцветает долго, волна плавная */
            color: inkColor, ease: 'none', duration: 6, stagger: 0.12,
            scrollTrigger: { trigger: el, start: 'top 78%', end: 'top 32%', scrub: true }
          });
          return;
        }

        var split = new window.SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
        gsap.set(split.lines, { yPercent: 110, transformOrigin: '0% 100%' });
        if (inHero) {
          el.__heroLines = split.lines; /* анимируются из таймлайна hero после прелоадера */
        } else {
          ST.create({
            trigger: el, start: 'top 82%', once: true,
            onEnter: function () {
              gsap.to(split.lines, { yPercent: 0, duration: 1.1, stagger: 0.08, ease: 'power4.out' });
            }
          });
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

    /* ---------- Hero: таймлайн контента после прелоадера ---------- */
    var heroTl = null;
    function buildHeroTl() {
      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      var title = document.querySelector('.hero [data-split]');
      var header = document.getElementById('header');
      var plate = document.querySelector('.hero__plate');

      if (header) {
        tl.fromTo(header, { autoAlpha: 0, y: -24 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.2);
      }
      if (title && title.__heroLines) {
        tl.to(title.__heroLines, { yPercent: 0, duration: 1.1, stagger: 0.08, ease: 'power4.out' }, 0);
      }
      var els = window.__trivioHeroEls || [];
      if (els.length) { tl.to(els, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1 }, 0.3); }
      if (plate) {
        /* фото-плашка: единый reveal (DESIGN.md §7.1) */
        tl.fromTo(plate, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.15);
      }
      return tl;
    }
    function playHeroIntro() {
      if (!heroTl) { heroTl = buildHeroTl(); }
      heroTl.play();
    }

    /* Интро hero стартует, когда готовы ОБА условия:
       прелоадер закончился И boot() подготовил сплиты/стартовые состояния */
    var heroStarted = false;
    var booted = false;
    function startHero() {
      if (heroStarted || !booted) { return; }
      heroStarted = true;
      playHeroIntro();
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
        /* «+» скрыт до конца пересчёта: выедет из-под цифр слева направо с доворотом 45° */
        var plus = el.parentElement ? el.parentElement.querySelector('i') : null;
        if (plus) {
          gsap.set(plus, { display: 'inline-block', opacity: 0, x: '-0.7em', rotation: -45, transformOrigin: '50% 50%' });
        }
        ST.create({
          trigger: el, start: 'top 88%', once: true,
          onEnter: function () {
            gsap.to(obj, {
              /* сильное замедление под конец пересчёта */
              v: target, duration: 2.2, ease: 'expo.out',
              onUpdate: function () {
                el.textContent = Math.round(obj.v).toLocaleString('ru-RU').replace(/ /g, ' ');
              },
              onComplete: function () {
                if (plus) {
                  gsap.to(plus, { opacity: 1, x: 0, rotation: 0, duration: 0.55, ease: 'back.out(1.7)' });
                }
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

      /* тревел-политика: столбики эквалайзера растут из-под низа волной */
      var eqBars = document.querySelectorAll('.mock--policy .mock__eq i');
      if (eqBars.length) {
        gsap.set(eqBars, { scaleY: 0 });
        ST.create({
          trigger: '.mock--policy', start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(eqBars, { scaleY: 1, duration: 0.9, stagger: 0.04, ease: 'power3.out' });
          }
        });
      }

      /* telegram: сообщение → кнопки → ответ, последовательный reveal */
      var tgEls = document.querySelectorAll('.mock--tg .mock__tg-msg, .mock--tg .mock__tg-actions');
      if (tgEls.length) {
        gsap.set(tgEls, { opacity: 0, y: 24 });
        ST.create({
          trigger: '.mock--tg', start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(tgEls, { opacity: 1, y: 0, duration: 0.8, stagger: 0.22, ease: 'power3.out' });
          }
        });
      }

      /* 1С: строки чек-листа проявляются по очереди */
      var syncRows = document.querySelectorAll('.mock--1c .mock__rows li');
      if (syncRows.length) {
        gsap.set(syncRows, { opacity: 0, y: 24 });
        ST.create({
          trigger: '.mock--1c', start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(syncRows, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' });
          }
        });
      }

      /* спецтарифы: скидки reveal + спарклайн рисуется, точки проявляются */
      var discounts = document.querySelectorAll('.mock--tariff .mock__discounts b');
      var sparkLine = document.querySelector('.mock--tariff .mock__spark-line');
      var sparkDots = document.querySelectorAll('.mock--tariff .mock__spark circle');
      if (discounts.length || sparkLine) {
        gsap.set(discounts, { opacity: 0, y: 24 });
        var sparkLen = 0;
        if (sparkLine) {
          sparkLen = sparkLine.getTotalLength();
          gsap.set(sparkLine, { strokeDasharray: sparkLen, strokeDashoffset: sparkLen });
          gsap.set(sparkDots, { opacity: 0 });
        }
        ST.create({
          trigger: '.mock--tariff', start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(discounts, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
            if (sparkLine) {
              gsap.to(sparkLine, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', delay: 0.2 });
              gsap.to(sparkDots, { opacity: 1, duration: 0.4, stagger: 0.12, ease: 'power2.out', delay: 0.3 });
            }
          }
        });
      }

      /* авансовый отчёт: строки списка по очереди (итог досчитывает counters()) */
      var repRows = document.querySelectorAll('.mock--report .mock__rows li');
      if (repRows.length) {
        gsap.set(repRows, { opacity: 0, y: 24 });
        ST.create({
          trigger: '.mock--report', start: 'top 80%', once: true,
          onEnter: function () {
            gsap.to(repRows, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' });
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

    /* ---------- CTA «Хотите протестировать?»: плашка раскрывается на весь экран.
       Секция пинится, clip-path скрабом едет от «блока со скруглением» до
       inset(0) — фото занимает 100% экрана, форма растворяется, скролл идёт дальше.
       Стартовые значения зеркалят CSS-статику (clamp(28px,5svh,64px) / --pad / --r-xl). */
    function ctaExpand() {
      if (!ST) { return; }
      var section = document.querySelector('.cta');
      if (!section) { return; }
      var form = section.querySelector('.cta__form');

      var startClip = function () {
        var probe = document.querySelector('.container:not(.cta__inner)');
        var pad = probe ? (parseFloat(getComputedStyle(probe).paddingLeft) || 20) : 20;
        var v = Math.min(Math.max(window.innerHeight * 0.05, 28), 64);
        return 'inset(' + Math.round(v) + 'px ' + Math.round(pad) + 'px round 40px)';
      };

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=100%',
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });
      tl.fromTo(section,
        { clipPath: startClip },
        { clipPath: 'inset(0px 0px round 0px)', ease: 'none', duration: 1 }, 0);
      if (form) {
        /* фейд растянут почти на весь скраб — форма тает медленно (просьба заказчика 29.07) */
        tl.to(form, { autoAlpha: 0, y: -40, duration: 0.8, ease: 'power1.in' }, 0.15);
      }
    }

    /* Порядок: сначала сплиты (меняют DOM), затем всё остальное */
    var boot = function () {
      splitHeadings();
      reveals();
      parallax();
      counters();
      marquee();
      featureMocks();
      caseExtras();
      ctaExpand();
      /* Пины создаются из разных файлов не в порядке документа (кейсы — на
         DOMContentLoaded, CTA — после fonts.ready): без sort() спейсер пина CTA
         не учитывается в start пина кейсов, и кейсы наезжают на фото раньше времени */
      if (ST) { ST.sort(); ST.refresh(); }
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
