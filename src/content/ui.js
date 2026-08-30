'use strict';

// Весь видимый интерфейс Stash. Живёт в Shadow DOM, чтобы стили Instagram
// до него не дотягивались, а его стили не протекали на страницу.

(function (root) {
  const TOAST_TIME = 2600;
  // Отступы на случай, когда панели «Messages» на странице нет.
  const FALLBACK_RIGHT = 24;
  const FALLBACK_BOTTOM = 88;
  // Зазор между кнопкой и верхним краем панели.
  const GAP = 16;
  // Границы разумного: если измеренное в них не укладывается, значит поймали
  // не панель, а какую-то другую фиксированную обёртку.
  const SANE_RIGHT = [4, 80];
  const SANE_BOTTOM = [40, 260];

  function within(value, range) {
    return value >= range[0] && value <= range[1];
  }

  function probePoints() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return [
      [w - 30, h - 24],
      [w - 60, h - 30],
      [w - 120, h - 34],
      [w - 30, h - 50],
      [w - 90, h - 52]
    ];
  }

  /**
   * Похоже ли это на саму панель, а не на обёртку вокруг неё. Обёртка обычно
   * тянется на всю ширину окна и прижата к его правому краю, поэтому размеры
   * и отступ справа отсеивают её.
   */
  function plausibleDock(node) {
    const style = getComputedStyle(node);
    if (style.position !== 'fixed') return null;

    const rect = node.getBoundingClientRect();
    if (rect.height < 32 || rect.height > 120) return null;
    if (rect.width < 120 || rect.width > 640) return null;
    if (rect.bottom < window.innerHeight - 80) return null;
    if (rect.right > window.innerWidth - 8) return null;

    return { rect, style, area: rect.width * rect.height };
  }

  /**
   * Панель «Messages» прибита к правому нижнему углу. Ищем её не по классам —
   * они генерируются и меняются от сборки к сборке, — а по тому, что реально
   * нарисовано в этом углу экрана. Пробуем несколько точек и берём самого
   * мелкого подходящего кандидата: это и есть панель, а не контейнер вокруг.
   */
  function findDock(host) {
    const found = [];

    for (const [x, y] of probePoints()) {
      let node = document.elementFromPoint(x, y);
      for (let depth = 0; node && depth < 10; depth += 1) {
        if (node === host || node === document.body || node === document.documentElement) break;
        const candidate = plausibleDock(node);
        if (candidate) found.push(candidate);
        node = node.parentElement;
      }
    }

    if (!found.length) return null;
    found.sort((a, b) => a.area - b.area);
    return found[0];
  }

  function parseRgb(color) {
    const match = /rgba?\(([^)]+)\)/.exec(color || '');
    if (!match) return null;
    const parts = match[1].split(',').map((piece) => Number(piece.trim()));
    if (parts.length < 3 || parts.some((value) => !Number.isFinite(value))) return null;
    // Прозрачный фон брать не у чего: значит поймали не панель.
    if (parts.length > 3 && parts[3] < 0.2) return null;
    return parts;
  }

  function create(handlers) {
    const host = document.createElement('div');
    host.id = 'stash-host';
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap {
          position: fixed;
          right: 24px;
          bottom: 88px;
          z-index: 2147483000;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        }
        .wrap[hidden] { display: none; }
        .row { display: flex; align-items: center; gap: 8px; }
        /* Фон и подсветка берутся с самой панели площадки, см. applySurface;
           значения ниже — только на случай, если панели на странице нет.
           Наведение сделано накладкой поверх фона, а не другим цветом: так
           оно уместно и в тёмной теме, и в светлой. Масштабирования нет —
           площадки при наведении ничего не увеличивают. */
        .btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 0;
          background: var(--stash-surface, rgba(38, 38, 38, 0.92));
          backdrop-filter: blur(12px);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          padding: 0;
          font-size: 14px;
          font-weight: 600;
          transition: box-shadow 150ms ease, opacity 150ms ease;
        }
        .btn:hover { box-shadow: inset 0 0 0 999px var(--stash-overlay, rgba(255, 255, 255, 0.08)); }
        .btn:active { box-shadow: inset 0 0 0 999px var(--stash-overlay-strong, rgba(255, 255, 255, 0.16)); }
        /* Обводка внутрь: снаружи она наползала на панель «Messages». */
        .btn:focus-visible { outline: 2px solid currentColor; outline-offset: -3px; }
        .btn[hidden] { display: none; }
        .btn[data-state="busy"] { opacity: 0.7; cursor: progress; }
        .btn[data-state="done"] { background: rgba(28, 120, 60, 0.86); }
        .btn[data-state="error"] { background: rgba(150, 40, 40, 0.86); }
        .icon { width: 20px; height: 20px; display: block; }
        .spinner {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.28);
          border-top-color: #fff;
          animation: spin 700ms linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .toast {
          max-width: 260px;
          background: rgba(20, 20, 22, 0.9);
          color: #fff;
          font-size: 12px;
          line-height: 1.4;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 150ms ease, transform 150ms ease;
          pointer-events: none;
        }
        .toast[data-visible="1"] { opacity: 1; transform: none; }
        /* Пока висит «Подробности», тост обязан принимать нажатия: без этого
           кнопка видна и не нажимается. У самого тоста они выключены, чтобы он
           не перехватывал клики по странице под собой. */
        .toast:has(.toast-more:not([hidden])) { pointer-events: auto; }
        .toast-more {
          display: block;
          margin-top: 6px;
          padding: 0;
          border: 0;
          background: none;
          color: rgba(255, 255, 255, 0.72);
          font: inherit;
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer;
        }
        .toast-more:hover { color: #fff; }
        .toast-more[hidden] { display: none; }
        .report {
          max-width: 420px;
          background: rgba(20, 20, 22, 0.96);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .report[hidden] { display: none; }
        .report-note {
          font-size: 11px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.6);
        }
        .report-text {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 260px;
          overflow: auto;
          user-select: text;
          -webkit-user-select: text;
        }
        .report-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .report-actions button {
          border: 0;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
          color: #fff;
          background: rgba(255, 255, 255, 0.14);
        }
        .report-actions button:hover { background: rgba(255, 255, 255, 0.22); }
        @media (prefers-reduced-motion: reduce) {
          .btn, .toast { transition: none; }
          .spinner { animation-duration: 1600ms; }
        }
      </style>
      <div class="wrap" hidden>
        <div class="report" hidden>
          <div class="report-note">Details for a bug report</div>
          <div class="report-text"></div>
          <div class="report-actions">
            <button class="report-copy" type="button">Copy</button>
            <button class="report-close" type="button">Close</button>
          </div>
        </div>
        <div class="toast" role="status">
          <span class="toast-text"></span>
          <button class="toast-more" type="button" hidden>Details</button>
        </div>
        <div class="row">
          <button class="btn btn-audio" type="button" hidden title="Save audio only">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18V5l10-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="16" cy="16" r="3" />
            </svg>
          </button>
          <button class="btn btn-one" data-state="idle" type="button" title="Save this frame">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 4v12" />
              <path d="M6 12l6 6 6-6" />
              <path d="M5 20h14" />
            </svg>
          </button>
        </div>
      </div>
    `;

    const wrap = shadow.querySelector('.wrap');
    const one = shadow.querySelector('.btn-one');
    const audio = shadow.querySelector('.btn-audio');
    const toast = shadow.querySelector('.toast');
    const toastText = shadow.querySelector('.toast-text');
    const toastMore = shadow.querySelector('.toast-more');
    const report = shadow.querySelector('.report');
    const reportText = shadow.querySelector('.report-text');
    // Именно из круглой кнопки: иконок в разметке теперь несколько.
    // Держим узлами, а не разметкой: setState зовётся на каждое нажатие, и
    // пересобирать HTML заново незачем. Заодно это снимает второе присваивание
    // innerHTML, на которое ругается проверяльщик дополнений Mozilla.
    const icon = one.querySelector('.icon');
    const spinner = document.createElement('div');
    spinner.className = 'spinner';

    document.documentElement.appendChild(host);

    let toastTimer = null;

    function setState(state) {
      one.dataset.state = state;
      one.replaceChildren(state === 'busy' ? spinner : icon);
    }

    // Обычный тост гаснет сам. Sticky остаётся висеть: так показывается то,
    // что человек обязан прочитать, например просьба перезагрузить страницу.
    function say(text, options) {
      toastText.textContent = text;
      toast.dataset.visible = '1';
      clearTimeout(toastTimer);
      if (options && options.sticky) return;
      toastTimer = setTimeout(() => {
        toast.dataset.visible = '0';
        if (one.dataset.state !== 'busy') setState('idle');
      }, TOAST_TIME);
    }

    // Мышь фокус не оставляет: белое кольцо после клика выглядело поломкой.
    // Для клавиатуры обводка остаётся, focus-visible на blur не реагирует.
    // Обработчики асинхронные, и их отказ никто не ждёт. Без этого перехвата
    // ошибка внутри самого пути обработки ошибок пропала бы бесследно —
    // ровно так однажды и потерялась панель отчёта.
    function press(handler) {
      return (event) => {
        event.currentTarget.blur();
        try {
          const result = handler();
          if (result && typeof result.catch === 'function') {
            result.catch((error) => say(`Stash error: ${error && error.message}`));
          }
        } catch (error) {
          say(`Stash error: ${error && error.message}`);
        }
      };
    }

    // Отчёт об ошибке отдаётся кнопкой, а не консолью: искать его в
    // инструментах разработчика — не работа человека, который смотрит ленту.
    // Развернуть отчёт может только человек, который сам этого захотел.
    toastMore.addEventListener('click', () => {
      report.hidden = false;
      toastMore.hidden = true;
    });

    shadow.querySelector('.report-copy').addEventListener('click', () => {
      const text = reportText.textContent;
      try {
        navigator.clipboard.writeText(text);
        say('Copied.');
      } catch (error) {
        say('Couldn\u2019t copy. Select the text instead.');
      }
    });

    // «Закрыть» убирает и прилипший тост: иначе сообщение об ошибке осталось
    // бы висеть после того, как человек с ней уже разобрался.
    shadow.querySelector('.report-close').addEventListener('click', () => {
      report.hidden = true;
      toast.dataset.visible = '0';
      if (one.dataset.state !== 'busy') setState('idle');
    });

    one.addEventListener('click', press(() => handlers.onSaveOne()));
    audio.addEventListener('click', press(() => handlers.onSaveAudio()));

    // Фон и подсветку берём с панели, а не подбираем на глаз: тогда кнопка
    // остаётся её частью и при смене темы, и при перекраске у Instagram.
    function applySurface(color) {
      const rgb = parseRgb(color);
      if (!rgb) return;
      const light = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 140;
      wrap.style.setProperty('--stash-surface', color);
      wrap.style.setProperty('--stash-overlay', light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)');
      wrap.style.setProperty('--stash-overlay-strong', light ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.16)');
    }

    function align() {
      const dock = findDock(host);
      let right = FALLBACK_RIGHT;
      let bottom = FALLBACK_BOTTOM;

      if (dock) {
        const measuredRight = Math.round(window.innerWidth - dock.rect.right);
        const measuredBottom = Math.round(window.innerHeight - dock.rect.top + GAP);
        if (within(measuredRight, SANE_RIGHT) && within(measuredBottom, SANE_BOTTOM)) {
          right = measuredRight;
          bottom = measuredBottom;
        }
        applySurface(dock.style.backgroundColor);
      }

      wrap.style.right = `${right}px`;
      wrap.style.bottom = `${bottom}px`;
    }

    window.addEventListener('resize', align);

    return {
      setVisible(visible) {
        wrap.hidden = !visible;
        if (visible) align();
      },
      setAudioAvailable(available) {
        audio.hidden = !available;
      },
      setState,
      say,
      /**
       * Отчёт больше не разворачивается сам. Человеку, который просто смотрит
       * ленту, вываленный столбец технических строк ничего не говорит и
       * выглядит поломкой; ему хватает одной фразы в тосте. Отчёт лежит за
       * ссылкой «Подробности» — для тех, кто готов его прислать.
       *
       * Пустой текст убирает и панель, и ссылку: так отчёт не висит от
       * прошлой попытки.
       */
      report(text) {
        report.hidden = true;
        if (!text) {
          toastMore.hidden = true;
          reportText.textContent = '';
          return;
        }
        reportText.textContent = text;
        toastMore.hidden = false;
      },
      /**
       * Переход на другой пост стирает след прошлого: иначе прилипший тост об
       * ошибке и раскрытый отчёт ехали бы за человеком по всей ленте.
       */
      resetTransient() {
        toast.dataset.visible = '0';
        report.hidden = true;
        toastMore.hidden = true;
        reportText.textContent = '';
        if (one.dataset.state !== 'busy') setState('idle');
      }
    };
  }

  root.StashUI = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
