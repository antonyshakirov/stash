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
  const slides = [{ index: 1, kind: 'video', sources: [{ url: 'https://cdn/v.mp4', width: 1, height: 1 }] }];
  const withAudio = { code: 'AAA', pk: null, username: null, takenAt: null, audio: { url: 'https://cdn/a.m4a', title: null }, slides };
  const without = { code: 'AAA', pk: null, username: 'nike', takenAt: 1, audio: null, slides };
  assert.strictEqual(extract.mergePosts(without, withAudio).audio.url, 'https://cdn/a.m4a');
  assert.strictEqual(extract.mergePosts(withAudio, without).audio.url, 'https://cdn/a.m4a');
});

test('звук уходит в свою папку', () => {
  assert.strictEqual(extract.folderFor('audio'), 'Audio');
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

// Готовый пост нужной длины: экономит повторение в тестах имён и ключей.
function samplePost(slideCount) {
  const slides = [];
  for (let i = 1; i <= slideCount; i += 1) {
    slides.push({
      index: i,
      kind: 'image',
      sources: [{ url: `https://cdn/v/${i}_n.jpg?stp=p1080x1080`, width: 1080, height: 1080 }]
    });
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
