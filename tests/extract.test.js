'use strict';

const test = require('node:test');
const assert = require('node:assert');
const extract = require('../src/lib/extract.js');

// Форма, приближённая к тому, что Instagram отдаёт для одного ролика.
function sampleResponse() {
  return {
    data: {
      xdt_api__v1__media__shortcode__web_info: {
        items: [
          {
            code: 'DKx9dQ2',
            pk: '3412345678901234567',
            taken_at: 1785542400,
            user: { username: 'nike', full_name: 'Nike' },
            video_versions: [
              { type: 101, width: 720, height: 1280, url: 'https://cdn.example/720.mp4' },
              { type: 102, width: 1080, height: 1920, url: 'https://cdn.example/1080.mp4' },
              { type: 103, width: 480, height: 854, url: 'https://cdn.example/480.mp4' }
            ]
          }
        ]
      }
    }
  };
}

// Карусель из трёх слайдов, последний — видео. У родителя своя обложка,
// которая в слайды попадать не должна.
function sampleCarousel() {
  return {
    data: {
      xdt_api__v1__media__shortcode__web_info: {
        items: [
          {
            code: 'DKx9dQ2',
            pk: 3412345678,
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
  assert.strictEqual(posts[0].username, 'nike');
  assert.strictEqual(posts[0].takenAt, 1785542400);
  assert.strictEqual(posts[0].slides.length, 1);
  assert.strictEqual(posts[0].slides[0].kind, 'video');
  assert.strictEqual(posts[0].slides[0].sources.length, 3);
});

test('понимает старую схему с одиночным video_url', () => {
  const payload = {
    graphql: {
      shortcode_media: {
        shortcode: 'CZabc12',
        video_url: 'https://cdn.example/legacy.mp4',
        dimensions: { width: 640, height: 1136 },
        taken_at_timestamp: 1700000000,
        owner: { username: 'adidas' }
      }
    }
  };
  const posts = extract.collectMedia(payload);
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].code, 'CZabc12');
  assert.strictEqual(posts[0].username, 'adidas');
  assert.strictEqual(posts[0].slides[0].kind, 'video');
  assert.strictEqual(posts[0].slides[0].sources[0].url, 'https://cdn.example/legacy.mp4');
  assert.strictEqual(posts[0].slides[0].sources[0].width, 640);
});

test('собирает несколько постов из ленты', () => {
  const payload = {
    items: [
      { code: 'AAA', user: { username: 'one' }, video_versions: [{ url: 'https://cdn/1.mp4', width: 720, height: 1280 }] },
      { code: 'BBB', user: { username: 'two' }, image_versions2: { candidates: [{ url: 'https://cdn/2_n.jpg', width: 1080, height: 1080 }] } }
    ]
  };
  const posts = extract.collectMedia(payload);
  assert.deepStrictEqual(posts.map((post) => post.code).sort(), ['AAA', 'BBB']);
  assert.deepStrictEqual(posts.map((post) => post.slides[0].kind).sort(), ['image', 'video']);
});

test('числовой pk превращается в строку', () => {
  const posts = extract.collectMedia(sampleCarousel());
  assert.strictEqual(posts[0].pk, '3412345678');
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

test('не находит ничего в ответе без медиа', () => {
  const payload = { data: { user: { username: 'nike' }, items: [{ code: 'abc', image_versions: [] }] } };
  assert.deepStrictEqual(extract.collectMedia(payload), []);
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

test('выбирает вариант с наибольшим разрешением', () => {
  const posts = extract.collectMedia(sampleResponse());
  const best = extract.bestVideo(posts[0].slides[0].sources);
  assert.strictEqual(best.url, 'https://cdn.example/1080.mp4');
});

test('bestVideo возвращает null на пустом наборе', () => {
  assert.strictEqual(extract.bestVideo([]), null);
  assert.strictEqual(extract.bestVideo(null), null);
});

test('имя файла складывается из автора, даты и кода', () => {
  const name = extract.buildFilename({ username: 'nike', takenAt: 1785542400, code: 'DKx9dQ2' });
  assert.strictEqual(name, 'nike — 2026-08-01 — DKx9dQ2.mp4');
});

test('имя файла опускает то, чего не знает', () => {
  assert.strictEqual(extract.buildFilename({ code: 'DKx9dQ2' }), 'instagram — DKx9dQ2.mp4');
  assert.strictEqual(extract.buildFilename({ username: 'nike' }), 'nike.mp4');
});

test('дата в имени не зависит от часового пояса', () => {
  assert.strictEqual(extract.formatDate(1785542400), '2026-08-01');
  assert.strictEqual(extract.formatDate(0), '1970-01-01');
});

test('из имени вычищаются символы, которые не примет Chrome', () => {
  assert.strictEqual(extract.sanitizeSegment('a/b:c*d?e"f<g>h|i'), 'a-b-c-d-e-f-g-h-i');
  assert.strictEqual(extract.sanitizeSegment('  студия дизайна  '), 'студия дизайна');
  assert.strictEqual(extract.sanitizeSegment('точка в конце...'), 'точка в конце');
});

test('длинное имя обрезается', () => {
  const long = 'я'.repeat(200);
  assert.strictEqual(extract.sanitizeSegment(long).length, 60);
});

test('код ролика читается из всех форм адреса', () => {
  assert.strictEqual(extract.codeFromPath('/reel/DKx9dQ2/'), 'DKx9dQ2');
  assert.strictEqual(extract.codeFromPath('/reels/DKx9dQ2/'), 'DKx9dQ2');
  assert.strictEqual(extract.codeFromPath('/p/DKx9dQ2/'), 'DKx9dQ2');
  assert.strictEqual(extract.codeFromPath('/tv/DKx9dQ2/'), 'DKx9dQ2');
  assert.strictEqual(extract.codeFromPath('/nike/reel/DKx9dQ2/'), 'DKx9dQ2');
});

test('на страницах без ролика кода нет', () => {
  assert.strictEqual(extract.codeFromPath('/'), null);
  assert.strictEqual(extract.codeFromPath('/nike/'), null);
  assert.strictEqual(extract.codeFromPath('/explore/tags/design/'), null);
  assert.strictEqual(extract.codeFromPath(null), null);
});

test('blob-ссылку из плеера скачивать нельзя', () => {
  assert.strictEqual(extract.isDirectVideoUrl('https://cdn.example/1080.mp4'), true);
  assert.strictEqual(extract.isDirectVideoUrl('blob:https://www.instagram.com/abc'), false);
  assert.strictEqual(extract.isDirectVideoUrl(''), false);
});
