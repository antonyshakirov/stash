# Stash — картинки и карусели. План реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** научить Stash сохранять картинки Instagram — одиночные, слайды каруселей, кадры из ленты, сетки профиля и сторис — по одному нажатию на слайд или разом на всю карусель.

**Architecture:** ядро `extract.js` переходит с плоского списка роликов на модель «пост со слайдами», где Reels становится постом с одним слайдом. Картинка на экране находит свой слайд сопоставлением стабильного сегмента пути CDN-адреса, и этот один механизм закрывает все четыре поверхности сразу. DOM-часть `content.js` разбирается на три файла с одной ответственностью у каждого, а чистая логика уезжает в `src/lib/` под тесты.

**Tech Stack:** Chrome Manifest V3, чистый JavaScript без сборки и зависимостей, `node --test` для юнит-тестов.

Спека: [../specs/2026-08-03-stash-images-design.md](../specs/2026-08-03-stash-images-design.md)

## Global Constraints

- Расширение не делает ни одного запроса к Instagram. Источник данных — только то, что страница уже получила.
- Молчаливых отказов нет ни в одной ветке. Любой неуспех виден в тосте.
- Весь код, комментарии и тексты интерфейса — на русском, как в существующих файлах.
- Зависимостей не добавляем. Сборки нет: расширение ставится распакованным.
- `src/lib/*` не имеет права трогать `document`, `window`, `chrome` и сеть. Это условие тестируемости.
- Папки фиксированы: видео в `Загрузки/Reels`, картинки в `Загрузки/Photos`.
- Версия по итогам работ — `0.2.0` в `manifest.json` и `package.json`.
- Порог «мелкой» картинки: большая сторона меньше `1080` px.
- Порог постовой картинки: меньшая сторона на экране не меньше `180` CSS-пикселей.
- Пауза между загрузками в пакете: `150` мс.

## Структура файлов

| Файл | Ответственность | Статус |
|---|---|---|
| `src/lib/extract.js` | Разбор JSON в посты со слайдами, ключи CDN, имена файлов, папки | Меняется |
| `src/lib/cache.js` | Две карты: посты по идентификатору и слайды по ключу CDN | Создаётся |
| `src/content/target.js` | Что сейчас на экране: элемент, пост, номер слайда | Создаётся |
| `src/content/ui.js` | Shadow DOM: две кнопки, тост, рамка на цели | Создаётся |
| `src/content.js` | Сведение: приём данных, сохранение, жизненный цикл | Сильно ужимается |
| `src/background.js` | Загрузка одиночная и пакетная, папка по типу, память о сохранённом | Меняется |
| `src/interceptor.js` | Перехват ответов | Не меняется |
| `tests/extract.test.js` | Тесты ядра | Переписывается |
| `tests/cache.test.js` | Тесты кэша | Создаётся |

Порядок загрузки в `manifest.json` важен: `src/lib/extract.js` идёт первым везде, `src/lib/cache.js` и файлы `src/content/` — перед `src/content.js`.

---

# Фаза 1. Ядро и открытый пост

### Task 1: Модель «пост со слайдами»

**Files:**
- Modify: `src/lib/extract.js` (переписывается `collectMedia`, добавляются `readImages`, `readChildren`, `readSlide`, `readId`, `mergePosts`)
- Modify: `tests/extract.test.js`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `collectMedia(payload) → Array<Post>`
  - `Post = { code: string|null, pk: string|null, username: string|null, takenAt: number|null, slides: Slide[] }`
  - `Slide = { index: number, kind: 'image'|'video', sources: Source[] }`
  - `Source = { url: string, width: number, height: number }`
  - `mergePosts(previous, candidate) → Post`
  - `index` нумеруется с единицы

- [ ] **Step 1: Написать падающие тесты**

Заменить в `tests/extract.test.js` тесты `находит ролик в глубоко вложенном ответе`, `не находит ничего в ответе без видео`, `понимает старую схему с одиночным video_url`, `собирает несколько роликов из ленты`, `выбирает вариант с наибольшим разрешением` на версии со слайдами и добавить новые. Проверочные функции `sampleResponse` и остальные тесты пока не трогать.

```js
function sampleCarousel() {
  return {
    data: {
      xdt_api__v1__media__shortcode__web_info: {
        items: [
          {
            code: 'DKx9dQ2',
            pk: 3412345678901234567,
            taken_at: 1785542400,
            user: { username: 'nike' },
            carousel_media_count: 3,
            image_versions2: { candidates: [{ url: 'https://cdn/cover_n.jpg', width: 1080, height: 1080 }] },
            carousel_media: [
              {
                pk: '1',
                image_versions2: {
                  candidates: [
                    { url: 'https://cdn/a_n.jpg?stp=p640x640', width: 640, height: 640 },
                    { url: 'https://cdn/a_n.jpg?stp=p1440x1440', width: 1440, height: 1440 }
                  ]
                }
              },
              {
                pk: '2',
                image_versions2: { candidates: [{ url: 'https://cdn/b_n.jpg', width: 1080, height: 1080 }] }
              },
              {
                pk: '3',
                image_versions2: { candidates: [{ url: 'https://cdn/c_cover_n.jpg', width: 1080, height: 1080 }] },
                video_versions: [{ url: 'https://cdn/c_n.mp4', width: 1080, height: 1920 }]
              }
            ]
          }
        ]
      }
    }
  };
}

test('карусель разворачивается в слайды по порядку', () => {
  const posts = extract.collectMedia(sampleCarousel());
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].code, 'DKx9dQ2');
  assert.strictEqual(posts[0].username, 'nike');
  assert.strictEqual(posts[0].takenAt, 1785542400);
  assert.deepStrictEqual(posts[0].slides.map((s) => s.index), [1, 2, 3]);
});

test('дети карусели не всплывают как отдельные посты', () => {
  const posts = extract.collectMedia(sampleCarousel());
  assert.strictEqual(posts.length, 1);
});

test('в смешанной карусели у каждого слайда свой тип', () => {
  const posts = extract.collectMedia(sampleCarousel());
  assert.deepStrictEqual(posts[0].slides.map((s) => s.kind), ['image', 'image', 'video']);
});

test('у видео-слайда в источниках только видео, обложка отбрасывается', () => {
  const posts = extract.collectMedia(sampleCarousel());
  const third = posts[0].slides[2];
  assert.strictEqual(third.sources.length, 1);
  assert.strictEqual(third.sources[0].url, 'https://cdn/c_n.mp4');
});

test('старая схема edge_sidecar_to_children разбирается наравне', () => {
  const payload = {
    graphql: {
      shortcode_media: {
        shortcode: 'CZabc12',
        owner: { username: 'adidas' },
        taken_at_timestamp: 1700000000,
        edge_sidecar_to_children: {
          edges: [
            { node: { display_url: 'https://cdn/one_n.jpg', dimensions: { width: 1080, height: 1350 } } },
            { node: { display_url: 'https://cdn/two_n.jpg', dimensions: { width: 1080, height: 1350 } } }
          ]
        }
      }
    }
  };
  const posts = extract.collectMedia(payload);
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].code, 'CZabc12');
  assert.strictEqual(posts[0].slides.length, 2);
  assert.strictEqual(posts[0].slides[1].sources[0].url, 'https://cdn/two_n.jpg');
});

test('пост с одной картинкой даёт один слайд', () => {
  const payload = {
    items: [
      {
        code: 'AAA',
        user: { username: 'one' },
        image_versions2: { candidates: [{ url: 'https://cdn/x_n.jpg', width: 1080, height: 1080 }] }
      }
    ]
  };
  const posts = extract.collectMedia(payload);
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].slides.length, 1);
  assert.strictEqual(posts[0].slides[0].index, 1);
  assert.strictEqual(posts[0].slides[0].kind, 'image');
});

test('ролик остаётся постом с одним видео-слайдом', () => {
  const posts = extract.collectMedia(sampleResponse());
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].code, 'DKx9dQ2');
  assert.strictEqual(posts[0].slides.length, 1);
  assert.strictEqual(posts[0].slides[0].kind, 'video');
  assert.strictEqual(posts[0].slides[0].sources.length, 3);
});

test('числовой pk превращается в строку', () => {
  const posts = extract.collectMedia(sampleCarousel());
  assert.strictEqual(posts[0].pk, '3412345678901234567');
});

test('пост без кода опознаётся по pk', () => {
  const payload = {
    items: [
      {
        pk: '999',
        user: { username: 'storyteller' },
        taken_at: 1785542400,
        image_versions2: { candidates: [{ url: 'https://cdn/s_n.jpg', width: 1080, height: 1920 }] }
      }
    ]
  };
  const posts = extract.collectMedia(payload);
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].code, null);
  assert.strictEqual(posts[0].pk, '999');
});

test('один пост из двух ответов сливается в самый полный', () => {
  const lean = { items: [{ code: 'AAA', image_versions2: { candidates: [{ url: 'https://cdn/1_n.jpg', width: 640, height: 640 }] } }] };
  const rich = {
    items: [
      {
        code: 'AAA',
        user: { username: 'nike' },
        taken_at: 1785542400,
        carousel_media: [
          { pk: '1', image_versions2: { candidates: [{ url: 'https://cdn/1_n.jpg', width: 1080, height: 1080 }] } },
          { pk: '2', image_versions2: { candidates: [{ url: 'https://cdn/2_n.jpg', width: 1080, height: 1080 }] } }
        ]
      }
    ]
  };
  const merged = extract.mergePosts(extract.collectMedia(lean)[0], extract.collectMedia(rich)[0]);
  assert.strictEqual(merged.slides.length, 2);
  assert.strictEqual(merged.username, 'nike');
  assert.strictEqual(merged.takenAt, 1785542400);
});

test('не спотыкается о мусор вместо ответа', () => {
  assert.deepStrictEqual(extract.collectMedia(null), []);
  assert.deepStrictEqual(extract.collectMedia('строка'), []);
  assert.deepStrictEqual(extract.collectMedia(42), []);
  assert.deepStrictEqual(extract.collectMedia({ video_versions: 'не массив' }), []);
  assert.deepStrictEqual(extract.collectMedia({ carousel_media: 'не массив' }), []);
});

test('переживает циклическую структуру', () => {
  const payload = sampleCarousel();
  payload.self = payload;
  payload.data.parent = payload;
  assert.strictEqual(extract.collectMedia(payload).length, 1);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — `posts[0].slides` не определено, `extract.mergePosts` не функция.

- [ ] **Step 3: Переписать сбор в `src/lib/extract.js`**

Оставить без изменений `isObject`, `firstString`, `readUsername`, `readTakenAt`, `readVideos`, `sanitizeSegment`, `formatDate`, `codeFromPath`, `isDirectVideoUrl`. Удалить `mergeItem`. Заменить `collectMedia`.

```js
  // Идентификатор приходит и строкой, и числом: pk у Instagram числовой.
  function readId(node, keys) {
    for (const key of keys) {
      const value = node[key];
      if (typeof value === 'string' && value) return value;
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return null;
  }

  function readImages(node) {
    const images = [];

    const candidates = isObject(node.image_versions2) ? node.image_versions2.candidates : null;
    if (Array.isArray(candidates)) {
      for (const candidate of candidates) {
        if (!isObject(candidate)) continue;
        if (typeof candidate.url !== 'string' || !candidate.url) continue;
        images.push({
          url: candidate.url,
          width: Number(candidate.width) || 0,
          height: Number(candidate.height) || 0
        });
      }
    }

    if (Array.isArray(node.display_resources)) {
      for (const resource of node.display_resources) {
        if (!isObject(resource)) continue;
        if (typeof resource.src !== 'string' || !resource.src) continue;
        images.push({
          url: resource.src,
          width: Number(resource.config_width) || 0,
          height: Number(resource.config_height) || 0
        });
      }
    }

    if (typeof node.display_url === 'string' && node.display_url) {
      images.push({
        url: node.display_url,
        width: Number(node.dimensions && node.dimensions.width) || 0,
        height: Number(node.dimensions && node.dimensions.height) || 0
      });
    }

    return images;
  }

  /** Слайды карусели в обеих схемах: новой v1 и старой graphql. */
  function readChildren(node) {
    if (Array.isArray(node.carousel_media)) {
      return node.carousel_media.filter(isObject);
    }
    const edges = isObject(node.edge_sidecar_to_children) ? node.edge_sidecar_to_children.edges : null;
    if (Array.isArray(edges)) {
      return edges.map((edge) => (isObject(edge) ? edge.node : null)).filter(isObject);
    }
    return [];
  }

  // У видео-поста есть и обложка, и само видео. Обложка нам не нужна:
  // сохранение обложек отдельно от поста в границы не входит.
  function readSlide(node, index) {
    const videos = readVideos(node);
    if (videos.length) return { index, kind: 'video', sources: videos };
    const images = readImages(node);
    if (images.length) return { index, kind: 'image', sources: images };
    return null;
  }

  function buildPost(node, slides) {
    return {
      code: firstString(node, ['code', 'shortcode']),
      pk: readId(node, ['pk', 'id', 'media_id']),
      username: readUsername(node),
      takenAt: readTakenAt(node),
      slides
    };
  }

  function postKey(post) {
    return post.code || post.pk || (post.slides[0] && post.slides[0].sources[0].url) || null;
  }

  /** Один пост приходит несколько раз и разной полноты: берём лучшее из обоих. */
  function mergePosts(previous, candidate) {
    if (!previous) return candidate;
    if (!candidate) return previous;
    return {
      code: previous.code || candidate.code,
      pk: previous.pk || candidate.pk,
      username: previous.username || candidate.username,
      takenAt: previous.takenAt || candidate.takenAt,
      slides: previous.slides.length >= candidate.slides.length ? previous.slides : candidate.slides
    };
  }

  /**
   * Обходит произвольную структуру и собирает посты со слайдами.
   * Ищет по признаку, а не по адресу внутри ответа, чтобы пережить переезд
   * полей на стороне Instagram.
   */
  function collectMedia(payload) {
    const seen = new Set();
    // Дети карусели: они уже учтены как слайды и своими постами быть не должны.
    const consumed = new Set();
    const drafts = [];
    const stack = [payload];
    let visited = 0;

    while (stack.length) {
      const node = stack.pop();
      if (!isObject(node) || seen.has(node)) continue;
      seen.add(node);
      if (++visited > MAX_NODES) break;

      const children = readChildren(node);
      if (children.length) {
        const slides = [];
        for (const child of children) {
          consumed.add(child);
          const slide = readSlide(child, slides.length + 1);
          if (slide) slides.push(slide);
        }
        if (slides.length) drafts.push({ node, post: buildPost(node, slides) });
      } else {
        const slide = readSlide(node, 1);
        if (slide) drafts.push({ node, post: buildPost(node, [slide]) });
      }

      for (const value of Object.values(node)) {
        if (isObject(value)) stack.push(value);
      }
    }

    // Отсев детей делается после обхода: порядок обхода не гарантирован,
    // и ребёнок мог быть разобран раньше своего родителя.
    const found = new Map();
    for (const draft of drafts) {
      if (consumed.has(draft.node)) continue;
      const key = postKey(draft.post);
      if (!key) continue;
      found.set(key, mergePosts(found.get(key), draft.post));
    }

    return Array.from(found.values());
  }
```

В блоке `return` добавить `mergePosts` рядом с `collectMedia`. `bestVideo` остаётся на месте и в экспорте: он переименовывается в Task 3, а до тех пор на него опираются тесты.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS для новых тестов. Тесты `bestVideo`, `имя файла…` временно падают — они переписываются в Task 3, это ожидаемо и допустимо только внутри этой задачи.

- [ ] **Step 5: Починить оставшиеся тесты минимально**

Чтобы задача закрывалась зелёным прогоном, в `tests/extract.test.js` заменить обращения к старой форме в тестах `bestVideo` на слайды:

```js
test('выбирает вариант с наибольшим разрешением', () => {
  const posts = extract.collectMedia(sampleResponse());
  const best = extract.bestVideo(posts[0].slides[0].sources);
  assert.strictEqual(best.url, 'https://cdn.example/1080.mp4');
});
```

Тесты `имя файла складывается…` и `имя файла опускает…` оставить как есть: `buildFilename` пока принимает старую форму.

- [ ] **Step 6: Прогнать всё и закоммитить**

Run: `npm test`
Expected: PASS, все тесты.

```bash
git add src/lib/extract.js tests/extract.test.js
git commit -m "feat: ядро собирает посты со слайдами и разворачивает карусели"
```

---

### Task 2: Ключ файла на CDN и расширение

**Files:**
- Modify: `src/lib/extract.js`
- Modify: `tests/extract.test.js`

**Interfaces:**
- Consumes: ничего из Task 1
- Produces:
  - `mediaKeyFromUrl(url) → string|null` — последний сегмент пути без query
  - `extensionFromUrl(url, kind) → string` — расширение без точки, умолчание `mp4` для `'video'` и `jpg` для всего прочего

- [ ] **Step 1: Написать падающие тесты**

Добавить в `tests/extract.test.js`:

```js
test('ключ CDN одинаков у одного файла в разных размерах', () => {
  const small = 'https://scontent-a.cdninstagram.com/v/t51.2885-15/123_456_n.jpg?stp=dst-jpg_e35_p640x640&oh=aa&oe=bb';
  const large = 'https://scontent-z.cdninstagram.com/v/t51.2885-15/123_456_n.jpg?stp=dst-jpg_e35_p1440x1440&oh=cc&oe=dd';
  assert.strictEqual(extract.mediaKeyFromUrl(small), '123_456_n.jpg');
  assert.strictEqual(extract.mediaKeyFromUrl(small), extract.mediaKeyFromUrl(large));
});

test('ключ CDN различает разные файлы', () => {
  assert.notStrictEqual(
    extract.mediaKeyFromUrl('https://cdn/v/t51/111_n.jpg?x=1'),
    extract.mediaKeyFromUrl('https://cdn/v/t51/222_n.jpg?x=1')
  );
});

test('ключ CDN не строится из мусора', () => {
  assert.strictEqual(extract.mediaKeyFromUrl(null), null);
  assert.strictEqual(extract.mediaKeyFromUrl(''), null);
  assert.strictEqual(extract.mediaKeyFromUrl(42), null);
  assert.strictEqual(extract.mediaKeyFromUrl('https://cdn/v/t51/'), null);
});

test('расширение читается из адреса с параметрами', () => {
  assert.strictEqual(extract.extensionFromUrl('https://cdn/v/a_n.jpg?stp=p1080x1080', 'image'), 'jpg');
  assert.strictEqual(extract.extensionFromUrl('https://cdn/v/a_n.webp?x=1', 'image'), 'webp');
  assert.strictEqual(extract.extensionFromUrl('https://cdn/v/a_n.heic', 'image'), 'heic');
  assert.strictEqual(extract.extensionFromUrl('https://cdn/v/a_n.MP4?x=1', 'video'), 'mp4');
});

test('незнакомое расширение заменяется умолчанием по типу', () => {
  assert.strictEqual(extract.extensionFromUrl('https://cdn/v/a_n.bin', 'image'), 'jpg');
  assert.strictEqual(extract.extensionFromUrl('https://cdn/v/a_n.bin', 'video'), 'mp4');
  assert.strictEqual(extract.extensionFromUrl('https://cdn/v/noext?x=1', 'image'), 'jpg');
  assert.strictEqual(extract.extensionFromUrl(null, 'video'), 'mp4');
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — `extract.mediaKeyFromUrl` не функция.

- [ ] **Step 3: Реализовать**

Рядом с `FORBIDDEN_IN_NAME` в `src/lib/extract.js`:

```js
  // Расширения, которые Instagram реально отдаёт. Всё прочее — не наше дело.
  const KNOWN_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'mp4']);
```

Перед блоком `return`:

```js
  /**
   * Последний сегмент пути CDN-адреса. У Instagram он один и тот же для
   * одного файла в любом размере: размер живёт в query (`stp`), подпись в
   * `oh` и `oe`, и они меняются от запроса к запросу.
   */
  function mediaKeyFromUrl(url) {
    if (typeof url !== 'string' || !url) return null;
    const path = url.split('?')[0].split('#')[0];
    const segment = path.slice(path.lastIndexOf('/') + 1);
    return segment || null;
  }

  function extensionFromUrl(url, kind) {
    const fallback = kind === 'video' ? 'mp4' : 'jpg';
    const key = mediaKeyFromUrl(url);
    if (!key) return fallback;
    const dot = key.lastIndexOf('.');
    if (dot < 1) return fallback;
    const extension = key.slice(dot + 1).toLowerCase();
    return KNOWN_EXTENSIONS.has(extension) ? extension : fallback;
  }
```

Добавить `mediaKeyFromUrl` и `extensionFromUrl` в блок `return`.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Закоммитить**

```bash
git add src/lib/extract.js tests/extract.test.js
git commit -m "feat: стабильный ключ файла CDN и расширение из адреса"
```

---

### Task 3: Имя файла, выбор источника, папка и ключ дедупликации

**Files:**
- Modify: `src/lib/extract.js`
- Modify: `tests/extract.test.js`

**Interfaces:**
- Consumes: `Post`, `Slide`, `Source` из Task 1; `extensionFromUrl` из Task 2
- Produces:
  - `bestSource(sources) → Source|null` (заменяет `bestVideo`)
  - `buildFilename(post, slide) → string`
  - `folderFor(kind) → 'Reels'|'Photos'`
  - `downloadKey(post, slide) → string|null`

- [ ] **Step 1: Написать падающие тесты**

В `tests/extract.test.js` удалить тесты `выбирает вариант с наибольшим разрешением`, `bestVideo возвращает null на пустом наборе`, `имя файла складывается из автора, даты и кода`, `имя файла опускает то, чего не знает` и добавить:

```js
function samplePost(slideCount) {
  const slides = [];
  for (let i = 1; i <= slideCount; i += 1) {
    slides.push({ index: i, kind: 'image', sources: [{ url: `https://cdn/v/${i}_n.jpg?stp=p1080x1080`, width: 1080, height: 1080 }] });
  }
  return { code: 'DKx9dQ2', pk: '999', username: 'nike', takenAt: 1785542400, slides };
}

test('выбирает вариант с наибольшим разрешением', () => {
  const posts = extract.collectMedia(sampleResponse());
  assert.strictEqual(extract.bestSource(posts[0].slides[0].sources).url, 'https://cdn.example/1080.mp4');
});

test('bestSource возвращает null на пустом наборе', () => {
  assert.strictEqual(extract.bestSource([]), null);
  assert.strictEqual(extract.bestSource(null), null);
});

test('имя одиночного поста без номера слайда', () => {
  const post = samplePost(1);
  assert.strictEqual(extract.buildFilename(post, post.slides[0]), 'nike — 2026-08-01 — DKx9dQ2.jpg');
});

test('имя слайда карусели с номером', () => {
  const post = samplePost(7);
  assert.strictEqual(extract.buildFilename(post, post.slides[2]), 'nike — 2026-08-01 — DKx9dQ2 — 3.jpg');
});

test('имя ролика не изменилось', () => {
  const posts = extract.collectMedia(sampleResponse());
  assert.strictEqual(extract.buildFilename(posts[0], posts[0].slides[0]), 'nike — 2026-08-01 — DKx9dQ2.mp4');
});

test('имя опускает то, чего не знает', () => {
  const slide = { index: 1, kind: 'image', sources: [{ url: 'https://cdn/v/x_n.jpg', width: 1080, height: 1080 }] };
  assert.strictEqual(
    extract.buildFilename({ code: 'DKx9dQ2', slides: [slide] }, slide),
    'instagram — DKx9dQ2.jpg'
  );
  assert.strictEqual(
    extract.buildFilename({ username: 'nike', slides: [slide] }, slide),
    'nike.jpg'
  );
});

test('без кода в имя идёт pk', () => {
  const slide = { index: 1, kind: 'image', sources: [{ url: 'https://cdn/v/x_n.jpg', width: 1080, height: 1080 }] };
  assert.strictEqual(
    extract.buildFilename({ code: null, pk: '999', username: 'nike', slides: [slide] }, slide),
    'nike — 999.jpg'
  );
});

test('папка выбирается по типу слайда', () => {
  assert.strictEqual(extract.folderFor('video'), 'Reels');
  assert.strictEqual(extract.folderFor('image'), 'Photos');
  assert.strictEqual(extract.folderFor(undefined), 'Photos');
});

test('ключ дедупликации одиночного поста — просто код', () => {
  const post = samplePost(1);
  assert.strictEqual(extract.downloadKey(post, post.slides[0]), 'DKx9dQ2');
});

test('ключ дедупликации слайда карусели содержит номер', () => {
  const post = samplePost(7);
  assert.strictEqual(extract.downloadKey(post, post.slides[2]), 'DKx9dQ2#3');
});

test('ключ дедупликации без кода строится на pk', () => {
  const post = samplePost(1);
  post.code = null;
  assert.strictEqual(extract.downloadKey(post, post.slides[0]), '999');
});

test('без кода и pk ключа нет', () => {
  const post = samplePost(1);
  post.code = null;
  post.pk = null;
  assert.strictEqual(extract.downloadKey(post, post.slides[0]), null);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — `extract.bestSource` не функция.

- [ ] **Step 3: Реализовать**

В `src/lib/extract.js` переименовать `bestVideo` в `bestSource` (тело не меняется), заменить `buildFilename` и добавить две функции:

```js
  function buildFilename(post, slide) {
    const parts = [];
    const username = post && post.username ? sanitizeSegment(post.username) : '';
    const id = post && (post.code || post.pk) ? sanitizeSegment(post.code || post.pk) : '';

    parts.push(username || 'instagram');
    if (post && post.takenAt) parts.push(formatDate(post.takenAt));
    if (id) parts.push(id);

    // Номер нужен только там, где слайдов больше одного: у обычного поста
    // хвост « — 1» был бы шумом.
    const many = post && Array.isArray(post.slides) && post.slides.length > 1;
    if (many && slide && slide.index) parts.push(String(slide.index));

    const source = slide ? bestSource(slide.sources) : null;
    const extension = extensionFromUrl(source && source.url, slide && slide.kind);

    return parts.filter(Boolean).join(' — ') + '.' + extension;
  }

  function folderFor(kind) {
    return kind === 'video' ? 'Reels' : 'Photos';
  }

  /**
   * Ключ «уже сохранено». У поста с одним слайдом это просто код, поэтому
   * ролики, сохранённые прошлой версией, не поедут заново.
   */
  function downloadKey(post, slide) {
    const id = (post && (post.code || post.pk)) || null;
    if (!id) return null;
    const many = post && Array.isArray(post.slides) && post.slides.length > 1;
    return many && slide && slide.index ? `${id}#${slide.index}` : String(id);
  }
```

В блоке `return` заменить `bestVideo` на `bestSource` и добавить `folderFor`, `downloadKey`.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Закоммитить**

```bash
git add src/lib/extract.js tests/extract.test.js
git commit -m "feat: имена слайдов, папка по типу и ключ дедупликации"
```

---

### Task 4: Кэш из двух карт

**Files:**
- Create: `src/lib/cache.js`
- Create: `tests/cache.test.js`
- Modify: `package.json` (тестовый скрипт на всю папку)
- Modify: `manifest.json` (файл в обоих списках `content_scripts`)

**Interfaces:**
- Consumes: `collectMedia`, `mergePosts`, `mediaKeyFromUrl` из Tasks 1–2
- Produces:
  - `StashCache.create() → cache`
  - `cache.ingest(posts) → number` — сколько постов принято
  - `cache.get(id) → Post|null`
  - `cache.findByMediaKey(key) → { post, slide }|null`
  - `cache.count() → number`

- [ ] **Step 1: Написать падающие тесты**

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const extract = require('../src/lib/extract.js');
const cacheModule = require('../src/lib/cache.js');

function post(code, slideCount) {
  const slides = [];
  for (let i = 1; i <= slideCount; i += 1) {
    slides.push({
      index: i,
      kind: 'image',
      sources: [
        { url: `https://a.cdninstagram.com/v/t51/${code}_${i}_n.jpg?stp=p640x640`, width: 640, height: 640 },
        { url: `https://b.cdninstagram.com/v/t51/${code}_${i}_n.jpg?stp=p1080x1080`, width: 1080, height: 1080 }
      ]
    });
  }
  return { code, pk: null, username: 'nike', takenAt: 1785542400, slides };
}

test('кладёт пост и отдаёт его по коду', () => {
  const cache = cacheModule.create();
  assert.strictEqual(cache.ingest([post('AAA', 1)]), 1);
  assert.strictEqual(cache.get('AAA').username, 'nike');
  assert.strictEqual(cache.count(), 1);
});

test('находит слайд по ключу файла в любом размере', () => {
  const cache = cacheModule.create();
  cache.ingest([post('AAA', 3)]);
  const hit = cache.findByMediaKey(extract.mediaKeyFromUrl('https://z.cdninstagram.com/v/t51/AAA_2_n.jpg?stp=p320x320&oh=q'));
  assert.strictEqual(hit.post.code, 'AAA');
  assert.strictEqual(hit.slide.index, 2);
});

test('неизвестный ключ ничего не находит', () => {
  const cache = cacheModule.create();
  cache.ingest([post('AAA', 1)]);
  assert.strictEqual(cache.findByMediaKey('нет_такого_n.jpg'), null);
  assert.strictEqual(cache.findByMediaKey(null), null);
});

test('повторный приём того же поста сливает, а не плодит', () => {
  const cache = cacheModule.create();
  cache.ingest([post('AAA', 1)]);
  cache.ingest([post('AAA', 4)]);
  assert.strictEqual(cache.count(), 1);
  assert.strictEqual(cache.get('AAA').slides.length, 4);
  assert.strictEqual(cache.findByMediaKey('AAA_4_n.jpg').slide.index, 4);
});

test('пост без кода живёт по pk', () => {
  const cache = cacheModule.create();
  const story = post('BBB', 1);
  story.code = null;
  story.pk = '777';
  cache.ingest([story]);
  assert.strictEqual(cache.get('777').pk, '777');
  assert.strictEqual(cache.findByMediaKey('BBB_1_n.jpg').post.pk, '777');
});

test('пост без кода и без pk не принимается', () => {
  const cache = cacheModule.create();
  const orphan = post('CCC', 1);
  orphan.code = null;
  orphan.pk = null;
  assert.strictEqual(cache.ingest([orphan]), 0);
  assert.strictEqual(cache.count(), 0);
});

test('мусор на входе не роняет кэш', () => {
  const cache = cacheModule.create();
  assert.strictEqual(cache.ingest(null), 0);
  assert.strictEqual(cache.ingest('строка'), 0);
  assert.strictEqual(cache.ingest([null, 42, {}, { slides: [] }]), 0);
  assert.strictEqual(cache.count(), 0);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Сначала перевести тестовый скрипт на всю папку — в `package.json`:

```json
    "test": "node --test tests/",
```

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/lib/cache.js'`

- [ ] **Step 3: Реализовать кэш**

```js
'use strict';

// Кэш вкладки: посты по идентификатору и слайды по ключу файла на CDN.
// Вторая карта нужна, чтобы картинка на экране находила свой слайд одним
// обращением, а не перебором всех постов на каждое движение мыши.
// Чистый модуль: ни document, ни chrome, ни сети.

(function (root, factory) {
  const api = factory(root.StashExtract || (typeof require === 'function' ? require('./extract.js') : null));
  root.StashCache = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (extract) {
  function isObject(value) {
    return value !== null && typeof value === 'object';
  }

  function identify(post) {
    return post.code || post.pk || null;
  }

  function create() {
    const posts = new Map();
    const keys = new Map();

    function indexSlides(id, post) {
      for (const slide of post.slides) {
        for (const source of slide.sources) {
          const key = extract.mediaKeyFromUrl(source.url);
          if (key) keys.set(key, { id, index: slide.index });
        }
      }
    }

    function ingest(list) {
      if (!Array.isArray(list)) return 0;
      let accepted = 0;

      for (const post of list) {
        if (!isObject(post) || !Array.isArray(post.slides) || !post.slides.length) continue;
        const id = identify(post);
        if (!id) continue;

        const merged = extract.mergePosts(posts.get(id), post);
        posts.set(id, merged);
        indexSlides(id, merged);
        accepted += 1;
      }

      return accepted;
    }

    function get(id) {
      return posts.get(id) || null;
    }

    function findByMediaKey(key) {
      if (!key) return null;
      const hit = keys.get(key);
      if (!hit) return null;
      const post = posts.get(hit.id);
      if (!post) return null;
      const slide = post.slides.find((candidate) => candidate.index === hit.index);
      return slide ? { post, slide } : null;
    }

    return { ingest, get, findByMediaKey, count: () => posts.size };
  }

  return { create };
});
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS, оба файла тестов.

- [ ] **Step 5: Подключить файл в манифест**

В `manifest.json` в обоих блоках `content_scripts` добавить `src/lib/cache.js` сразу после `src/lib/extract.js`:

```json
      "js": ["src/lib/extract.js", "src/lib/cache.js", "src/interceptor.js"],
```

```json
      "js": ["src/lib/extract.js", "src/lib/cache.js", "src/content.js"],
```

- [ ] **Step 6: Закоммитить**

```bash
git add src/lib/cache.js tests/cache.test.js package.json manifest.json
git commit -m "feat: кэш постов с индексом по ключу файла CDN"
```

---

### Task 5: Загрузка по типу слайда и пакетом

**Files:**
- Modify: `src/background.js`

**Interfaces:**
- Consumes: `folderFor`, `downloadKey` вызываются на стороне `content.js`, сюда приходят готовыми
- Produces: два сообщения service worker'а
  - `{ kind: 'download', url, filename, folder, key }` → `{ ok, filename }` | `{ ok: false, duplicate: true, filename }` | `{ ok: false, error }`
  - `{ kind: 'download-batch', items: [{ url, filename, folder, key }] }` → `{ saved, skipped, failed, firstError }`
  - Сообщение вкладке при срыве: `{ kind: 'download-failed', key, url, filename, folder, error }`

- [ ] **Step 1: Заменить работу с папкой и ключом**

В `src/background.js` удалить константу `SUBFOLDER` и переписать `remember`, `forget`, `startDownload` на ключ вместо кода:

```js
const SAVED_KEY = 'saved';
const BATCH_GAP = 150;

// downloadId -> откуда пришла загрузка, чтобы сообщить вкладке о срыве.
const inFlight = new Map();

async function readSaved() {
  const store = await chrome.storage.local.get(SAVED_KEY);
  return store[SAVED_KEY] || {};
}

async function remember(key, filename) {
  if (!key) return;
  const saved = await readSaved();
  saved[key] = { filename, at: Date.now() };
  await chrome.storage.local.set({ [SAVED_KEY]: saved });
}

async function forget(key) {
  if (!key) return;
  const saved = await readSaved();
  if (!saved[key]) return;
  delete saved[key];
  await chrome.storage.local.set({ [SAVED_KEY]: saved });
}

async function startDownload(item, sender) {
  const { url, filename, folder, key } = item;
  if (!url || !filename || !folder) return { ok: false, error: 'Нечего сохранять' };

  const saved = await readSaved();
  if (key && saved[key]) {
    return { ok: false, duplicate: true, filename: saved[key].filename };
  }

  try {
    const id = await chrome.downloads.download({
      url,
      filename: `${folder}/${filename}`,
      conflictAction: 'uniquify',
      saveAs: false
    });
    inFlight.set(id, { tabId: sender.tab ? sender.tab.id : null, key, url, filename, folder });
    await remember(key, filename);
    return { ok: true, id, filename };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
}
```

- [ ] **Step 2: Добавить пакетную загрузку**

Ниже `startDownload`:

```js
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Пауза между файлами: залп из двадцати запросов Chrome переваривает плохо,
// а карусель длиннее двадцати слайдов не бывает.
async function startBatch(items, sender) {
  const report = { saved: 0, skipped: 0, failed: 0, firstError: null };
  if (!Array.isArray(items) || !items.length) return report;

  for (let i = 0; i < items.length; i += 1) {
    const result = await startDownload(items[i], sender);
    if (result.ok) report.saved += 1;
    else if (result.duplicate) report.skipped += 1;
    else {
      report.failed += 1;
      if (!report.firstError) report.firstError = result.error || 'загрузка не началась';
    }
    if (i < items.length - 1) await wait(BATCH_GAP);
  }

  return report;
}
```

- [ ] **Step 3: Развести сообщения**

Заменить существующий `chrome.runtime.onMessage.addListener`:

```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined;

  if (message.kind === 'download') {
    startDownload(message, sender).then(sendResponse);
    return true;
  }

  if (message.kind === 'download-batch') {
    startBatch(message.items, sender).then(sendResponse);
    return true;
  }

  return undefined;
});
```

- [ ] **Step 4: Поправить обработчик срыва**

В `chrome.downloads.onChanged` заменить `entry.code` на `entry.key` и добавить `folder` в сообщение вкладке:

```js
  if (delta.state && delta.state.current === 'interrupted') {
    inFlight.delete(delta.id);
    await forget(entry.key);
    if (entry.tabId != null) {
      try {
        await chrome.tabs.sendMessage(entry.tabId, {
          kind: 'download-failed',
          key: entry.key,
          url: entry.url,
          filename: entry.filename,
          folder: entry.folder,
          error: (delta.error && delta.error.current) || 'загрузка прервана'
        });
      } catch (error) {
        /* вкладку закрыли, сообщать некому */
      }
    }
  }
```

- [ ] **Step 5: Проверить, что расширение грузится**

Открыть `chrome://extensions`, нажать «Обновить» на карточке Stash. Ошибок в service worker быть не должно. Функциональной проверки на этом шаге нет: `content.js` ещё шлёт старую форму сообщения и сохранение временно сломано — это чинится в Task 8.

- [ ] **Step 6: Закоммитить**

```bash
git add src/background.js
git commit -m "feat: загрузка по типу слайда и пакетом с отчётом"
```

---

### Task 6: Определение цели на экране

**Files:**
- Create: `src/content/target.js`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: `StashCache` из Task 4, `codeFromPath` и `mediaKeyFromUrl` из `StashExtract`
- Produces: `StashTarget.create(cache) → target`
  - `target.current() → { element, post, slide, guessed } | null`
  - `target.setHovered(element)` — вызывается из `content.js` по `mouseover`
  - `guessed: true` означает, что слайд не сопоставился и взят первый

В этой задаче реализуется только «самый крупный видимый». Наведение подключается в Task 9 фазы 2: метод `setHovered` уже есть, но `current()` его пока не учитывает.

- [ ] **Step 1: Создать файл**

```js
'use strict';

// Что сейчас на экране: элемент, его пост и номер слайда.
// Единственный файл, который знает про вёрстку Instagram.

(function (root) {
  const extract = root.StashExtract;
  if (!extract) return;

  // Порог отсекает аватарки: в шапке профиля на десктопе они 150 CSS-пикселей.
  const MIN_SIDE = 180;
  const CDN_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

  function visibleBox(element) {
    const box = element.getBoundingClientRect();
    const width = Math.max(0, Math.min(box.right, window.innerWidth) - Math.max(box.left, 0));
    const height = Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0));
    return { box, width, height, area: width * height };
  }

  function onCdn(url) {
    if (typeof url !== 'string' || !url) return false;
    try {
      return CDN_HOST.test(new URL(url, location.href).hostname);
    } catch (error) {
      return false;
    }
  }

  /** Постовая картинка: с CDN Instagram и достаточно крупная на экране. */
  function isPostImage(element) {
    if (!element || element.tagName !== 'IMG') return false;
    if (!onCdn(element.currentSrc || element.src)) return false;
    const seen = visibleBox(element);
    return Math.min(seen.width, seen.height) >= MIN_SIDE;
  }

  function isPostVideo(element) {
    if (!element || element.tagName !== 'VIDEO') return false;
    const seen = visibleBox(element);
    return Math.min(seen.width, seen.height) >= MIN_SIDE;
  }

  function largestVisible() {
    let best = null;
    let bestArea = 0;
    for (const element of document.querySelectorAll('video, img')) {
      if (!isPostVideo(element) && !isPostImage(element)) continue;
      const seen = visibleBox(element);
      if (seen.area > bestArea) {
        bestArea = seen.area;
        best = element;
      }
    }
    return best;
  }

  // --- поиск слайда --------------------------------------------------------

  function indexFromUrl() {
    const raw = new URLSearchParams(location.search).get('img_index');
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  /** Позиция слайда в карусели по положению его <li> среди соседей. */
  function indexFromDom(element) {
    const item = element.closest ? element.closest('li') : null;
    if (!item || !item.parentElement) return null;
    const siblings = Array.from(item.parentElement.children).filter((node) => node.tagName === 'LI');
    const position = siblings.indexOf(item);
    return position >= 0 ? position + 1 : null;
  }

  function codeFromNearestLink(element) {
    let node = element;
    for (let depth = 0; node && depth < 12; depth += 1) {
      const link = node.querySelector
        ? node.querySelector('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"], a[href*="/tv/"]')
        : null;
      if (link) {
        try {
          const code = extract.codeFromPath(new URL(link.href, location.origin).pathname);
          if (code) return code;
        } catch (error) {
          /* битая ссылка, идём выше */
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function create(cache) {
    let hovered = null;

    function resolve(element) {
      if (!element) return null;

      // Основной путь: адрес самого файла ведёт прямо в слайд.
      const byKey = cache.findByMediaKey(extract.mediaKeyFromUrl(element.currentSrc || element.src));
      if (byKey) return { element, post: byKey.post, slide: byKey.slide, guessed: false };

      // У видео в src обычно blob:, поэтому пост ищется по адресу страницы.
      const code = extract.codeFromPath(location.pathname) || codeFromNearestLink(element);
      const post = code ? cache.get(code) : null;
      // Цель на экране есть, данных о ней нет. Возвращаем её всё равно:
      // кнопка должна появиться и честно сказать, что источник не найден,
      // а не молча исчезнуть.
      if (!post) return { element, post: null, slide: null, guessed: false };

      const wanted = indexFromUrl() || indexFromDom(element);
      const slide = post.slides.find((candidate) => candidate.index === wanted);
      if (slide) return { element, post, slide, guessed: false };

      return { element, post, slide: post.slides[0], guessed: post.slides.length > 1 };
    }

    return {
      setHovered(element) {
        if (isPostImage(element) || isPostVideo(element)) hovered = element;
      },
      current() {
        return resolve(largestVisible());
      }
    };
  }

  root.StashTarget = { create, isPostImage, isPostVideo, visibleBox };
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 2: Подключить в манифест**

Во втором блоке `content_scripts` (тот, что `document_idle`):

```json
      "js": ["src/lib/extract.js", "src/lib/cache.js", "src/content/target.js", "src/content.js"],
```

- [ ] **Step 3: Проверить, что файл грузится**

Run: `npm test`
Expected: PASS — тесты не затронуты.

Обновить расширение на `chrome://extensions`, открыть любой пост Instagram, в консоли страницы выполнить `typeof StashTarget`.
Expected: `"object"`.

- [ ] **Step 4: Закоммитить**

```bash
git add src/content/target.js manifest.json
git commit -m "feat: определение цели на экране и номера слайда"
```

---

### Task 7: Интерфейс — две кнопки, тост, рамка

**Files:**
- Create: `src/content/ui.js`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: ничего
- Produces: `StashUI.create({ onSaveOne, onSaveAll }) → ui`
  - `ui.setVisible(boolean)`
  - `ui.setAllCount(number)` — `0` или `1` прячет вторую кнопку
  - `ui.setState('idle'|'busy'|'done'|'error')`
  - `ui.say(text)`
  - `ui.highlight(rect|null)` — рамка на цели, `rect` в координатах окна

Рамка создаётся здесь, но вызывается только в Task 9. До тех пор она всегда скрыта.

- [ ] **Step 1: Создать файл**

Разметку, стили и логику тоста перенести из `src/content.js` (строки 141–256) и дополнить.

```js
'use strict';

// Весь видимый интерфейс Stash. Живёт в Shadow DOM, чтобы стили Instagram
// до него не дотягивались, а его стили не протекали на страницу.

(function (root) {
  const TOAST_TIME = 2600;

  function create(handlers) {
    const host = document.createElement('div');
    host.id = 'stash-host';
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .frame {
          position: fixed;
          border: 2px solid rgba(255, 255, 255, 0.9);
          border-radius: 6px;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
          pointer-events: none;
          z-index: 2147482999;
          transition: opacity 120ms ease;
        }
        .frame[hidden] { display: none; }
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
        .btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(20, 20, 22, 0.62);
          backdrop-filter: blur(12px);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          padding: 0;
          font-size: 14px;
          font-weight: 600;
          transition: background 150ms ease, transform 150ms ease, opacity 150ms ease;
        }
        .btn:hover { background: rgba(20, 20, 22, 0.86); transform: scale(1.05); }
        .btn:active { transform: scale(0.96); }
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
          .btn, .toast, .frame { transition: none; }
          .btn:hover { transform: none; }
          .spinner { animation-duration: 1600ms; }
        }
      </style>
      <div class="frame" hidden></div>
      <div class="wrap" hidden>
        <div class="toast" role="status"></div>
        <div class="row">
          <button class="btn btn-all" type="button" hidden title="Сохранить всю карусель"></button>
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

    const frame = shadow.querySelector('.frame');
    const wrap = shadow.querySelector('.wrap');
    const one = shadow.querySelector('.btn-one');
    const all = shadow.querySelector('.btn-all');
    const toast = shadow.querySelector('.toast');
    const iconMarkup = shadow.querySelector('.icon').outerHTML;

    document.documentElement.appendChild(host);

    let toastTimer = null;

    function setState(state) {
      one.dataset.state = state;
      one.innerHTML = state === 'busy' ? '<div class="spinner"></div>' : iconMarkup;
    }

    function say(text) {
      toast.textContent = text;
      toast.dataset.visible = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.dataset.visible = '0';
        if (one.dataset.state !== 'busy') setState('idle');
      }, TOAST_TIME);
    }

    one.addEventListener('click', () => handlers.onSaveOne());
    all.addEventListener('click', () => handlers.onSaveAll());

    return {
      setVisible(visible) {
        wrap.hidden = !visible;
        if (!visible) frame.hidden = true;
      },
      setAllCount(count) {
        const many = Number(count) > 1;
        all.hidden = !many;
        if (many) all.textContent = String(count);
      },
      setState,
      say,
      highlight(rect) {
        if (!rect) {
          frame.hidden = true;
          return;
        }
        frame.hidden = false;
        frame.style.left = `${Math.round(rect.left)}px`;
        frame.style.top = `${Math.round(rect.top)}px`;
        frame.style.width = `${Math.round(rect.width)}px`;
        frame.style.height = `${Math.round(rect.height)}px`;
      },
      resetTransient() {
        toast.dataset.visible = '0';
        if (one.dataset.state !== 'busy') setState('idle');
      }
    };
  }

  root.StashUI = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 2: Подключить в манифест**

```json
      "js": ["src/lib/extract.js", "src/lib/cache.js", "src/content/target.js", "src/content/ui.js", "src/content.js"],
```

- [ ] **Step 3: Проверить загрузку**

Обновить расширение, открыть Instagram, в консоли выполнить `typeof StashUI`.
Expected: `"object"`. Кнопки на экране пока не появляются: их показывает `content.js`, который ещё не переписан.

- [ ] **Step 4: Закоммитить**

```bash
git add src/content/ui.js manifest.json
git commit -m "feat: интерфейс с кнопкой карусели и рамкой на цели"
```

---

### Task 8: Сведение, манифест, документация, живой прогон фазы 1

**Files:**
- Modify: `src/content.js` (переписывается целиком)
- Modify: `manifest.json`, `package.json`, `README.md`

**Interfaces:**
- Consumes: всё из Tasks 1–7
- Produces: рабочее расширение версии `0.2.0`

- [ ] **Step 1: Переписать `src/content.js`**

```js
'use strict';

// Сведение: приём данных в кэш, реакция на нажатия, жизненный цикл.
// Вёрстка Instagram живёт в target.js, интерфейс в ui.js, разбор в lib/.

(function () {
  const extract = globalThis.StashExtract;
  const cacheModule = globalThis.StashCache;
  const targetModule = globalThis.StashTarget;
  const uiModule = globalThis.StashUI;
  if (!extract || !cacheModule || !targetModule || !uiModule) return;
  if (window.__stashContentReady) return;
  window.__stashContentReady = true;

  const MAX_INLINE_JSON = 3 * 1024 * 1024;
  const POLL_INTERVAL = 700;
  const SMALL_SIDE = 1080;

  const cache = cacheModule.create();
  const target = targetModule.create(cache);
  let busy = false;

  function debugEnabled() {
    try {
      return localStorage.getItem('stashDebug') === '1';
    } catch (error) {
      return false;
    }
  }

  function log(...args) {
    if (debugEnabled()) console.log('[stash]', ...args);
  }

  // --- приём данных --------------------------------------------------------

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'stash' || data.kind !== 'media') return;
    cache.ingest(data.items);
  });

  // Данные, вшитые в HTML при первой загрузке: спасают случай
  // «открыл пост по прямой ссылке».
  function scanInlineJson() {
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
      const text = script.textContent;
      if (!text || text.length > MAX_INLINE_JSON) continue;
      try {
        cache.ingest(extract.collectMedia(JSON.parse(text)));
      } catch (error) {
        /* не всякий инлайновый JSON нам подходит */
      }
    }
  }

  // --- сохранение ----------------------------------------------------------

  function describe(post, slide) {
    const source = extract.bestSource(slide.sources);
    if (!source) return null;
    return {
      url: source.url,
      filename: extract.buildFilename(post, slide),
      folder: extract.folderFor(slide.kind),
      key: extract.downloadKey(post, slide),
      width: source.width,
      height: source.height
    };
  }

  function smallNote(item) {
    const side = Math.max(Number(item.width) || 0, Number(item.height) || 0);
    if (!side || side >= SMALL_SIDE) return '';
    return ` (${side} px — открой пост для полного качества)`;
  }

  // Запасной путь: тянем файл внутри страницы и отдаём его в загрузку отсюда.
  // Подпапку в этом случае задать нельзя, файл ложится в корень Загрузок.
  async function fallbackDownload(url, filename) {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`CDN ответил ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
  }

  async function saveOne() {
    if (busy) return;
    const found = target.current();
    if (!found) {
      ui.setState('error');
      ui.say('Не понял, что сохранять. Открой сам пост.');
      return;
    }

    const item = found.post && found.slide ? describe(found.post, found.slide) : null;
    if (!item) {
      ui.setState('error');
      ui.say('Источник не найден. Обнови страницу и попробуй снова.');
      return;
    }

    busy = true;
    ui.setState('busy');
    log('сохраняю', item);

    try {
      const result = await chrome.runtime.sendMessage({ kind: 'download', ...item });
      if (result && result.ok) {
        const guess = found.guessed ? ' Слайд не опознан, сохранил первый.' : '';
        ui.setState('done');
        ui.say(`Сохранено: Загрузки/${item.folder}/${result.filename}${smallNote(item)}${guess}`);
      } else if (result && result.duplicate) {
        ui.setState('done');
        ui.say('Этот кадр уже сохранён');
      } else {
        log('основной путь не прошёл:', result && result.error);
        await fallbackDownload(item.url, item.filename);
        ui.setState('done');
        ui.say('Сохранено в корень Загрузок (запасной путь)');
      }
    } catch (error) {
      ui.setState('error');
      ui.say(`Не получилось: ${String((error && error.message) || error)}`);
    } finally {
      busy = false;
    }
  }

  async function saveAll() {
    if (busy) return;
    const found = target.current();
    if (!found || !found.post || found.post.slides.length < 2) return;

    const items = found.post.slides.map((slide) => describe(found.post, slide)).filter(Boolean);
    if (!items.length) {
      ui.setState('error');
      ui.say('Источник не найден. Обнови страницу и попробуй снова.');
      return;
    }

    busy = true;
    ui.setState('busy');
    log('сохраняю пакет', items.length);

    try {
      const report = await chrome.runtime.sendMessage({ kind: 'download-batch', items });
      const parts = [`Сохранено ${report.saved}`];
      if (report.skipped) parts.push(`пропущено ${report.skipped} (уже есть)`);
      if (report.failed) parts.push(`не удалось ${report.failed}: ${report.firstError}`);
      ui.setState(report.failed ? 'error' : 'done');
      ui.say(parts.join(', '));
    } catch (error) {
      ui.setState('error');
      ui.say(`Не получилось: ${String((error && error.message) || error)}`);
    } finally {
      busy = false;
    }
  }

  const ui = uiModule.create({ onSaveOne: saveOne, onSaveAll: saveAll });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;
    if (message.kind === 'download-current') {
      saveOne();
      return;
    }
    if (message.kind === 'download-failed') {
      log('загрузка прервана, пробую запасной путь:', message.error);
      fallbackDownload(message.url, message.filename)
        .then(() => {
          ui.setState('done');
          ui.say('Сохранено в корень Загрузок (запасной путь)');
        })
        .catch((error) => {
          ui.setState('error');
          ui.say(`Не получилось: ${String((error && error.message) || error)}`);
        });
    }
  });

  document.addEventListener('mouseover', (event) => target.setHovered(event.target), true);

  // --- жизненный цикл ------------------------------------------------------

  // Instagram меняет адрес прокруткой ленты, события об этом нет,
  // поэтому просто смотрим на состояние страницы раз в POLL_INTERVAL.
  let lastHref = '';
  setInterval(() => {
    const found = target.current();
    ui.setVisible(Boolean(found));
    ui.setAllCount(found && found.post ? found.post.slides.length : 0);
    if (location.href !== lastHref) {
      lastHref = location.href;
      ui.resetTransient();
    }
  }, POLL_INTERVAL);

  scanInlineJson();
  log('готов');
})();
```

- [ ] **Step 2: Поднять версию и описания**

`manifest.json`:

```json
  "version": "0.2.0",
  "description": "Сохраняет кадры и ролики Instagram в Загрузки одним нажатием.",
```

и

```json
    "default_title": "Сохранить этот кадр",
```

`package.json`:

```json
  "version": "0.2.0",
  "description": "Расширение Chrome: сохранение кадров и роликов Instagram одним нажатием",
```

- [ ] **Step 3: Прогнать тесты**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Живой прогон фазы 1**

Обновить расширение на `chrome://extensions`, перезагрузить вкладку Instagram. Проверить по списку:

1. Пост с одной картинкой: кнопка сохраняет файл в `Загрузки/Photos`, имя вида `автор — дата — код.jpg`.
2. Карусель из нескольких картинок: рядом появляется кнопка с числом. Клик по круглой сохраняет открытый слайд с верным номером в имени.
3. Та же карусель, кнопка с числом: файлов столько же, сколько слайдов, номера идут подряд.
4. Смешанная карусель: видео уехало в `Reels`, картинки в `Photos`.
5. Reels: работает как раньше, файл в `Reels`, повторное нажатие говорит «уже сохранён».
6. Повторное нажатие на уже сохранённом слайде: `Этот кадр уже сохранён`.

При расхождении включить `localStorage.stashDebug = '1'` и смотреть, что печатает консоль. Чинить `src/lib/extract.js`.

- [ ] **Step 5: Обновить README**

Переписать разделы «Как пользоваться», «Устройство», «Если что-то пошло не так» и «Границы».

Раздел «Как пользоваться» описывает: круглая кнопка сохраняет то, что на экране, кнопка с числом рядом — всю карусель; картинки идут в `Загрузки/Photos`, ролики в `Загрузки/Reels`.

Таблица «Устройство» дополняется строками:

| Файл | Роль |
|---|---|
| `src/lib/cache.js` | Кэш вкладки: посты и индекс слайдов по ключу файла. Покрыт тестами |
| `src/content/target.js` | Что сейчас на экране: элемент, пост, номер слайда |
| `src/content/ui.js` | Кнопки, тост, рамка на цели |

Раздел «Границы» приводится в соответствие со спекой: нет очереди, истории в интерфейсе, выбора качества руками, сохранения обложек отдельно от поста, скачивания альбомов целиком. Папка не настраивается. Запросов к Instagram расширение не делает.

- [ ] **Step 6: Закоммитить**

```bash
git add src/content.js manifest.json package.json README.md
git commit -m "feat: сохранение картинок и каруселей на открытом посте"
```

---

# Фаза 2. Лента и сетка профиля

### Task 9: Липкое наведение и рамка на цели

**Files:**
- Modify: `src/content/target.js`
- Modify: `src/content.js`

**Interfaces:**
- Consumes: `StashUI.highlight` из Task 7, `StashTarget.visibleBox` из Task 6
- Produces: `target.current()` учитывает наведение и возвращает то же, что раньше

- [ ] **Step 1: Учесть наведение в `current()`**

В `src/content/target.js` заменить возвращаемый объект в `create`:

```js
    return {
      setHovered(element) {
        if (isPostImage(element) || isPostVideo(element)) hovered = element;
      },
      current() {
        // Наведение липкое: курсор, идущий к кнопке, неизбежно уходит с
        // плитки. Цель держится, пока остаётся видимой, и только потом
        // уступает место самому крупному видимому элементу.
        if (hovered && !document.contains(hovered)) hovered = null;
        if (hovered && visibleBox(hovered).area <= 0) hovered = null;
        return resolve(hovered || largestVisible());
      }
    };
```

- [ ] **Step 2: Рисовать рамку**

В `src/content.js` в теле `setInterval` заменить блок обновления интерфейса:

```js
    const found = target.current();
    ui.setVisible(Boolean(found));
    ui.setAllCount(found && found.post ? found.post.slides.length : 0);
    ui.highlight(found ? found.element.getBoundingClientRect() : null);
```

- [ ] **Step 3: Прогнать тесты**

Run: `npm test`
Expected: PASS — чистое ядро не затронуто.

- [ ] **Step 4: Живой прогон фазы 2**

1. Главная лента: прокрутить до поста с картинкой, кнопка целится в него, рамка обводит именно его.
2. Лента, карусель: кнопка с числом появляется, сохраняет все слайды.
3. Сетка профиля: навести на плитку, рамка обводит её, сохранение берёт этот пост.
4. Сетка профиля, мелкое превью: в тосте появляется размер и совет открыть пост.
5. Увести курсор с плитки к кнопке: цель не сбрасывается.
6. Прокрутить так, чтобы цель ушла с экрана: цель переключается на видимую.

- [ ] **Step 5: Закоммитить**

```bash
git add src/content/target.js src/content.js
git commit -m "feat: липкая цель по наведению и рамка на сетке профиля"
```

---

# Фаза 3. Сторис

### Task 10: Живой прогон сторис

Разбор сторис отдельного кода не требует: элементы приходят тем же перехватчиком, имеют те же поля, а `pk` вместо кода уже поддержан в Tasks 1 и 3. Эта задача проверяет допущение и чинит расхождения, если они есть.

**Files:**
- Modify: `src/lib/extract.js` (только при расхождении)
- Modify: `tests/extract.test.js` (только при расхождении)
- Modify: `README.md`

**Interfaces:**
- Consumes: всё предыдущее
- Produces: подтверждённая или исправленная поддержка сторис

- [ ] **Step 1: Снять живые данные**

Открыть чьи-нибудь сторис с картинкой. В консоли страницы выполнить `localStorage.stashDebug = '1'` и перелистнуть кадр, чтобы пришёл свежий ответ. Посмотреть, что печатает перехватчик.

Ожидание: в списке появляются посты с `pk`, `slides` длины 1 и `kind: 'image'`.

- [ ] **Step 2: Проверить сохранение**

Нажать круглую кнопку на кадре сторис.

Ожидание: файл в `Загрузки/Photos` с именем вида `автор — дата — pk.jpg`.

- [ ] **Step 3: Починить при расхождении**

Если постов в отладочной печати нет, взять сырой ответ из вкладки Network, найти в нём объект кадра и посмотреть, какими полями он отдаёт картинку и автора. Добавить недостающие поля в `readImages` или `readUsername` в `src/lib/extract.js`, а сам объект — как проверочные данные в новый тест `tests/extract.test.js` по образцу теста `пост без кода опознаётся по pk`.

Если расхождений нет, шаг пропускается: писать код под несуществующую проблему не нужно.

- [ ] **Step 4: Отразить в документации**

В README в разделе «Как пользоваться» добавить строку о том, что сторис сохраняются так же, как посты, и ложатся в те же папки.

Дописать в спеку [../specs/2026-08-03-stash-images-design.md](../specs/2026-08-03-stash-images-design.md) раздел «Живая проверка» с датой и результатом: что подтвердилось, что пришлось править.

- [ ] **Step 5: Закоммитить**

```bash
git add README.md docs/superpowers/specs/2026-08-03-stash-images-design.md
git commit -m "docs: сторис проверены живьём"
```

Если правился код:

```bash
git add src/lib/extract.js tests/extract.test.js README.md docs/superpowers/specs/2026-08-03-stash-images-design.md
git commit -m "fix: разбор кадров сторис"
```

---

# Фаза 4. Звук отдельным файлом

Зависит только от Task 8: нужны цель на экране и интерфейс. От фаз 2 и 3 не зависит.

### Task 11: Адрес звуковой дорожки в данных

**Files:**
- Modify: `src/lib/extract.js`
- Modify: `tests/extract.test.js`

**Interfaces:**
- Consumes: `Post` из Task 1
- Produces:
  - `Post.audio: { url: string, title: string|null } | null`
  - `readAudio(node) → Post['audio']`

- [ ] **Step 1: Написать падающие тесты**

```js
test('читает адрес оригинального звука', () => {
  const payload = {
    items: [
      {
        code: 'AAA',
        user: { username: 'nike' },
        video_versions: [{ url: 'https://cdn/v.mp4', width: 1080, height: 1920 }],
        clips_metadata: {
          original_sound_info: {
            original_audio_title: 'Original audio',
            progressive_download_url: 'https://cdn/v/sound_n.m4a?x=1'
          }
        }
      }
    ]
  };
  const post = extract.collectMedia(payload)[0];
  assert.strictEqual(post.audio.url, 'https://cdn/v/sound_n.m4a?x=1');
  assert.strictEqual(post.audio.title, 'Original audio');
});

test('читает адрес лицензированной музыки', () => {
  const payload = {
    items: [
      {
        code: 'BBB',
        video_versions: [{ url: 'https://cdn/v.mp4', width: 1080, height: 1920 }],
        clips_metadata: {
          music_info: {
            music_asset_info: {
              title: 'Track',
              display_artist: 'Artist',
              progressive_download_url: 'https://cdn/v/track_n.m4a'
            }
          }
        }
      }
    ]
  };
  const post = extract.collectMedia(payload)[0];
  assert.strictEqual(post.audio.url, 'https://cdn/v/track_n.m4a');
  assert.strictEqual(post.audio.title, 'Artist — Track');
});

test('оригинальный звук предпочитается музыке', () => {
  const payload = {
    items: [
      {
        code: 'CCC',
        video_versions: [{ url: 'https://cdn/v.mp4', width: 1080, height: 1920 }],
        clips_metadata: {
          original_sound_info: { progressive_download_url: 'https://cdn/v/own_n.m4a' },
          music_info: { music_asset_info: { progressive_download_url: 'https://cdn/v/track_n.m4a' } }
        }
      }
    ]
  };
  assert.strictEqual(extract.collectMedia(payload)[0].audio.url, 'https://cdn/v/own_n.m4a');
});

test('без метаданных звука поле пустое', () => {
  const posts = extract.collectMedia(sampleResponse());
  assert.strictEqual(posts[0].audio, null);
});

test('слияние постов сохраняет найденный звук', () => {
  const withAudio = { code: 'AAA', pk: null, username: null, takenAt: null, audio: { url: 'https://cdn/a.m4a', title: null }, slides: [{ index: 1, kind: 'video', sources: [{ url: 'https://cdn/v.mp4', width: 1, height: 1 }] }] };
  const without = { code: 'AAA', pk: null, username: 'nike', takenAt: 1, audio: null, slides: [{ index: 1, kind: 'video', sources: [{ url: 'https://cdn/v.mp4', width: 1, height: 1 }] }] };
  assert.strictEqual(extract.mergePosts(without, withAudio).audio.url, 'https://cdn/a.m4a');
  assert.strictEqual(extract.mergePosts(withAudio, without).audio.url, 'https://cdn/a.m4a');
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — `post.audio` не определено.

- [ ] **Step 3: Реализовать**

В `src/lib/extract.js` рядом с `readImages`:

```js
  function audioTitle(info) {
    const artist = firstString(info, ['display_artist', 'artist_name']);
    const title = firstString(info, ['original_audio_title', 'title', 'song_name']);
    if (artist && title) return `${artist} — ${title}`;
    return title || artist || null;
  }

  /**
   * Прямой адрес звуковой дорожки, если Instagram его дал. Оригинальный звук
   * предпочтительнее музыки: у лицензированной по этому адресу часто отрывок.
   */
  function readAudio(node) {
    const clips = isObject(node.clips_metadata) ? node.clips_metadata : node;

    const own = isObject(clips.original_sound_info) ? clips.original_sound_info : null;
    if (own) {
      const url = firstString(own, ['progressive_download_url']);
      if (url) return { url, title: audioTitle(own) };
    }

    const music = isObject(clips.music_info) ? clips.music_info : null;
    const asset = music && isObject(music.music_asset_info) ? music.music_asset_info : null;
    if (asset) {
      const url = firstString(asset, ['progressive_download_url']);
      if (url) return { url, title: audioTitle(asset) };
    }

    return null;
  }
```

В `buildPost` добавить поле:

```js
      takenAt: readTakenAt(node),
      audio: readAudio(node),
      slides
```

В `mergePosts` добавить строку:

```js
      takenAt: previous.takenAt || candidate.takenAt,
      audio: previous.audio || candidate.audio,
```

Добавить `readAudio` в блок `return`.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Закоммитить**

```bash
git add src/lib/extract.js tests/extract.test.js
git commit -m "feat: адрес звуковой дорожки из данных поста"
```

---

### Task 12: Разбор mp4 и пересборка в m4a

**Files:**
- Create: `src/lib/mp4audio.js`
- Create: `tests/mp4audio.test.js`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: ничего
- Produces: `StashMp4Audio`
  - `readBoxes(bytes, start, end) → Array<{ type, start, end, contentStart }>`
  - `findBox(bytes, path, start, end) → { contentStart, end }|null` — путь вида `['moov','trak']`
  - `extractAudio(buffer) → Uint8Array` — готовый m4a
  - При невозможности бросает `Error` с русским текстом: `в файле нет moov`, `в ролике нет звуковой дорожки`, `фрагментированный mp4 не поддерживается`, `битый контейнер`

- [ ] **Step 1: Написать падающие тесты**

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const mp4 = require('../src/lib/mp4audio.js');

const enc = new TextEncoder();

// Минимальный конструктор боксов: помогает собрать проверочный mp4 руками.
function box(type, ...parts) {
  const payload = parts.flatMap((part) => Array.from(part));
  const size = 8 + payload.length;
  const head = [(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255];
  return Uint8Array.from([...head, ...enc.encode(type), ...payload]);
}

function u32(value) {
  return Uint8Array.from([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

function u16(value) {
  return Uint8Array.from([(value >>> 8) & 255, value & 255]);
}

function zeros(count) {
  return new Uint8Array(count);
}

// Два звуковых кадра по три байта, лежащих подряд в mdat.
const FRAME_A = Uint8Array.from([0xaa, 0xbb, 0xcc]);
const FRAME_B = Uint8Array.from([0xdd, 0xee, 0xff]);

function sampleMp4() {
  const stsd = box('stsd', u32(0), u32(1), box('mp4a', zeros(28)));
  const stts = box('stts', u32(0), u32(1), u32(2), u32(1024));
  const stsc = box('stsc', u32(0), u32(1), u32(1), u32(2), u32(1));
  const stsz = box('stsz', u32(0), u32(0), u32(2), u32(FRAME_A.length), u32(FRAME_B.length));
  const stbl = box('stbl', stsd, stts, stsc, stsz, box('stco', u32(0), u32(1), u32(0)));
  const minf = box('minf', box('smhd', zeros(8)), stbl);
  const hdlr = box('hdlr', u32(0), u32(0), enc.encode('soun'), zeros(12), zeros(1));
  const mdhd = box('mdhd', u32(0), u32(0), u32(0), u32(44100), u32(2048), u16(0x55c4), u16(0));
  const trak = box('trak', box('tkhd', zeros(84)), box('mdia', mdhd, hdlr, minf));
  const moov = box('moov', box('mvhd', zeros(100)), trak);

  const ftyp = box('ftyp', enc.encode('isom'), u32(512), enc.encode('isom'));
  const mdat = box('mdat', FRAME_A, FRAME_B);

  // Смещение кадров в готовом файле известно только сейчас: правим stco.
  const file = Uint8Array.from([...ftyp, ...moov, ...mdat]);
  const mdatContent = ftyp.length + moov.length + 8;
  const stcoValue = file.indexOf(0x73) ; // не используется, смещение чинится ниже
  void stcoValue;

  // stco лежит внутри stbl: находим бокс и переписываем единственное значение.
  const stcoBox = mp4.findBox(file, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stco']);
  file.set(u32(mdatContent), stcoBox.contentStart + 8);

  return file;
}

test('находит боксы верхнего уровня', () => {
  const file = sampleMp4();
  const types = mp4.readBoxes(file, 0, file.length).map((entry) => entry.type);
  assert.deepStrictEqual(types, ['ftyp', 'moov', 'mdat']);
});

test('находит вложенный бокс по пути', () => {
  const file = sampleMp4();
  assert.notStrictEqual(mp4.findBox(file, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsz']), null);
  assert.strictEqual(mp4.findBox(file, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'ctts']), null);
});

test('пересобранный m4a содержит те же кадры', () => {
  const file = sampleMp4();
  const result = mp4.extractAudio(file.buffer.slice(file.byteOffset, file.byteOffset + file.length));

  const types = mp4.readBoxes(result, 0, result.length).map((entry) => entry.type);
  assert.deepStrictEqual(types, ['ftyp', 'moov', 'mdat']);

  const mdat = mp4.readBoxes(result, 0, result.length).find((entry) => entry.type === 'mdat');
  const payload = result.slice(mdat.contentStart, mdat.end);
  assert.deepStrictEqual(Array.from(payload), [...FRAME_A, ...FRAME_B]);
});

test('в пересобранном m4a одна звуковая дорожка и рабочий stco', () => {
  const file = sampleMp4();
  const result = mp4.extractAudio(file.buffer.slice(file.byteOffset, file.byteOffset + file.length));

  const stco = mp4.findBox(result, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stco']);
  const view = new DataView(result.buffer, result.byteOffset, result.length);
  assert.strictEqual(view.getUint32(stco.contentStart + 4), 1);

  const offset = view.getUint32(stco.contentStart + 8);
  assert.deepStrictEqual(Array.from(result.slice(offset, offset + 3)), Array.from(FRAME_A));
});

test('ролик без звуковой дорожки даёт внятную ошибку', () => {
  const hdlr = box('hdlr', u32(0), u32(0), enc.encode('vide'), zeros(12), zeros(1));
  const trak = box('trak', box('mdia', hdlr));
  const file = Uint8Array.from([...box('ftyp', enc.encode('isom')), ...box('moov', trak), ...box('mdat', FRAME_A)]);
  assert.throws(() => mp4.extractAudio(file.buffer.slice(0, file.length)), /нет звуковой дорожки/);
});

test('файл без moov даёт внятную ошибку', () => {
  const file = Uint8Array.from([...box('ftyp', enc.encode('isom')), ...box('mdat', FRAME_A)]);
  assert.throws(() => mp4.extractAudio(file.buffer.slice(0, file.length)), /нет moov/);
});

test('фрагментированный контейнер отвергается', () => {
  const hdlr = box('hdlr', u32(0), u32(0), enc.encode('soun'), zeros(12), zeros(1));
  const trak = box('trak', box('mdia', hdlr));
  const file = Uint8Array.from([
    ...box('ftyp', enc.encode('isom')),
    ...box('moov', trak),
    ...box('moof', zeros(4)),
    ...box('mdat', FRAME_A)
  ]);
  assert.throws(() => mp4.extractAudio(file.buffer.slice(0, file.length)), /фрагментированный/);
});

test('мусор вместо файла отвергается', () => {
  assert.throws(() => mp4.extractAudio(new Uint8Array([1, 2, 3]).buffer), /битый контейнер/);
  assert.throws(() => mp4.extractAudio(new ArrayBuffer(0)), /битый контейнер/);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/lib/mp4audio.js'`

- [ ] **Step 3: Реализовать разбор и сборку**

Модуль пишется целиком по описанию ниже. Ключевые решения зафиксированы здесь, чтобы реализация не расходилась со спекой:

- обход боксов читает 32-битный размер, `size == 1` означает 64-битный `largesize`, `size == 0` означает «до конца файла»;
- звуковая дорожка ищется как `trak`, у которого `mdia/hdlr` на смещении 8 содержит `soun`;
- смещения кадров считаются из `stsc` + `stco`/`co64` + `stsz`: внутри чанка кадры лежат подряд;
- `stsz` с ненулевым `sample_size` означает одинаковый размер всех кадров, это поддерживается;
- на выходе `stsd`, `stts` и `stsz` копируются, `stsc` становится единственной записью `{1, всего кадров, 1}`, `stco` — единственным смещением начала `mdat`;
- смещение `mdat` известно только после сборки `moov`, поэтому `moov` собирается первым, а значение `stco` подставляется в готовые байты;
- `ftyp` пишется с major brand `M4A ` и совместимыми `M4A `, `mp42`, `isom`.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Подключить в манифест**

`src/lib/mp4audio.js` добавляется во второй блок `content_scripts` после `src/lib/cache.js`. В блок `world: MAIN` не добавляется: перехватчику разбор mp4 не нужен.

- [ ] **Step 6: Закоммитить**

```bash
git add src/lib/mp4audio.js tests/mp4audio.test.js manifest.json
git commit -m "feat: разбор mp4 и пересборка звуковой дорожки в m4a"
```

---

### Task 13: Кнопка звука

**Files:**
- Modify: `src/content/ui.js`, `src/content.js`, `src/lib/extract.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: `readAudio` из Task 11, `extractAudio` из Task 12, интерфейс из Task 7
- Produces: `ui.setAudioAvailable(boolean)`, обработчик `onSaveAudio`

- [ ] **Step 1: Папка для звука**

В `src/lib/extract.js` расширить `folderFor` и добавить тест в `tests/extract.test.js`:

```js
  function folderFor(kind) {
    if (kind === 'video') return 'Reels';
    if (kind === 'audio') return 'Audio';
    return 'Photos';
  }
```

```js
test('звук уходит в свою папку', () => {
  assert.strictEqual(extract.folderFor('audio'), 'Audio');
});
```

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Третья кнопка в интерфейсе**

В `src/content/ui.js` в разметку `.row` перед `.btn-all` добавить кнопку:

```html
          <button class="btn btn-audio" type="button" hidden title="Сохранить только звук">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18V5l10-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="16" cy="16" r="3" />
            </svg>
          </button>
```

В `create` завести ссылку, подписку и метод:

```js
    const audio = shadow.querySelector('.btn-audio');
    audio.addEventListener('click', () => handlers.onSaveAudio());
```

```js
      setAudioAvailable(available) {
        audio.hidden = !available;
      },
```

- [ ] **Step 3: Сохранение звука в `src/content.js`**

Добавить функцию и передать обработчик в `uiModule.create`:

```js
  function audioName(post, slide, url) {
    const extension = extract.extensionFromUrl(url, 'audio');
    return extract.buildFilename(post, slide).replace(/\.[^.]+$/, '') + '.' + extension;
  }

  function toDataUrl(bytes, type) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return `data:${type};base64,${btoa(binary)}`;
  }

  async function saveAudio() {
    if (busy) return;
    const found = target.current();
    if (!found || !found.post || !found.slide || found.slide.kind !== 'video') return;

    busy = true;
    ui.setState('busy');

    try {
      const key = `${extract.downloadKey(found.post, found.slide)}#audio`;
      const direct = found.post.audio && found.post.audio.url;

      let item;
      if (direct) {
        item = { url: direct, filename: audioName(found.post, found.slide, direct), folder: 'Audio', key };
      } else {
        const source = extract.bestSource(found.slide.sources);
        if (!source) throw new Error('Источник не найден');
        const response = await fetch(source.url, { credentials: 'omit' });
        if (!response.ok) throw new Error(`CDN ответил ${response.status}`);
        const bytes = globalThis.StashMp4Audio.extractAudio(await response.arrayBuffer());
        item = {
          url: toDataUrl(bytes, 'audio/mp4'),
          filename: audioName(found.post, found.slide, 'x.m4a'),
          folder: 'Audio',
          key
        };
      }

      const result = await chrome.runtime.sendMessage({ kind: 'download', ...item });
      if (result && result.ok) {
        ui.setState('done');
        ui.say(`Сохранено: Загрузки/Audio/${result.filename}`);
      } else if (result && result.duplicate) {
        ui.setState('done');
        ui.say('Этот звук уже сохранён');
      } else {
        throw new Error((result && result.error) || 'загрузка не началась');
      }
    } catch (error) {
      ui.setState('error');
      ui.say(`Звук не сохранён: ${String((error && error.message) || error)}`);
    } finally {
      busy = false;
    }
  }
```

Передать в создание интерфейса:

```js
  const ui = uiModule.create({ onSaveOne: saveOne, onSaveAll: saveAll, onSaveAudio: saveAudio });
```

В теле `setInterval` добавить строку:

```js
    ui.setAudioAvailable(Boolean(found && found.slide && found.slide.kind === 'video'));
```

- [ ] **Step 4: Живой прогон звука**

1. Reels с оригинальным звуком: кнопка ноты сохраняет файл в `Загрузки/Audio`.
2. Reels с лицензированной музыкой: файл сохраняется, длительность может быть меньше ролика.
3. Ролик, у которого прямого адреса нет: звук всё равно достаётся, файл открывается в проигрывателе.
4. Пост с картинкой: кнопки ноты нет.
5. Повторное нажатие: `Этот звук уже сохранён`.

- [ ] **Step 5: Дописать README и закоммитить**

В README в «Как пользоваться» добавить кнопку звука и папку `Загрузки/Audio`, в «Устройство» — строку про `src/lib/mp4audio.js`.

```bash
git add src/lib/extract.js src/content/ui.js src/content.js tests/extract.test.js README.md
git commit -m "feat: кнопка сохранения звука отдельным файлом"
```
