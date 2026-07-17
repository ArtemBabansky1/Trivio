/* =====================================================================
   TRIVIO v2 · Прелоадер · хедер · меню · формы
   ===================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); }
    else { fn(); }
  }

  /* ---------- Прелоадер: счётчик 0–100, шторка уезжает вверх ---------- */
  function preloader() {
    var el = document.getElementById('preloader');
    var count = document.getElementById('preloaderCount');
    if (!el) { finish(); return; }

    function finish() {
      window.__trivioPreloaderDone = true;
      document.dispatchEvent(new CustomEvent('trivio:preloader-done'));
      document.documentElement.style.overflow = '';
    }

    function hideNow() {
      el.classList.add('is-done');
      el.style.display = 'none';
      finish();
    }

    if (reduceMotion || typeof window.gsap === 'undefined') { hideNow(); return; }

    document.documentElement.style.overflow = 'hidden';
    var gsap = window.gsap;
    var obj = { v: 0 };
    var tl = gsap.timeline({
      onComplete: function () { el.classList.add('is-done'); el.style.display = 'none'; }
    });
    tl.to(obj, {
      v: 100, duration: 1.4, ease: 'power2.inOut',
      onUpdate: function () { if (count) { count.textContent = Math.round(obj.v); } }
    });
    tl.to(el, {
      yPercent: -100, duration: 0.8, ease: 'power4.inOut',
      onStart: finish
    }, '+=0.15');

    /* страховка: если что-то зависло — убрать через 4с */
    setTimeout(function () {
      if (!window.__trivioPreloaderDone) { tl.kill(); hideNow(); }
    }, 4000);
  }

  /* ---------- Док: компактный хедер вылетает снизу при скролле вверх ---------- */
  function header() {
    var dock = document.getElementById('dock');
    if (!dock) { return; }
    var lastY = 0;

    function onScroll(y) {
      if (y > 600 && y < lastY - 4) {
        dock.classList.add('is-visible');
        dock.setAttribute('aria-hidden', 'false');
      } else if (y > lastY + 4 || y < 600) {
        dock.classList.remove('is-visible');
        dock.setAttribute('aria-hidden', 'true');
      }
      lastY = y;
    }

    if (window.trivioLenis) {
      window.trivioLenis.on('scroll', function (e) { onScroll(e.scroll); });
    } else {
      window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
    }
  }

  /* ---------- Выпадающие меню ---------- */
  function dropdowns() {
    var items = document.querySelectorAll('[data-dd]');
    var fine = window.matchMedia('(pointer: fine)').matches;

    function close(item) {
      item.classList.remove('is-open');
      var btn = item.querySelector('button');
      if (btn) { btn.setAttribute('aria-expanded', 'false'); }
    }
    function open(item) {
      items.forEach(function (i) { if (i !== item) { close(i); } });
      item.classList.add('is-open');
      var btn = item.querySelector('button');
      if (btn) { btn.setAttribute('aria-expanded', 'true'); }
    }

    items.forEach(function (item) {
      var btn = item.querySelector('button');
      if (fine) {
        item.addEventListener('mouseenter', function () { open(item); });
        item.addEventListener('mouseleave', function () { close(item); });
      }
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          item.classList.contains('is-open') ? close(item) : open(item);
        });
      }
    });

    document.addEventListener('click', function () { items.forEach(close); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { items.forEach(close); }
    });
  }

  /* ---------- Мобильное меню ---------- */
  function burger() {
    var btn = document.getElementById('burger');
    var menu = document.getElementById('mobmenu');
    if (!btn || !menu) { return; }

    function toggle(force) {
      var openState = typeof force === 'boolean' ? force : menu.hidden;
      menu.hidden = !openState;
      btn.setAttribute('aria-expanded', String(openState));
      btn.setAttribute('aria-label', openState ? 'Закрыть меню' : 'Открыть меню');
    }

    btn.addEventListener('click', function () { toggle(); });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { toggle(false); });
    });
  }

  /* ---------- Формы (mock: эндпоинт не выдан — см. README) ---------- */
  function forms() {
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    document.querySelectorAll('form[data-form]').forEach(function (form) {
      /* лёгкая маска телефона: только цифры, +, скобки, дефисы, пробелы */
      var phone = form.querySelector('input[type="tel"]');
      if (phone) {
        phone.addEventListener('input', function () {
          phone.value = phone.value.replace(/[^\d+\-() ]/g, '').slice(0, 18);
        });
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var valid = true;

        form.querySelectorAll('[required]').forEach(function (input) {
          var v = input.value.trim();
          var bad = !v ||
            (input.type === 'email' && !emailRe.test(v)) ||
            (input.type === 'tel' && v.replace(/\D/g, '').length < 10);
          input.classList.toggle('is-error', bad);
          if (bad) { valid = false; }
        });
        if (!valid) { return; }

        var btn = form.querySelector('.form__submit');
        var label = form.querySelector('.form__submit-label');
        var arr = form.querySelector('.form__submit-arr');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.85'; }
        if (label) { label.textContent = 'Заявка отправлена'; }
        if (arr) { arr.textContent = '✓'; } /* стрелка → галочка */

        /* TODO (этап 6): заменить на реальный endpoint / CRM */
        console.info('[Trivio v2] Форма заполнена (mock, без отправки):',
          Object.fromEntries(new FormData(form).entries()));
      });

      form.querySelectorAll('.form__input').forEach(function (input) {
        input.addEventListener('input', function () { input.classList.remove('is-error'); });
      });
    });
  }

  ready(function () {
    preloader();
    header();
    dropdowns();
    burger();
    forms();
  });
})();
