'use strict';

// Весь видимый интерфейс Reelbox. Живёт в Shadow DOM, чтобы стили Instagram
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
    host.id = 'reelbox-host';
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
        /* Под панель «Messages»: тот же тёмный тон, без обводки, и наведение
           подсветкой, а не увеличением. Instagram ничего не масштабирует при
           наведении, поэтому scale выглядел бы здесь чужеродно. */
        /* Фон и подсветка берутся с самой панели «Messages», см. applySurface.
           Значения ниже — только на случай, если панели на странице нет.
           Наведение — накладка поверх фона, а не другой цвет: так оно
           одинаково уместно и в тёмной теме, и в светлой. */
        .btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 0;
          background: var(--reelbox-surface, rgba(38, 38, 38, 0.92));
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
        .btn:hover { box-shadow: inset 0 0 0 999px var(--reelbox-overlay, rgba(255, 255, 255, 0.08)); }
        .btn:active { box-shadow: inset 0 0 0 999px var(--reelbox-overlay-strong, rgba(255, 255, 255, 0.16)); }
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
        @media (prefers-reduced-motion: reduce) {
          .btn, .toast { transition: none; }
          .spinner { animation-duration: 1600ms; }
        }
      </style>
      <div class="wrap" hidden>
        <div class="toast" role="status"></div>
        <div class="row">
          <button class="btn btn-audio" type="button" hidden title="Сохранить только звук">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18V5l10-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="16" cy="16" r="3" />
            </svg>
          </button>
          <button class="btn btn-one" data-state="idle" type="button" title="Сохранить этот кадр">
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
    // Именно из круглой кнопки: иконок в разметке теперь несколько.
    const iconMarkup = one.querySelector('.icon').outerHTML;

    document.documentElement.appendChild(host);

    let toastTimer = null;

    function setState(state) {
      one.dataset.state = state;
      one.innerHTML = state === 'busy' ? '<div class="spinner"></div>' : iconMarkup;
    }

    // Обычный тост гаснет сам. Sticky остаётся висеть: так показывается то,
    // что человек обязан прочитать, например просьба перезагрузить страницу.
    function say(text, options) {
      toast.textContent = text;
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
    function press(handler) {
      return (event) => {
        event.currentTarget.blur();
        handler();
      };
    }

    one.addEventListener('click', press(() => handlers.onSaveOne()));
    audio.addEventListener('click', press(() => handlers.onSaveAudio()));

    // Фон и подсветку берём с панели, а не подбираем на глаз: тогда кнопка
    // остаётся её частью и при смене темы, и при перекраске у Instagram.
    function applySurface(color) {
      const rgb = parseRgb(color);
      if (!rgb) return;
      const light = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 140;
      wrap.style.setProperty('--reelbox-surface', color);
      wrap.style.setProperty('--reelbox-overlay', light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)');
      wrap.style.setProperty('--reelbox-overlay-strong', light ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.16)');
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
      resetTransient() {
        toast.dataset.visible = '0';
        if (one.dataset.state !== 'busy') setState('idle');
      }
    };
  }

  root.ReelboxUI = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
