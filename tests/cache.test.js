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
  return { code, pk: null, username: 'nike', takenAt: 1785542400, audio: null, slides };
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

// Договор между перехватчиком и контент-скриптом. Перехватчик работает в мире
// страницы и отдаёт данные строкой, потому что живой объект через границу
// миров в Firefox виден сквозь защитную обёртку. Значит всё, что собирает
// collectMedia, обязано пережить JSON без потерь — иначе кэш молча пустеет и
// кнопки не появляются вовсе, как это и случилось в 0.9.2.
test('данные переживают дорогу через JSON без потерь', () => {
  const instagram = require('../src/lib/sites/instagram.js');
  const payload = {
    items: [
      {
        code: 'DKx9dQ2',
        pk: '3412345678901234567',
        taken_at: 1785542400,
        user: { username: 'nike' },
        video_versions: [{ type: 101, width: 720, height: 1280, url: 'https://cdn/a.mp4' }]
      }
    ]
  };

  const collected = extract.collectMedia(payload, instagram);
  assert.ok(collected.length, 'разбор ответа обязан что-то найти');

  const throughWire = JSON.parse(JSON.stringify(collected));
  assert.deepStrictEqual(throughWire, collected, 'JSON не должен ничего терять');

  const cache = cacheModule.create();
  cache.ingest(throughWire);
  assert.strictEqual(cache.count(), 1);

  const stored = cache.get('DKx9dQ2');
  assert.ok(stored, 'пост обязан находиться по коду');
  assert.strictEqual(stored.username, 'nike');
  assert.strictEqual(stored.slides.length, 1);
  assert.strictEqual(stored.slides[0].kind, 'video');
  assert.ok(extract.bestSource(stored.slides[0].sources), 'источник обязан выбираться');
});
