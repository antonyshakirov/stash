'use strict';

// Достаёт звуковую дорожку из mp4 и пересобирает её в m4a.
// Ничего не декодирует: звуковые кадры копируются байт в байт, меняется
// только контейнер. Качество поэтому равно исходному.
//
// Чистый модуль: на вход ArrayBuffer, на выход Uint8Array либо ошибка с
// внятным текстом. Ни DOM, ни сети, ни chrome.

(function (root, factory) {
  const api = factory();
  root.ReelboxMp4Audio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const HEADER = 8;
  const FALLBACK_TIMESCALE = 1000;
  // Единичная матрица преобразования: обязательное поле, на звук не влияет.
  const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];

  function fail(message) {
    throw new Error(message);
  }

  function asBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input && input.buffer instanceof ArrayBuffer) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    return fail('битый контейнер');
  }

  function viewOf(bytes) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  }

  function typeAt(bytes, at) {
    return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  }

  // --- чтение --------------------------------------------------------------

  /**
   * Боксы в заданном промежутке. Размер 1 означает 64-битный largesize,
   * размер 0 — «до конца промежутка».
   */
  function readBoxes(bytes, start, end) {
    const view = viewOf(bytes);
    const from = start === undefined ? 0 : start;
    const to = end === undefined ? bytes.length : end;
    const boxes = [];
    let at = from;

    while (at + HEADER <= to) {
      let size = view.getUint32(at);
      const type = typeAt(bytes, at + 4);
      let contentStart = at + HEADER;

      if (size === 1) {
        if (at + 16 > to) break;
        size = view.getUint32(at + 8) * 4294967296 + view.getUint32(at + 12);
        contentStart = at + 16;
      } else if (size === 0) {
        size = to - at;
      }

      if (size < HEADER || at + size > to) break;
      boxes.push({ type, start: at, end: at + size, contentStart });
      at += size;
    }

    return boxes;
  }

  /** Бокс по пути вида ['moov', 'trak', 'mdia']. */
  function findBox(bytes, path, start, end) {
    let from = start === undefined ? 0 : start;
    let to = end === undefined ? bytes.length : end;
    let found = null;

    for (const type of path) {
      found = readBoxes(bytes, from, to).find((box) => box.type === type);
      if (!found) return null;
      from = found.contentStart;
      to = found.end;
    }

    return found;
  }

  function findAudioTrak(bytes, moov) {
    for (const trak of readBoxes(bytes, moov.contentStart, moov.end)) {
      if (trak.type !== 'trak') continue;
      const hdlr = findBox(bytes, ['mdia', 'hdlr'], trak.contentStart, trak.end);
      if (!hdlr) continue;
      if (typeAt(bytes, hdlr.contentStart + 8) === 'soun') return trak;
    }
    return null;
  }

  // mvhd и mdhd совпадают по раскладке в первых полях, поэтому читаются одним.
  function readTimescaleAndDuration(view, box) {
    const version = view.getUint8(box.contentStart);
    if (version === 1) {
      return {
        timescale: view.getUint32(box.contentStart + 20),
        duration: Number(view.getBigUint64(box.contentStart + 24))
      };
    }
    return {
      timescale: view.getUint32(box.contentStart + 12),
      duration: view.getUint32(box.contentStart + 16)
    };
  }

  // Ненулевой sample_size означает, что все кадры одного размера.
  function readSizes(view, box) {
    const uniform = view.getUint32(box.contentStart + 4);
    const count = view.getUint32(box.contentStart + 8);
    if (uniform) return { count, uniform, sizes: null };

    const sizes = new Array(count);
    for (let i = 0; i < count; i += 1) {
      sizes[i] = view.getUint32(box.contentStart + 12 + i * 4);
    }
    return { count, uniform: 0, sizes };
  }

  function readChunkRuns(view, box) {
    const count = view.getUint32(box.contentStart + 4);
    const runs = [];
    for (let i = 0; i < count; i += 1) {
      const at = box.contentStart + 8 + i * 12;
      runs.push({ firstChunk: view.getUint32(at), samplesPerChunk: view.getUint32(at + 4) });
    }
    return runs;
  }

  function readChunkOffsets(view, stco, co64) {
    if (stco) {
      const count = view.getUint32(stco.contentStart + 4);
      const offsets = new Array(count);
      for (let i = 0; i < count; i += 1) offsets[i] = view.getUint32(stco.contentStart + 8 + i * 4);
      return offsets;
    }

    const count = view.getUint32(co64.contentStart + 4);
    const offsets = new Array(count);
    for (let i = 0; i < count; i += 1) {
      offsets[i] = Number(view.getBigUint64(co64.contentStart + 8 + i * 8));
    }
    return offsets;
  }

  /** Внутри чанка кадры лежат подряд, поэтому хватает смещения чанка. */
  function sampleRanges(runs, offsets, sizes) {
    const ranges = [];
    let sample = 0;

    for (let chunk = 0; chunk < offsets.length; chunk += 1) {
      let perChunk = 0;
      for (const run of runs) {
        if (run.firstChunk <= chunk + 1) perChunk = run.samplesPerChunk;
        else break;
      }

      let at = offsets[chunk];
      for (let i = 0; i < perChunk && sample < sizes.count; i += 1) {
        const size = sizes.uniform || sizes.sizes[sample];
        ranges.push({ at, size });
        at += size;
        sample += 1;
      }
    }

    return ranges;
  }

  // --- запись --------------------------------------------------------------

  function u32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value >>> 0);
    return out;
  }

  function u16(value) {
    const out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, value & 0xffff);
    return out;
  }

  function chars(text) {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
    return out;
  }

  function join(parts) {
    let length = 0;
    for (const part of parts) length += part.length;
    const out = new Uint8Array(length);
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }

  function boxOf(type, parts) {
    const payload = join(parts);
    return join([u32(HEADER + payload.length), chars(type), payload]);
  }

  function matrix() {
    return join(MATRIX.map(u32));
  }

  function buildMvhd(timescale, duration) {
    return boxOf('mvhd', [
      u32(0), u32(0), u32(0), u32(timescale), u32(duration),
      u32(0x00010000), u16(0x0100), u16(0), new Uint8Array(8),
      matrix(), new Uint8Array(24), u32(2)
    ]);
  }

  function buildTkhd(duration) {
    return boxOf('tkhd', [
      u32(0x00000007), u32(0), u32(0), u32(1), u32(0), u32(duration),
      new Uint8Array(8), u16(0), u16(0), u16(0x0100), u16(0),
      matrix(), u32(0), u32(0)
    ]);
  }

  function buildMdhd(timescale, duration) {
    return boxOf('mdhd', [u32(0), u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0)]);
  }

  function buildHdlr() {
    return boxOf('hdlr', [u32(0), u32(0), chars('soun'), new Uint8Array(12), chars('SoundHandler\0')]);
  }

  function buildDinf() {
    const url = boxOf('url ', [u32(0x00000001)]);
    return boxOf('dinf', [boxOf('dref', [u32(0), u32(1), url])]);
  }

  // --- сборка --------------------------------------------------------------

  function extractAudio(input) {
    const bytes = asBytes(input);
    if (bytes.length < HEADER) fail('битый контейнер');

    const view = viewOf(bytes);
    const top = readBoxes(bytes, 0, bytes.length);
    if (!top.length) fail('битый контейнер');

    if (top.some((box) => box.type === 'moof' || box.type === 'sidx')) {
      fail('фрагментированный mp4 не поддерживается');
    }

    const moov = top.find((box) => box.type === 'moov');
    if (!moov) fail('в файле нет moov');

    const trak = findAudioTrak(bytes, moov);
    if (!trak) fail('в ролике нет звуковой дорожки');

    const mdhd = findBox(bytes, ['mdia', 'mdhd'], trak.contentStart, trak.end);
    const stbl = findBox(bytes, ['mdia', 'minf', 'stbl'], trak.contentStart, trak.end);
    if (!mdhd || !stbl) fail('битый контейнер');

    const stsd = findBox(bytes, ['stsd'], stbl.contentStart, stbl.end);
    const stts = findBox(bytes, ['stts'], stbl.contentStart, stbl.end);
    const stsc = findBox(bytes, ['stsc'], stbl.contentStart, stbl.end);
    const stsz = findBox(bytes, ['stsz'], stbl.contentStart, stbl.end);
    const stco = findBox(bytes, ['stco'], stbl.contentStart, stbl.end);
    const co64 = findBox(bytes, ['co64'], stbl.contentStart, stbl.end);
    if (!stsd || !stts || !stsc || !stsz || (!stco && !co64)) fail('битый контейнер');

    const sizes = readSizes(view, stsz);
    const ranges = sampleRanges(readChunkRuns(view, stsc), readChunkOffsets(view, stco, co64), sizes);
    if (!ranges.length) fail('в ролике нет звуковой дорожки');

    let total = 0;
    for (const range of ranges) {
      if (range.at < 0 || range.at + range.size > bytes.length) fail('битый контейнер');
      total += range.size;
    }

    const media = readTimescaleAndDuration(view, mdhd);

    // Шкала фильма берётся из исходника: только тогда список правок,
    // который отрезает разгонные кадры кодировщика, переносится как есть.
    const mvhd = findBox(bytes, ['mvhd'], moov.contentStart, moov.end);
    const movie = mvhd ? readTimescaleAndDuration(view, mvhd) : null;
    const movieTimescale = (movie && movie.timescale) || FALLBACK_TIMESCALE;
    const movieDuration = media.timescale
      ? Math.round((media.duration / media.timescale) * movieTimescale)
      : 0;

    const edts = findBox(bytes, ['edts'], trak.contentStart, trak.end);

    // Таблицы переносятся как есть, кроме раскладки по чанкам: все кадры
    // кладутся в один чанк, поэтому stsc и stco занимают по одной записи.
    // Всё прочее — sgpd, sbgp, ctts — сохраняется: там живут сведения,
    // без которых проигрыватель ошибается в длительности.
    const stblParts = [];
    for (const child of readBoxes(bytes, stbl.contentStart, stbl.end)) {
      if (child.type === 'stsc' || child.type === 'stco' || child.type === 'co64') continue;
      stblParts.push(bytes.slice(child.start, child.end));
    }
    stblParts.push(boxOf('stsc', [u32(0), u32(1), u32(1), u32(ranges.length), u32(1)]));
    stblParts.push(boxOf('stco', [u32(0), u32(1), u32(0)]));

    // Apple держит в udta тег iTunSMPB с разгонными кадрами кодировщика.
    // Без него длительность в проигрывателе уезжает на десятки миллисекунд.
    const udta = findBox(bytes, ['udta'], moov.contentStart, moov.end);

    const newMoov = boxOf('moov', [
      buildMvhd(movieTimescale, movieDuration),
      boxOf('trak', [
        buildTkhd(movieDuration),
        edts ? bytes.slice(edts.start, edts.end) : new Uint8Array(0),
        boxOf('mdia', [
          buildMdhd(media.timescale, media.duration),
          buildHdlr(),
          boxOf('minf', [boxOf('smhd', [u32(0), u32(0)]), buildDinf(), boxOf('stbl', stblParts)])
        ])
      ]),
      udta ? bytes.slice(udta.start, udta.end) : new Uint8Array(0)
    ]);

    const ftyp = boxOf('ftyp', [chars('M4A '), u32(512), chars('M4A '), chars('mp42'), chars('isom')]);

    // Смещение кадров известно только сейчас: правим единственную запись stco.
    const stcoOut = findBox(newMoov, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stco']);
    new DataView(newMoov.buffer, newMoov.byteOffset, newMoov.length)
      .setUint32(stcoOut.contentStart + 8, ftyp.length + newMoov.length + HEADER);

    const mdat = new Uint8Array(HEADER + total);
    new DataView(mdat.buffer).setUint32(0, mdat.length);
    mdat.set(chars('mdat'), 4);
    let at = HEADER;
    for (const range of ranges) {
      mdat.set(bytes.subarray(range.at, range.at + range.size), at);
      at += range.size;
    }

    return join([ftyp, newMoov, mdat]);
  }

  return { readBoxes, findBox, extractAudio };
});
