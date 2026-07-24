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

  /* ---------- Прелоадер убран: сразу даём сигнал старта hero-интро ---------- */
  function preloader() {
    window.__trivioPreloaderDone = true;
    document.dispatchEvent(new CustomEvent('trivio:preloader-done'));
  }

  /* ---------- Док: компактный хедер вылетает снизу при скролле вверх ---------- */
  function header() {
    var dock = document.getElementById('dock');
    if (!dock) { return; }
    var hero = document.querySelector('.hero');
    var lastY = 0;

    function onScroll(y) {
      /* док не показываем, пока не проскроллили весь hero (включая трек скролл-видео) */
      var minY = hero ? hero.offsetHeight : 600;
      if (y > minY && y < lastY - 4) {
        dock.classList.add('is-visible');
        dock.setAttribute('aria-hidden', 'false');
      } else if (y > lastY + 4 || y < minY) {
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

  /* ---------- Табы «Умный контроль расходов»: буллет → свой мок справа ---------- */
  function ftabs() {
    document.querySelectorAll('[data-ftabs]').forEach(function (root) {
      var items = root.querySelectorAll('[data-ftab]');
      var panes = root.querySelectorAll('.ftabs__pane');
      var texts = root.querySelectorAll('.ftabs__text');
      items.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = parseInt(btn.getAttribute('data-ftab'), 10) || 0;
          items.forEach(function (b) {
            var active = b === btn;
            b.classList.toggle('is-active', active);
            /* список использует aria-expanded, пилюли — aria-pressed */
            if (b.hasAttribute('aria-expanded')) { b.setAttribute('aria-expanded', active ? 'true' : 'false'); }
            if (b.hasAttribute('aria-pressed')) { b.setAttribute('aria-pressed', active ? 'true' : 'false'); }
          });
          panes.forEach(function (p, j) { p.classList.toggle('is-active', j === i); });
          texts.forEach(function (t, j) { t.classList.toggle('is-active', j === i); });
        });
      });
    });
  }

  /* ---------- Видеофон hero: страховка автоплея ----------
     Браузер может заблокировать автозапуск (энергосбережение, экономия
     трафика, настройки автовоспроизведения) — тогда запускаем сами,
     а если и это запрещено, ждём первого взаимодействия. */
  function heroVideo() {
    var v = document.getElementById('heroVideo');
    if (!v) { return; }
    v.muted = true; /* свойство надёжнее атрибута для политики автоплея */

    function kick() { v.play().catch(function () {}); }
    function tryPlay() {
      var promise = v.play();
      if (promise && promise.catch) {
        promise.catch(function () {
          window.addEventListener('pointerdown', kick, { once: true });
          window.addEventListener('touchstart', kick, { once: true });
          window.addEventListener('wheel', kick, { once: true, passive: true });
        });
      }
    }

    if (v.readyState >= 2) { tryPlay(); }
    else { v.addEventListener('canplay', tryPlay, { once: true }); }
  }

  ready(function () {
    preloader();
    header();
    dropdowns();
    burger();
    forms();
    ftabs();
    heroVideo();
  });
})();
