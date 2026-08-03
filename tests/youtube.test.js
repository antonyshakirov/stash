'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Словарь читает location при разборе адресов, поэтому подменяем его до
// загрузки модуля: в Node его нет.
global.location = { href: 'https://www.youtube.com/watch?v=abc123DEF45' };

const youtube = require('../src/lib/sites/youtube.js');

function samplePlayer() {
  return {
    videoDetails: {
      videoId: 'abc123DEF45',
      author: 'Some Channel',
      title: 'Ролик'
    },
    microformat: { playerMicroformatRenderer: { publishDate: '2023-03-28' } },
    streamingData: {
      formats: [
        {
          itag: 18,
          mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
          width: 640,
          height: 360,
          contentLength: '5000000',
          url: 'https://rr1.googlevideo.com/videoplayback?itag=18'
        }
      ],
      adaptiveFormats: [
        {
          itag: 137,
          mimeType: 'video/mp4; codecs="avc1.640028"',
          width: 1920,
          height: 1080,
          contentLength: '40000000',
          signatureCipher: 's=XX&sp=sig&url=https%3A%2F%2Frr1.googlevideo.com%2Fvideoplayback'
        },
        {
          itag: 140,
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          bitrate: 128000,
          contentLength: '2000000',
          signatureCipher: 's=YY'
        },
        { itag: 251, mimeType: 'audio/webm; codecs="opus"', bitrate: 140000 }
      ]
    }
  };
}

function stream(itag, mime, clen) {
  return youtube.streamFromUrl(
    `https://rr1.googlevideo.com/videoplayback?expire=1&itag=${itag}` +
    `&mime=${encodeURIComponent(mime)}&clen=${clen}&range=0-999&rn=3&rbuf=0`
  );
}

test('форматы разбираются из ответа плеера', () => {
  const formats = youtube.collectFormats(samplePlayer());
  assert.strictEqual(formats.length, 4);
  assert.strictEqual(formats.filter((format) => format.progressive).length, 1);
});

test('форматы с закрытым подписью адресом не считаются готовыми', () => {
  const formats = youtube.collectFormats(samplePlayer());
  const ciphered = formats.filter((format) => !format.url).map((format) => format.itag);
  assert.deepStrictEqual(ciphered.sort(), ['137', '140', '251']);
});

test('автор, код и дата читаются из ответа плеера', () => {
  const identity = youtube.readPlayerIdentity(samplePlayer());
  assert.strictEqual(identity.code, 'abc123DEF45');
  assert.strictEqual(identity.username, 'Some Channel');
  assert.strictEqual(new Date(identity.takenAt * 1000).toISOString().slice(0, 10), '2023-03-28');
});

test('из адреса потока отбрасываются параметры куска', () => {
  const entry = stream(137, 'video/mp4', 40000000);
  assert.strictEqual(entry.itag, '137');
  assert.strictEqual(entry.kind, 'video');
  assert.strictEqual(entry.size, 40000000);
  assert.ok(!/[?&](range|rn|rbuf)=/.test(entry.url));
  assert.ok(entry.url.includes('itag=137'));
});

test('не относящийся к потокам адрес игнорируется', () => {
  assert.strictEqual(youtube.streamFromUrl('https://www.youtube.com/watch?v=abc'), null);
  assert.strictEqual(youtube.streamFromUrl('https://rr1.googlevideo.com/videoplayback?mime=video'), null);
  assert.strictEqual(youtube.streamFromUrl(null), null);
});

test('метаданные и перехваченные адреса сводятся по itag', () => {
  const formats = youtube.collectFormats(samplePlayer());
  const streams = new Map();
  for (const entry of [stream(137, 'video/mp4', 40000000), stream(140, 'audio/mp4', 2000000)]) {
    streams.set(entry.itag, entry);
  }

  const picked = youtube.choose({ formats, streams });
  assert.strictEqual(picked.video.itag, '137');
  assert.strictEqual(picked.video.height, 1080);
  assert.strictEqual(picked.audio.itag, '140');
  assert.strictEqual(picked.progressive.itag, '18');
});

test('звук в mp4 предпочитается opus в webm', () => {
  const formats = youtube.collectFormats(samplePlayer());
  const streams = new Map();
  for (const entry of [stream(251, 'audio/webm', 3000000), stream(140, 'audio/mp4', 2000000)]) {
    streams.set(entry.itag, entry);
  }

  assert.strictEqual(youtube.choose({ formats, streams }).audio.itag, '140');
});

test('без перехваченных потоков берутся только открытые адреса', () => {
  const formats = youtube.collectFormats(samplePlayer());
  const picked = youtube.choose({ formats, streams: new Map() });
  assert.strictEqual(picked.progressive.itag, '18');
  assert.strictEqual(picked.video, null);
  assert.strictEqual(picked.audio, null);
});

test('код читается и у обычного ролика, и у Shorts', () => {
  assert.strictEqual(youtube.codeFromUrl('https://www.youtube.com/watch?v=abc123DEF45'), 'abc123DEF45');
  assert.strictEqual(youtube.codeFromUrl('https://www.youtube.com/shorts/XYZ987'), 'XYZ987');
  assert.strictEqual(youtube.codeFromUrl('https://www.youtube.com/'), null);
  assert.strictEqual(youtube.codeFromUrl('битая ссылка'), null);
});

test('инлайновый ответ плеера вытаскивается из обычного скрипта', () => {
  const doc = {
    querySelectorAll: () => [
      { textContent: 'var meta = {};' },
      { textContent: 'var ytInitialPlayerResponse = {"videoDetails":{"videoId":"zzz"},"a":"}"};\nvar x = 1;' }
    ]
  };
  const payloads = youtube.scanInline(doc);
  assert.strictEqual(payloads.length, 1);
  assert.strictEqual(payloads[0].videoDetails.videoId, 'zzz');
});

test('мусор вместо ответа плеера не роняет разбор', () => {
  assert.deepStrictEqual(youtube.collectFormats(null), []);
  assert.deepStrictEqual(youtube.collectFormats({ streamingData: 'строка' }), []);
  assert.strictEqual(youtube.readPlayerIdentity({}), null);
});
