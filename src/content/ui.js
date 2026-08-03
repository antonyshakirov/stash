'use strict';

// Весь видимый интерфейс Reelbox. Живёт в Shadow DOM, чтобы стили Instagram
// до него не дотягивались, а его стили не протекали на страницу.

(function (root) {
  const TOAST_TIME = 2600;
  // Отступы на случай, когда панели «Messages» на странице нет.
  const FALLBACK_RIGHT = 24;
  const FALLBACK_BOTTOM = 88;
  // Зазор между кнопкой и верхним краем панели.
  const GAP = 12;
  // Границы разумного: если измеренное в них не укладывается, значит поймали
  // не панель, а какую-то другую фиксированную обёртку.
  const SANE_RIGHT = [4, 80];
  const SANE_BOTTOM = [40, 260];

  function within(value, range) {
    return value >= range[0] && value <= range[1];
  }

  /**
   * Панель «Messages» прибита к правому нижнему углу. Ищем её не по классам —
   * они генерируются и меняются от сборки к сборке, — а по тому, что реально
   * нарисовано в этом углу экрана.
   */
  function findDock(host) {
    let node = document.elementFromPoint(window.innerWidth - 60, window.innerHeight - 34);

    for (let depth = 0; node && depth < 10; depth += 1) {
      if (node === host || node === document.body || node === document.documentElement) return null;
      if (getComputedStyle(node).position === 'fixed') {
        const rect = node.getBoundingClientRect();
        const tallEnough = rect.height > 24 && rect.height < 140;
        const atBottom = rect.bottom > window.innerHeight - 60;
        if (tallEnough && atBottom) return rect;
      }
      node = node.parentElement;
    }

    return null;
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
        .btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 0;
          background: rgba(38, 38, 38, 0.92);
          backdrop-filter: blur(12px);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          padding: 0;
          font-size: 14px;
          font-weight: 600;
          transition: background 150ms ease, opacity 150ms ease;
        }
        .btn:hover { background: rgba(58, 58, 58, 0.95); }
        .btn:active { background: rgba(28, 28, 28, 0.95); }
        .btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
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

    one.addEventListener('click', () => handlers.onSaveOne());
    audio.addEventListener('click', () => handlers.onSaveAudio());

    function align() {
      const dock = findDock(host);
      let right = FALLBACK_RIGHT;
      let bottom = FALLBACK_BOTTOM;

      if (dock) {
        const measuredRight = Math.round(window.innerWidth - dock.right);
        const measuredBottom = Math.round(window.innerHeight - dock.top + GAP);
        if (within(measuredRight, SANE_RIGHT) && within(measuredBottom, SANE_BOTTOM)) {
          right = measuredRight;
          bottom = measuredBottom;
        }
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
