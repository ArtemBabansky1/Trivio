/* =====================================================================
   TRIVIO v2 · Типограф
   Привязывает короткие предлоги, союзы и частицы к следующему слову
   неразрывным пробелом, чтобы они не висели в конце строки.
   Должен выполняться ДО animations.js (SplitText режет заголовки
   по строкам, и переносы должны учитывать неразрывные пробелы).
   ===================================================================== */
(function () {
  'use strict';

  var NBSP = '\u00A0';

  /* Предлоги, союзы и частицы, которые нельзя оставлять в конце строки */
  var SHORT_WORDS = [
    'в', 'во', 'без', 'до', 'из', 'изо', 'к', 'ко', 'на', 'по',
    'о', 'об', 'обо', 'от', 'ото', 'при', 'с', 'со', 'у', 'за',
    'над', 'под', 'про', 'для', 'из-за', 'из-под',
    'и', 'а', 'но', 'да', 'или', 'либо', 'ни', 'не',
    'же', 'ли', 'бы', 'то', 'ведь', 'вот'
  ];

  var RE = new RegExp(
    '(^|[\\s\\u00A0(«„“\\u2013\\u2014-])(' + SHORT_WORDS.join('|') + ')[ \\t]+',
    'gi'
  );

  function typografText(text) {
    /* Три прохода, чтобы связать цепочки вида «и в …» */
    for (var i = 0; i < 3; i++) {
      text = text.replace(RE, function (m, before, word) {
        return before + word + NBSP;
      });
    }
    return text;
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, SVG: 1 };

  function processTree(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentNode;
        if (!parent || SKIP[parent.nodeName]) { return NodeFilter.FILTER_REJECT; }
        /* Пропускаем узлы без кириллицы и пробелов — там нечего связывать */
        if (!/[а-яё]/i.test(node.nodeValue) || node.nodeValue.indexOf(' ') === -1) {
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var node;
    while ((node = walker.nextNode())) {
      var fixed = typografText(node.nodeValue);
      if (fixed !== node.nodeValue) { node.nodeValue = fixed; }
    }
  }

  /* Скрипт подключён в конце body — DOM уже разобран, работаем сразу */
  processTree(document.body);
})();
