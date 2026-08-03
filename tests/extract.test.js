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

test('находит ролик в глубоко вложенном ответе', () => {
  const items = extract.collectMedia(sampleResponse());
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].code, 'DKx9dQ2');
  assert.strictEqual(items[0].username, 'nike');
  assert.strictEqual(items[0].takenAt, 1785542400);
  assert.strictEqual(items[0].videos.length, 3);
});

test('не находит ничего в ответе без видео', () => {
  const payload = { data: { user: { username: 'nike' }, items: [{ code: 'abc', image_versions: [] }] } };
  assert.deepStrictEqual(extract.collectMedia(payload), []);
});

test('переживает циклическую структуру', () => {
  const payload = sampleResponse();
  payload.self = payload;
  payload.data.parent = payload;
  const items = extract.collectMedia(payload);
  assert.strictEqual(items.length, 1);
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
  const items = extract.collectMedia(payload);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].code, 'CZabc12');
  assert.strictEqual(items[0].username, 'adidas');
  assert.strictEqual(items[0].videos[0].url, 'https://cdn.example/legacy.mp4');
  assert.strictEqual(items[0].videos[0].width, 640);
});

test('собирает несколько роликов из ленты', () => {
  const payload = {
    items: [
      { code: 'AAA', user: { username: 'one' }, video_versions: [{ url: 'https://cdn/1.mp4', width: 720, height: 1280 }] },
      { code: 'BBB', user: { username: 'two' }, video_versions: [{ url: 'https://cdn/2.mp4', width: 720, height: 1280 }] }
    ]
  };
  const codes = extract.collectMedia(payload).map((item) => item.code).sort();
  assert.deepStrictEqual(codes, ['AAA', 'BBB']);
});

test('не спотыкается о мусор вместо ответа', () => {
  assert.deepStrictEqual(extract.collectMedia(null), []);
  assert.deepStrictEqual(extract.collectMedia('строка'), []);
  assert.deepStrictEqual(extract.collectMedia(42), []);
  assert.deepStrictEqual(extract.collectMedia({ video_versions: 'не массив' }), []);
});

test('выбирает вариант с наибольшим разрешением', () => {
  const items = extract.collectMedia(sampleResponse());
  const best = extract.bestVideo(items[0].videos);
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
