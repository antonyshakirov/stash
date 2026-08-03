'use strict';

const test = require('node:test');
const assert = require('node:assert');
const extract = require('../src/lib/extract.js');
const tiktok = require('../src/lib/sites/tiktok.js');

// Форма, приближённая к тому, что TikTok кладёт в ItemModule.
function sampleVideo() {
  return {
    ItemModule: {
      '7311111111111111111': {
        id: '7311111111111111111',
        desc: 'подпись',
        createTime: '1700000000',
        author: { uniqueId: 'nelyrall', nickname: 'Nely' },
        video: {
          id: '7311111111111111111',
          width: 1080,
          height: 1920,
          duration: 15,
          cover: 'https://p16.tiktokcdn.com/cover.jpeg',
          playAddr: 'https://v16.tiktokcdn.com/video/plain.mp4?a=1',
          downloadAddr: 'https://v16.tiktokcdn.com/video/watermark.mp4?a=1',
          bitrateInfo: [
            {
              Bitrate: 2000000,
              PlayAddr: { UrlList: ['https://v16.tiktokcdn.com/video/hi.mp4'], Width: 1080, Height: 1920 }
            },
            {
              Bitrate: 900000,
              PlayAddr: { UrlList: ['https://v16.tiktokcdn.com/video/lo.mp4'], Width: 540, Height: 960 }
            }
          ]
        },
        music: {
          id: '1',
          title: 'Track',
          authorName: 'Artist',
          playUrl: 'https://sf16.tiktokcdn.com/music/track.mp3'
        }
      }
    }
  };
}

function samplePhotos() {
  return {
    ItemModule: {
      '7322222222222222222': {
        id: '7322222222222222222',
        createTime: 1700000000,
        author: { uniqueId: 'studio' },
        imagePost: {
          title: 'подборка',
          images: [
            {
              imageURL: {
                urlList: [
                  'https://p16.tiktokcdn.com/one~tplv.jpeg',
                  'https://p19.tiktokcdn.com/one~tplv.jpeg'
                ]
              },
              imageWidth: 1080,
              imageHeight: 1440
            },
            {
              imageURL: { urlList: ['https://p16.tiktokcdn.com/two~tplv.jpeg'] },
              imageWidth: 1080,
              imageHeight: 1440
            }
          ]
        },
        music: { playUrl: 'https://sf16.tiktokcdn.com/music/x.mp3', title: 'Sound' }
      }
    }
  };
}

test('ролик собирается одним постом с видео-слайдом', () => {
  const posts = extract.collectMedia(sampleVideo(), tiktok);
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].code, '7311111111111111111');
  assert.strictEqual(posts[0].username, 'nelyrall');
  assert.strictEqual(posts[0].takenAt, 1700000000);
  assert.strictEqual(posts[0].slides.length, 1);
  assert.strictEqual(posts[0].slides[0].kind, 'video');
});

test('берётся самый крупный вариант из bitrateInfo', () => {
  const posts = extract.collectMedia(sampleVideo(), tiktok);
  const best = extract.bestSource(posts[0].slides[0].sources);
  assert.strictEqual(best.url, 'https://v16.tiktokcdn.com/video/hi.mp4');
});

test('вариант с водяным знаком не попадает в источники', () => {
  const posts = extract.collectMedia(sampleVideo(), tiktok);
  const urls = posts[0].slides[0].sources.map((source) => source.url);
  assert.ok(!urls.some((url) => url.includes('watermark')));
  assert.ok(urls.includes('https://v16.tiktokcdn.com/video/plain.mp4?a=1'));
});

test('обложка ролика отдельным постом не всплывает', () => {
  const posts = extract.collectMedia(sampleVideo(), tiktok);
  assert.strictEqual(posts.length, 1);
});

test('звук читается готовой ссылкой', () => {
  const posts = extract.collectMedia(sampleVideo(), tiktok);
  assert.strictEqual(posts[0].audio.url, 'https://sf16.tiktokcdn.com/music/track.mp3');
  assert.strictEqual(posts[0].audio.title, 'Artist — Track');
});

test('слайдшоу разворачивается в кадры по порядку', () => {
  const posts = extract.collectMedia(samplePhotos(), tiktok);
  assert.strictEqual(posts.length, 1);
  assert.deepStrictEqual(posts[0].slides.map((slide) => slide.index), [1, 2]);
  assert.deepStrictEqual(posts[0].slides.map((slide) => slide.kind), ['image', 'image']);
  assert.strictEqual(posts[0].slides[1].sources[0].url, 'https://p16.tiktokcdn.com/two~tplv.jpeg');
});

test('кадры слайдшоу не всплывают отдельными постами', () => {
  const posts = extract.collectMedia(samplePhotos(), tiktok);
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].username, 'studio');
});

test('зеркала одного кадра не считаются разными размерами', () => {
  const posts = extract.collectMedia(samplePhotos(), tiktok);
  const first = posts[0].slides[0].sources;
  assert.strictEqual(first.length, 2);
  assert.strictEqual(first[0].width, 1080);
  assert.strictEqual(first[1].width, 1080);
});

test('имя файла складывается по общим правилам', () => {
  const post = extract.collectMedia(samplePhotos(), tiktok)[0];
  assert.strictEqual(
    extract.buildFilename(post, post.slides[1]),
    'studio — 2023-11-14 — 7322222222222222222 — 2.jpeg'
  );
});

test('код читается из адреса ролика и слайдшоу', () => {
  assert.strictEqual(tiktok.codeFromPath('/@nelyrall/video/7311111111111111111'), '7311111111111111111');
  assert.strictEqual(tiktok.codeFromPath('/@studio/photo/7322222222222222222/'), '7322222222222222222');
});

test('на страницах без записи кода нет', () => {
  assert.strictEqual(tiktok.codeFromPath('/'), null);
  assert.strictEqual(tiktok.codeFromPath('/@nelyrall'), null);
  assert.strictEqual(tiktok.codeFromPath('/foryou'), null);
  assert.strictEqual(tiktok.codeFromPath(null), null);
});

test('словарь выбирается по имени хоста', () => {
  require('../src/lib/sites/instagram.js');
  const sites = require('../src/lib/sites/registry.js');
  assert.strictEqual(sites.pick('www.tiktok.com').id, 'tiktok');
  assert.strictEqual(sites.pick('www.instagram.com').id, 'instagram');
  assert.strictEqual(sites.pick('example.com'), null);
  assert.strictEqual(sites.pick(''), null);
});

test('мусор вместо ответа не роняет разбор', () => {
  assert.deepStrictEqual(extract.collectMedia(null, tiktok), []);
  assert.deepStrictEqual(extract.collectMedia({ video: 'не объект' }, tiktok), []);
  assert.deepStrictEqual(extract.collectMedia({ imagePost: { images: 'не массив' } }, tiktok), []);
  assert.deepStrictEqual(extract.collectMedia({ music: { playUrl: 'https://x' } }, tiktok), []);
});
