'use strict';

const test = require('node:test');
const assert = require('node:assert');
const boxes = require('../src/lib/mp4audio.js');
const mux = require('../src/lib/mp4mux.js');

const enc = new TextEncoder();

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

function hdlr(handler) {
  return box('hdlr', u32(0), u32(0), enc.encode(handler), zeros(12), zeros(1));
}

function mdhd(timescale, duration) {
  return box('mdhd', u32(0), u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0));
}

/** tkhd версии 0: ширина и высота лежат в конце, в формате 16.16. */
function tkhd(trackId, width, height) {
  return box(
    'tkhd',
    u32(7), u32(0), u32(0), u32(trackId), u32(0), u32(0),
    zeros(8), u16(0), u16(0), u16(0), u16(0),
    zeros(36),
    u32(width * 65536), u32(height * 65536)
  );
}

const AUDIO_A = Uint8Array.from([0x11, 0x22, 0x33]);
const AUDIO_B = Uint8Array.from([0x44, 0x55, 0x66]);
const VIDEO_A = Uint8Array.from([0xa1, 0xa2, 0xa3, 0xa4]);
const VIDEO_B = Uint8Array.from([0xb1, 0xb2]);

/** Обычный, нефрагментированный поток со звуком. */
function plainAudio() {
  const stsd = box('stsd', u32(0), u32(1), box('mp4a', zeros(28)));
  const stts = box('stts', u32(0), u32(1), u32(2), u32(1024));
  const stsc = box('stsc', u32(0), u32(1), u32(1), u32(2), u32(1));
  const stsz = box('stsz', u32(0), u32(0), u32(2), u32(AUDIO_A.length), u32(AUDIO_B.length));
  const stco = box('stco', u32(0), u32(1), u32(0));
  const stbl = box('stbl', stsd, stts, stsc, stsz, stco);
  const minf = box('minf', box('smhd', zeros(8)), stbl);
  const trak = box('trak', tkhd(1, 0, 0), box('mdia', mdhd(44100, 2048), hdlr('soun'), minf));
  const moov = box('moov', box('mvhd', zeros(100)), trak);
  const ftyp = box('ftyp', enc.encode('isom'));
  const mdat = box('mdat', AUDIO_A, AUDIO_B);

  const file = Uint8Array.from([...ftyp, ...moov, ...mdat]);
  const stcoAt = findType(file, 'stco');
  file.set(u32(ftyp.length + moov.length + 8), stcoAt + 12);
  return file;
}

/** Фрагментированный поток с видео: кадры описаны в moof, а не в stbl. */
function fragmentedVideo() {
  const stsd = box('stsd', u32(0), u32(1), box('avc1', zeros(28)));
  const stbl = box(
    'stbl',
    stsd,
    box('stts', u32(0), u32(0)),
    box('stsc', u32(0), u32(0)),
    box('stsz', u32(0), u32(0), u32(0)),
    box('stco', u32(0), u32(0))
  );
  const minf = box('minf', box('vmhd', zeros(12)), stbl);
  const trak = box('trak', tkhd(1, 1280, 720), box('mdia', mdhd(30000, 0), hdlr('vide'), minf));
  const mvex = box('mvex', box('trex', u32(0), u32(1), u32(1), u32(1000), u32(0), u32(0)));
  const moov = box('moov', box('mvhd', zeros(100)), trak, mvex);
  const ftyp = box('ftyp', enc.encode('isom'));

  // trun: флаги 0x000305 — есть data_offset, длительность, размер и cto.
  const trun = box(
    'trun',
    u32(0x00000b01), u32(2), u32(0),
    u32(1000), u32(VIDEO_A.length), u32(0),
    u32(1000), u32(VIDEO_B.length), u32(0)
  );
  const traf = box('traf', box('tfhd', u32(0), u32(1)), trun);
  const moof = box('moof', box('mfhd', u32(0), u32(1)), traf);
  const mdat = box('mdat', VIDEO_A, VIDEO_B);

  const file = Uint8Array.from([...ftyp, ...moov, ...moof, ...mdat]);

  // data_offset в trun отсчитывается от начала moof.
  const moofAt = ftyp.length + moov.length;
  const trunAt = findType(file, 'trun');
  const dataStart = moofAt + moof.length + 8;
  file.set(u32(dataStart - moofAt), trunAt + 12);
  return file;
}

function findType(bytes, type) {
  const needle = enc.encode(type);
  outer: for (let i = 0; i + 4 <= bytes.length; i += 1) {
    for (let j = 0; j < 4; j += 1) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

test('читает дорожку из обычного потока', () => {
  const track = mux.readTrack(plainAudio(), 'soun');
  assert.strictEqual(track.timescale, 44100);
  assert.strictEqual(track.samples.length, 2);
  assert.strictEqual(track.samples[0].size, 3);
  assert.strictEqual(track.samples[0].duration, 1024);
});

test('читает дорожку из фрагментированного потока', () => {
  const track = mux.readTrack(fragmentedVideo(), 'vide');
  assert.strictEqual(track.timescale, 30000);
  assert.strictEqual(track.width, 1280);
  assert.strictEqual(track.height, 720);
  assert.deepStrictEqual(track.samples.map((sample) => sample.size), [4, 2]);
  assert.deepStrictEqual(track.samples.map((sample) => sample.duration), [1000, 1000]);
});

test('кадры фрагментированного потока указывают на настоящие байты', () => {
  const file = fragmentedVideo();
  const track = mux.readTrack(file, 'vide');
  const first = file.slice(track.samples[0].at, track.samples[0].at + track.samples[0].size);
  assert.deepStrictEqual(Array.from(first), Array.from(VIDEO_A));
});

test('собранный файл содержит обе дорожки', () => {
  const result = mux.mux(fragmentedVideo(), plainAudio());
  const top = boxes.readBoxes(result, 0, result.length).map((entry) => entry.type);
  assert.deepStrictEqual(top, ['ftyp', 'moov', 'mdat']);

  const moov = boxes.readBoxes(result, 0, result.length).find((entry) => entry.type === 'moov');
  const traks = boxes.readBoxes(result, moov.contentStart, moov.end).filter((entry) => entry.type === 'trak');
  assert.strictEqual(traks.length, 2);
});

test('кадры в собранном файле лежат там, куда показывает stco', () => {
  const result = mux.mux(fragmentedVideo(), plainAudio());
  const view = new DataView(result.buffer, result.byteOffset, result.length);
  const moov = boxes.readBoxes(result, 0, result.length).find((entry) => entry.type === 'moov');
  const traks = boxes.readBoxes(result, moov.contentStart, moov.end).filter((entry) => entry.type === 'trak');

  const offsets = traks.map((trak) => {
    const stco = boxes.findBox(result, ['mdia', 'minf', 'stbl', 'stco'], trak.contentStart, trak.end);
    return view.getUint32(stco.contentStart + 8);
  });

  assert.deepStrictEqual(Array.from(result.slice(offsets[0], offsets[0] + 4)), Array.from(VIDEO_A));
  assert.deepStrictEqual(Array.from(result.slice(offsets[1], offsets[1] + 3)), Array.from(AUDIO_A));
});

test('в собранном файле все кадры обеих дорожек', () => {
  const result = mux.mux(fragmentedVideo(), plainAudio());
  const mdat = boxes.readBoxes(result, 0, result.length).find((entry) => entry.type === 'mdat');
  const payload = Array.from(result.slice(mdat.contentStart, mdat.end));
  assert.deepStrictEqual(payload, [...VIDEO_A, ...VIDEO_B, ...AUDIO_A, ...AUDIO_B]);
});

test('поток без нужной дорожки отвергается', () => {
  assert.throws(() => mux.readTrack(plainAudio(), 'vide'), /нет видеодорожки/);
  assert.throws(() => mux.readTrack(fragmentedVideo(), 'soun'), /нет звуковой дорожки/);
});

test('мусор вместо потока отвергается', () => {
  assert.throws(() => mux.readTrack(new Uint8Array([1, 2, 3]), 'soun'), /битый контейнер/);
  assert.throws(() => mux.readTrack(box('ftyp', enc.encode('isom')), 'soun'), /нет moov/);
});
