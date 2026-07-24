/* =====================================================================
   TRIVIO v2 · Экран 3D-телефона: чат поддержки на canvas (текстура).
   Тот же диалог, что в карточке #supportChat: пилюля «Поддержка · 24/7»,
   «● онлайн», 4 реплики (клиент — синие справа, оператор — светлые слева)
   с typing-индикатором. draw(now) крутит цикл: появление → пауза → fade.
   Рисуется в фиксированной системе 1100×2381 (аспект экрана iPhone 0.462),
   все метрики умножаются на s = W/1100 — разрешение-независимо.
   ===================================================================== */

var SCREEN_ASPECT = 1100 / 2381;
var CYCLE = 8600; /* мс: полный цикл (появление → пауза → fade → заново) */

/* Цвета зеркалят tokens.css — canvas не читает CSS-переменные */
var C = {
  bg: '#ffffff',
  accent: '#0055fe',   /* --c-accent: реплики клиента */
  opBubble: '#f0f2f6', /* светлый пузырь оператора */
  text: '#4a4a4a',     /* --c-ink */
  muted: '#5b6472',    /* --c-muted */
  green: '#1d9e5c',    /* статус «онлайн» (как .features__chat-status) */
  white: '#ffffff',
  border: 'rgba(74, 74, 74, 0.18)',
  island: '#0e1116',   /* --c-dark */
  typing: '#b3b9c4'
};

var FONT = '"TT Neoris", -apple-system, "Segoe UI", sans-serif';

/* Диалог — 1:1 из карточки поддержки (index.html #supportChat) */
var CHAT = {
  pill: 'Поддержка · 24/7',
  online: 'онлайн',
  messages: [
    { text: 'Добрый день! Нужна ваша помощь с обменом билета. Сотрудник не успевает в аэропорт.', user: true },
    { text: 'Добрый день! Уже занимаюсь, дайте мне 5 минут.', user: false },
    { text: 'Огромное спасибо! Ожидаю.', user: true },
    { text: 'Все готово! Новый билет уже у вас. Обращайтесь, если смогу еще чем-то помочь. Хорошего дня!', user: false }
  ]
};

/* График появления (мс); перед репликами оператора — typing-индикатор */
var T = {
  msg: [300, 1900, 2700, 4300],
  typing: [[900, 1900], [3300, 4300]]
};
var SETTLED = 4700; /* всё на экране — начало паузы перед fade */

function roundRect(ctx, x, y, w, h, r) {
  var rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  var words = text.split(' ');
  var lines = [];
  var line = '';
  for (var i = 0; i < words.length; i++) {
    var probe = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = probe;
    }
  }
  if (line) { lines.push(line); }
  return lines;
}

function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/* ---- глифы статус-бара (iOS-стиль, тёмные на белом) ---- */
function drawSignal(ctx, x, baseline, s, color) {
  ctx.fillStyle = color;
  var bw = 11 * s;
  var gap = 7 * s;
  [16, 24, 32, 40].forEach(function (hh, i) {
    var h = hh * s;
    roundRect(ctx, x + i * (bw + gap), baseline - h, bw, h, 3 * s);
    ctx.fill();
  });
}

function drawWifi(ctx, cx, baseline, s, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  var dotY = baseline - 4 * s;
  for (var i = 0; i < 3; i++) {
    ctx.lineWidth = 10 * s;
    ctx.beginPath();
    ctx.arc(cx, dotY, (14 + i * 15) * s, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, dotY, 5 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawBattery(ctx, x, cy, s, color) {
  var w = 58 * s;
  var h = 28 * s;
  var y = cy - h / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * s;
  ctx.globalAlpha = 0.45;
  roundRect(ctx, x, y, w, h, 8 * s);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  roundRect(ctx, x + w + 4 * s, cy - 6 * s, 6 * s, 12 * s, 3 * s);
  ctx.fill();
  var pad = 6 * s;
  roundRect(ctx, x + pad, y + pad, (w - pad * 2) * 0.82, h - pad * 2, 4 * s);
  ctx.fill();
}

/**
 * Возвращает { canvas, aspect, draw, cycle, settled }.
 * draw(now) перерисовывает кадр цикла; вызывающий слой сам помечает
 * 3D-текстуру needsUpdate после каждого вызова.
 */
export function createSupportScreenCanvas(opts) {
  opts = opts || {};
  var W = opts.width || 1100;
  var H = Math.round(W / SCREEN_ASPECT);
  var s = W / 1100;

  var canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');

  var fontsReady = (document.fonts && document.fonts.load)
    ? document.fonts.load('600 ' + (46 * s) + 'px "TT Neoris"').catch(function () {})
    : Promise.resolve();

  return Promise.resolve(fontsReady).then(function () {
    /* ---- статичная разметка пузырей (меняется только их появление) ---- */
    var bubbleFont = '400 ' + (38 * s) + 'px ' + FONT;
    var lineH = 54 * s;
    var padX = 44 * s;
    var padY = 34 * s;
    var maxText = 640 * s;
    var gap = 34 * s;

    var y = 560 * s;
    var bubbles = CHAT.messages.map(function (m) {
      ctx.font = bubbleFont;
      var lines = wrapLines(ctx, m.text, maxText);
      var textW = 0;
      lines.forEach(function (l) { textW = Math.max(textW, ctx.measureText(l).width); });
      var w = textW + padX * 2;
      var h = lines.length * lineH + padY * 2 - (lineH - 46 * s);
      var b = { lines: lines, w: w, h: h, user: m.user, x: m.user ? W - 70 * s - w : 70 * s, y: y };
      y += h + gap;
      return b;
    });

    /* ---- статичный хром (перерисовывается под анимацией) ---- */
    function drawStatusBar() {
      var iw = 340 * s;
      var ih = 96 * s;
      roundRect(ctx, (W - iw) / 2, 40 * s, iw, ih, ih / 2);
      ctx.fillStyle = C.island;
      ctx.fill();

      ctx.fillStyle = C.text;
      ctx.font = '600 ' + (46 * s) + 'px ' + FONT;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('9:41', 86 * s, 92 * s);

      drawSignal(ctx, 806 * s, 112 * s, s, C.text);
      drawWifi(ctx, 928 * s, 112 * s, s, C.text);
      drawBattery(ctx, 984 * s, 92 * s, s, C.text);
    }

    function drawHeader() {
      var headY = 280 * s;
      /* пилюля «Поддержка · 24/7» — как в карточке */
      ctx.font = '600 ' + (34 * s) + 'px ' + FONT;
      var pw = ctx.measureText(CHAT.pill).width + 72 * s;
      var ph = 84 * s;
      roundRect(ctx, 70 * s, headY - ph / 2, pw, ph, ph / 2);
      ctx.fillStyle = C.bg;
      ctx.fill();
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 2 * s;
      ctx.stroke();
      ctx.fillStyle = C.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(CHAT.pill, 70 * s + pw / 2, headY);

      /* «● онлайн» справа, зелёный */
      ctx.textAlign = 'right';
      ctx.font = '600 ' + (32 * s) + 'px ' + FONT;
      ctx.fillStyle = C.green;
      ctx.fillText('● ' + CHAT.online, W - 70 * s, headY);

      ctx.strokeStyle = C.border;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(0, 420 * s);
      ctx.lineTo(W, 420 * s);
      ctx.stroke();
    }

    function drawInputBar() {
      var inputY = H - 210 * s;
      roundRect(ctx, 70 * s, inputY, W - 320 * s, 110 * s, 55 * s);
      ctx.fillStyle = C.bg;
      ctx.fill();
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 2 * s;
      ctx.stroke();
      ctx.fillStyle = C.muted;
      ctx.font = '400 ' + (34 * s) + 'px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Сообщение…', 110 * s, inputY + 57 * s);

      var sendCx = W - 130 * s;
      var sendCy = inputY + 55 * s;
      ctx.beginPath();
      ctx.arc(sendCx, sendCy, 55 * s, 0, Math.PI * 2);
      ctx.fillStyle = C.accent;
      ctx.fill();
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 8 * s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(sendCx, sendCy + 22 * s);
      ctx.lineTo(sendCx, sendCy - 22 * s);
      ctx.moveTo(sendCx - 18 * s, sendCy - 2 * s);
      ctx.lineTo(sendCx, sendCy - 22 * s);
      ctx.lineTo(sendCx + 18 * s, sendCy - 2 * s);
      ctx.stroke();
    }

    /* ---- анимируемые части ---- */
    function reveal(t, at) {
      return easeOut(clamp01((t - at) / 340));
    }

    function drawBubble(b, alpha) {
      if (alpha <= 0) { return; }
      var yOff = (1 - alpha) * 24 * s;
      var by = b.y + yOff;
      ctx.globalAlpha = alpha;
      roundRect(ctx, b.x, by, b.w, b.h, 40 * s);
      ctx.fillStyle = b.user ? C.accent : C.opBubble;
      ctx.fill();
      ctx.fillStyle = b.user ? C.white : C.text;
      ctx.font = bubbleFont;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      b.lines.forEach(function (l, i) {
        ctx.fillText(l, b.x + padX, by + padY + 20 * s + i * lineH);
      });
      ctx.globalAlpha = 1;
    }

    /* Typing-пузырь оператора с тремя прыгающими точками — в слоте
       реплики, которая вот-вот придёт */
    function drawTyping(slot, now, alpha) {
      if (alpha <= 0) { return; }
      var w = 150 * s;
      var h = 92 * s;
      var x = 70 * s;
      ctx.globalAlpha = alpha;
      roundRect(ctx, x, slot, w, h, 40 * s);
      ctx.fillStyle = C.opBubble;
      ctx.fill();
      for (var i = 0; i < 3; i++) {
        var phase = Math.sin(now / 1000 * 6 + i * 0.7);
        var dy = phase * 6 * s;
        var a = 0.4 + 0.6 * clamp01((phase + 1) / 2);
        ctx.globalAlpha = alpha * a;
        ctx.fillStyle = C.typing;
        ctx.beginPath();
        ctx.arc(x + 44 * s + i * 32 * s, slot + h / 2 + dy, 9 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function draw(now) {
      var t = ((now % CYCLE) + CYCLE) % CYCLE;
      /* последние 600 мс чат тает, затем цикл начинается пустым */
      var fade = t >= CYCLE - 600 ? clamp01((CYCLE - t) / 600) : 1;

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);

      drawStatusBar();
      drawHeader();

      bubbles.forEach(function (b, i) {
        drawBubble(b, reveal(t, T.msg[i]) * fade);
      });
      /* typing-индикаторы в слотах реплик оператора (индексы 1 и 3) */
      if (t >= T.typing[0][0] && t < T.typing[0][1]) { drawTyping(bubbles[1].y, now, fade); }
      if (t >= T.typing[1][0] && t < T.typing[1][1]) { drawTyping(bubbles[3].y, now, fade); }

      drawInputBar();
    }

    /* Первый кадр — чтобы текстура не была пустой до старта rAF-цикла */
    draw(0);

    return { canvas: canvas, aspect: SCREEN_ASPECT, draw: draw, cycle: CYCLE, settled: SETTLED };
  });
}
