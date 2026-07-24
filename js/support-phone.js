/* =====================================================================
   TRIVIO v2 · Блок поддержки: скролл-управляемый 3D iPhone (порт
   MeetsPhone.jsx в ваниль). Модель разворачивается к зрителю по скроллу,
   реагирует на курсор, на экране крутится чат поддержки. Без WebGL или
   с reduced-motion секция остаётся с плоской карточкой чата (фолбэк).
   ===================================================================== */
import { createPhoneScene } from './phone-scene.js';
import { createSupportScreenCanvas } from './support-screen.js';

var MAX_TILT = 0.14; /* рад — пик наклона от курсора (~8°) */
var FALLOFF = 600;   /* px — расстояние, на котором наклон падает вдвое */
var GLB_URL = 'assets/3d/iphone-black.glb';

/* Перерисовка чата ограничена ~30fps: каждый помеченный кадр целиком
   заливает канвас чата в GPU и перестраивает мип-цепочку — на 60fps это
   заикается на встроенной графике, а 340мс-ease выглядит так же и на 30 */
var DRAW_INTERVAL = 33;
/* Ниже этого прогресса телефон отвёрнут >90° — экран отсечён back-face
   culling'ом, перерисовывать/грузить текстуру бессмысленно */
var SCREEN_FACING_PROGRESS = 0.3;

function hasWebGL() {
  try {
    var c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

function init() {
  var section = document.getElementById('support');
  var canvas = document.getElementById('supportPhoneCanvas');
  var stage = canvas ? canvas.closest('.support__stage') : null;
  if (!section || !canvas || !stage) { return; }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !hasWebGL()) { return; } /* остаёмся на карточке-фолбэке */

  var isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  var scene = null;
  var screenApi = null;
  var screenFacing = false;
  var animating = false;
  var animRaf = 0;
  var animStart = 0;
  var wasActive = true;
  var lastDraw = -Infinity;

  /* Репейнт чата на своём rAF; загрузки в GPU только в окнах анимации
     (появление + fade цикла), в паузе устоявшийся кадр пушится один раз */
  function drawFrame() {
    if (!animating || !scene || !screenApi) { return; }
    animRaf = requestAnimationFrame(drawFrame);
    if (!screenFacing) {
      wasActive = true; /* форс-пуш кадра, когда экран вернётся в кадр */
      return;
    }
    var now = performance.now();
    if (now - lastDraw < DRAW_INTERVAL) { return; }
    lastDraw = now;
    var t = (now - animStart) % screenApi.cycle;
    var active = t <= screenApi.settled + 100 || t >= screenApi.cycle - 700;
    if (active) {
      screenApi.draw(t);
      scene.redrawScreen();
    } else if (wasActive) {
      screenApi.draw(screenApi.settled);
      scene.redrawScreen();
    }
    wasActive = active;
  }
  function startAnim() {
    if (animating || !screenApi) { return; }
    animating = true;
    animStart = performance.now();
    wasActive = true;
    drawFrame();
  }
  function stopAnim() {
    animating = false;
    cancelAnimationFrame(animRaf);
  }

  /* Размер текстуры чата — под фактическую высоту канваса на устройстве:
     телефон занимает ~fitFrac высоты, его экран ~41% высоты телефона */
  var dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
  var stageH = canvas.getBoundingClientRect().height || 600;
  var texWidth = Math.max(560, Math.min(1100, Math.round(stageH * 0.41 * dpr)));

  createSupportScreenCanvas({ width: texWidth }).then(function (screen) {
    screenApi = screen;
    scene = createPhoneScene(canvas, {
      turnAwayDeg: 135,
      maxPixelRatio: isTouch ? 1.5 : 2,
      fitFrac: 0.92 /* телефон почти на весь канвас */
    });

    function sizeToBox() {
      var r = canvas.getBoundingClientRect();
      if (r.width && r.height) { scene.setSize(r.width, r.height); }
    }

    scene.load(GLB_URL, screen.canvas, screen.aspect).then(function () {
      /* 3D готов — показываем канвас вместо карточки */
      section.classList.add('support--3d');

      sizeToBox();
      scene.start();
      startAnim();

      function applyProgress(p) {
        scene.setProgress(p);
        screenFacing = p > SCREEN_FACING_PROGRESS;
      }

      var ST = window.ScrollTrigger;
      if (ST) {
        var st = ST.create({
          trigger: section,
          start: 'top 78%',
          end: 'center 46%',
          scrub: true,
          onUpdate: function (self) { applyProgress(self.progress); },
          onRefresh: function (self) { applyProgress(self.progress); }
        });
        ST.refresh();
        applyProgress(st.progress);
      } else {
        applyProgress(1); /* без ScrollTrigger телефон сразу лицом */
      }

      var ro = new ResizeObserver(sizeToBox);
      ro.observe(canvas);

      /* За экраном рендер и репейнт стоят */
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { scene.start(); startAnim(); }
        else { scene.stop(); stopAnim(); }
      }, { rootMargin: '200px' });
      io.observe(stage);

      if (!isTouch) {
        var tiltFrame = 0;
        window.addEventListener('mousemove', function (e) {
          cancelAnimationFrame(tiltFrame);
          tiltFrame = requestAnimationFrame(function () {
            if (!scene) { return; }
            var r = canvas.getBoundingClientRect();
            var dx = e.clientX - (r.left + r.width / 2);
            var dy = e.clientY - (r.top + r.height / 2);
            var dist = Math.hypot(dx, dy) || 1;
            var fall = FALLOFF / (FALLOFF + dist);
            scene.setTilt((-dy / dist) * MAX_TILT * fall, (dx / dist) * MAX_TILT * fall);
          });
        });
      }
    }).catch(function () {
      /* модель не загрузилась — фолбэк-карточка остаётся видимой */
      scene.dispose();
      scene = null;
      stopAnim();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
