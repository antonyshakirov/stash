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

/** Позиция четырёхбуквенного имени бокса в файле, чтобы чинить смещения. */
function indexOfType(bytes, type) {
  const needle = enc.encode(type);
  outer: for (let i = 0; i + 4 <= bytes.length; i += 1) {
    for (let j = 0; j < 4; j += 1) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

// Два звуковых кадра по три байта, лежащих подряд в mdat.
const FRAME_A = Uint8Array.from([0xaa, 0xbb, 0xcc]);
const FRAME_B = Uint8Array.from([0xdd, 0xee, 0xff]);

function soundHdlr() {
  return box('hdlr', u32(0), u32(0), enc.encode('soun'), zeros(12), zeros(1));
}

function sampleMp4(options) {
  const opts = options || {};

  const stsd = box('stsd', u32(0), u32(1), box('mp4a', zeros(28)));
  const stts = box('stts', u32(0), u32(1), u32(2), u32(1024));
  const stsc = box('stsc', u32(0), u32(1), u32(1), u32(2), u32(1));
  const stsz = box('stsz', u32(0), u32(0), u32(2), u32(FRAME_A.length), u32(FRAME_B.length));
  const stco = box('stco', u32(0), u32(1), u32(0));
  const extras = opts.extraStbl ? [box('sgpd', zeros(8))] : [];
  const stbl = box('stbl', stsd, stts, stsc, stsz, stco, ...extras);
  const minf = box('minf', box('smhd', zeros(8)), stbl);
  const mdhd = box('mdhd', u32(0), u32(0), u32(0), u32(44100), u32(2048), u16(0x55c4), u16(0));
  const trak = box('trak', box('tkhd', zeros(84)), box('mdia', mdhd, soundHdlr(), minf));
  const tail = opts.udta ? [box('udta', zeros(12))] : [];
  const moov = box('moov', box('mvhd', zeros(100)), trak, ...tail);

  const ftyp = box('ftyp', enc.encode('isom'), u32(512), enc.encode('isom'));
  const mdat = box('mdat', FRAME_A, FRAME_B);

  const file = Uint8Array.from([...ftyp, ...moov, ...mdat]);

  // Смещение кадров известно только после сборки: правим единственную
  // запись stco. Её значение лежит через имя бокса, версию и счётчик.
  const stcoAt = indexOfType(file, 'stco');
  file.set(u32(ftyp.length + moov.length + 8), stcoAt + 12);

  return file;
}

function asBuffer(bytes) {
  return bytes.slice().buffer;
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
  const result = mp4.extractAudio(asBuffer(sampleMp4()));

  const boxes = mp4.readBoxes(result, 0, result.length);
  assert.deepStrictEqual(boxes.map((entry) => entry.type), ['ftyp', 'moov', 'mdat']);

  const mdat = boxes.find((entry) => entry.type === 'mdat');
  const payload = result.slice(mdat.contentStart, mdat.end);
  assert.deepStrictEqual(Array.from(payload), [...FRAME_A, ...FRAME_B]);
});

test('в пересобранном m4a одна звуковая дорожка и рабочий stco', () => {
  const result = mp4.extractAudio(asBuffer(sampleMp4()));
  const view = new DataView(result.buffer, result.byteOffset, result.length);

  const stco = mp4.findBox(result, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stco']);
  assert.strictEqual(view.getUint32(stco.contentStart + 4), 1);

  const offset = view.getUint32(stco.contentStart + 8);
  assert.deepStrictEqual(Array.from(result.slice(offset, offset + 3)), Array.from(FRAME_A));
});

test('пересобранный m4a помечен как M4A', () => {
  const result = mp4.extractAudio(asBuffer(sampleMp4()));
  const ftyp = mp4.readBoxes(result, 0, result.length)[0];
  const brand = String.fromCharCode(...result.slice(ftyp.contentStart, ftyp.contentStart + 4));
  assert.strictEqual(brand, 'M4A ');
});

test('метаданные udta переносятся: в них лежат разгонные кадры кодировщика', () => {
  const result = mp4.extractAudio(asBuffer(sampleMp4({ udta: true })));
  assert.notStrictEqual(mp4.findBox(result, ['moov', 'udta']), null);
});

test('прочие таблицы stbl не теряются', () => {
  const result = mp4.extractAudio(asBuffer(sampleMp4({ extraStbl: true })));
  assert.notStrictEqual(mp4.findBox(result, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'sgpd']), null);
});

test('ролик без звуковой дорожки даёт внятную ошибку', () => {
  const hdlr = box('hdlr', u32(0), u32(0), enc.encode('vide'), zeros(12), zeros(1));
  const trak = box('trak', box('mdia', hdlr));
  const file = Uint8Array.from([...box('ftyp', enc.encode('isom')), ...box('moov', trak), ...box('mdat', FRAME_A)]);
  assert.throws(() => mp4.extractAudio(asBuffer(file)), /no audio track/);
});

test('файл без moov даёт внятную ошибку', () => {
  const file = Uint8Array.from([...box('ftyp', enc.encode('isom')), ...box('mdat', FRAME_A)]);
  assert.throws(() => mp4.extractAudio(asBuffer(file)), /no moov box/);
});

test('фрагментированный контейнер отвергается', () => {
  const trak = box('trak', box('mdia', soundHdlr()));
  const file = Uint8Array.from([
    ...box('ftyp', enc.encode('isom')),
    ...box('moov', trak),
    ...box('moof', zeros(4)),
    ...box('mdat', FRAME_A)
  ]);
  assert.throws(() => mp4.extractAudio(asBuffer(file)), /fragmented/);
});

test('звуковая дорожка без таблиц отвергается', () => {
  const trak = box('trak', box('mdia', soundHdlr()));
  const file = Uint8Array.from([...box('ftyp', enc.encode('isom')), ...box('moov', trak), ...box('mdat', FRAME_A)]);
  assert.throws(() => mp4.extractAudio(asBuffer(file)), /broken container/);
});

test('мусор вместо файла отвергается', () => {
  assert.throws(() => mp4.extractAudio(new Uint8Array([1, 2, 3]).buffer), /broken container/);
  assert.throws(() => mp4.extractAudio(new ArrayBuffer(0)), /broken container/);
});

// Условие Firefox: контент-скрипт получает от fetch буфер, созданный в другой
// «реальности». Он настоящий и данные в нём есть, но instanceof его не узнаёт.
// В Node то же самое воспроизводится отдельным контекстом vm. Ровно на этом
// разбор объявлял целый контейнер битым.
test('вход из другой реальности узнаётся, хотя instanceof его отвергает', () => {
  const vm = require('node:vm');
  const foreign = vm.runInNewContext('new ArrayBuffer(64)');

  assert.strictEqual(foreign instanceof ArrayBuffer, false, 'условие теста: instanceof обязан лгать');
  assert.strictEqual(Object.prototype.toString.call(foreign), '[object ArrayBuffer]');
  assert.strictEqual(foreign.byteLength, 64);

  // Свой mp4 разобрать из пустого буфера нельзя, но провал обязан быть по
  // существу — «нет moov», — а не «битый контейнер» из-за неузнанного входа.
  assert.throws(
    () => mp4.extractAudio(foreign),
    (error) => error.message !== 'broken container',
    'вход не должен отвергаться только за чужое происхождение'
  );

  const foreignView = vm.runInNewContext('new Uint8Array(64)');
  assert.strictEqual(foreignView instanceof Uint8Array, false);
  assert.throws(
    () => mp4.extractAudio(foreignView),
    (error) => error.message !== 'broken container'
  );
});

test('мусор вместо буфера по-прежнему отвергается', () => {
  for (const bad of [null, undefined, 42, 'строка', {}, { byteLength: 'нет' }]) {
    assert.throws(() => mp4.extractAudio(bad), /broken container/);
  }
});
