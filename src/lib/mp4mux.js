'use strict';

// Складывает раздельные потоки видео и звука в один mp4 с двумя дорожками.
// Ничего не перекодирует: кадры копируются байт в байт, пересобирается только
// контейнер. Понимает и обычный mp4, и фрагментированный — YouTube отдаёт
// адаптивные потоки именно фрагментами.
//
// Чистый модуль: на вход байты, на выход байты либо ошибка с внятным текстом.

(function (root, factory) {
  const boxes = root.StashMp4Audio || (typeof require === 'function' ? require('./mp4audio.js') : null);
  const api = factory(boxes);
  root.StashMp4Mux = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (boxes) {
  const HEADER = 8;
  const MOVIE_TIMESCALE = 1000;
  const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];

  const { readBoxes, findBox } = boxes;

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

  // --- чтение дорожки ------------------------------------------------------

  function handlerOf(bytes, trak) {
    const hdlr = findBox(bytes, ['mdia', 'hdlr'], trak.contentStart, trak.end);
    return hdlr ? typeAt(bytes, hdlr.contentStart + 8) : null;
  }

  function findTrak(bytes, moov, handler) {
    for (const trak of readBoxes(bytes, moov.contentStart, moov.end)) {
      if (trak.type !== 'trak') continue;
      if (handlerOf(bytes, trak) === handler) return trak;
    }
    return null;
  }

  function readMdhd(view, box) {
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

  /** Ширина и высота из tkhd: они записаны в формате 16.16. */
  function readSize(view, trak, bytes) {
    const tkhd = findBox(bytes, ['tkhd'], trak.contentStart, trak.end);
    if (!tkhd) return { width: 0, height: 0 };
    const version = view.getUint8(tkhd.contentStart);
    const at = tkhd.contentStart + (version === 1 ? 88 : 76);
    return {
      width: Math.round(view.getUint32(at) / 65536),
      height: Math.round(view.getUint32(at + 4) / 65536)
    };
  }

  // --- обычный mp4 ---------------------------------------------------------

  function readDurations(view, stts, total) {
    const durations = new Array(total).fill(0);
    if (!stts) return durations;

    const count = view.getUint32(stts.contentStart + 4);
    let at = 0;
    for (let i = 0; i < count && at < total; i += 1) {
      const runStart = stts.contentStart + 8 + i * 8;
      const run = view.getUint32(runStart);
      const delta = view.getUint32(runStart + 4);
      for (let j = 0; j < run && at < total; j += 1) durations[at++] = delta;
    }
    return durations;
  }

  function readOffsets(view, ctts, total) {
    const offsets = new Array(total).fill(0);
    if (!ctts) return offsets;

    const version = view.getUint8(ctts.contentStart);
    const count = view.getUint32(ctts.contentStart + 4);
    let at = 0;
    for (let i = 0; i < count && at < total; i += 1) {
      const runStart = ctts.contentStart + 8 + i * 8;
      const run = view.getUint32(runStart);
      const offset = version === 0 ? view.getUint32(runStart + 4) : view.getInt32(runStart + 4);
      for (let j = 0; j < run && at < total; j += 1) offsets[at++] = offset;
    }
    return offsets;
  }

  function plainSamples(bytes, view, stbl) {
    const stsz = findBox(bytes, ['stsz'], stbl.contentStart, stbl.end);
    const stsc = findBox(bytes, ['stsc'], stbl.contentStart, stbl.end);
    const stco = findBox(bytes, ['stco'], stbl.contentStart, stbl.end);
    const co64 = findBox(bytes, ['co64'], stbl.contentStart, stbl.end);
    if (!stsz || !stsc || (!stco && !co64)) fail('битый контейнер');

    const uniform = view.getUint32(stsz.contentStart + 4);
    const total = view.getUint32(stsz.contentStart + 8);
    const sizes = new Array(total);
    for (let i = 0; i < total; i += 1) {
      sizes[i] = uniform || view.getUint32(stsz.contentStart + 12 + i * 4);
    }

    const runs = [];
    const runCount = view.getUint32(stsc.contentStart + 4);
    for (let i = 0; i < runCount; i += 1) {
      const at = stsc.contentStart + 8 + i * 12;
      runs.push({ firstChunk: view.getUint32(at), perChunk: view.getUint32(at + 4) });
    }

    const chunks = [];
    if (stco) {
      const count = view.getUint32(stco.contentStart + 4);
      for (let i = 0; i < count; i += 1) chunks.push(view.getUint32(stco.contentStart + 8 + i * 4));
    } else {
      const count = view.getUint32(co64.contentStart + 4);
      for (let i = 0; i < count; i += 1) chunks.push(Number(view.getBigUint64(co64.contentStart + 8 + i * 8)));
    }

    const durations = readDurations(view, findBox(bytes, ['stts'], stbl.contentStart, stbl.end), total);
    const offsets = readOffsets(view, findBox(bytes, ['ctts'], stbl.contentStart, stbl.end), total);

    const samples = [];
    let index = 0;
    for (let chunk = 0; chunk < chunks.length; chunk += 1) {
      let perChunk = 0;
      for (const run of runs) {
        if (run.firstChunk <= chunk + 1) perChunk = run.perChunk;
        else break;
      }
      let at = chunks[chunk];
      for (let i = 0; i < perChunk && index < total; i += 1) {
        samples.push({ at, size: sizes[index], duration: durations[index], cto: offsets[index] });
        at += sizes[index];
        index += 1;
      }
    }

    return samples;
  }

  // --- фрагментированный mp4 ----------------------------------------------

  function readTrex(bytes, view, moov, trackId) {
    const mvex = findBox(bytes, ['mvex'], moov.contentStart, moov.end);
    if (!mvex) return {};
    for (const trex of readBoxes(bytes, mvex.contentStart, mvex.end)) {
      if (trex.type !== 'trex') continue;
      if (view.getUint32(trex.contentStart + 4) !== trackId) continue;
      return {
        duration: view.getUint32(trex.contentStart + 12),
        size: view.getUint32(trex.contentStart + 16)
      };
    }
    return {};
  }

  function fragmentSamples(bytes, view, trackId, defaults) {
    const samples = [];

    for (const top of readBoxes(bytes, 0, bytes.length)) {
      if (top.type !== 'moof') continue;

      for (const traf of readBoxes(bytes, top.contentStart, top.end)) {
        if (traf.type !== 'traf') continue;

        const tfhd = findBox(bytes, ['tfhd'], traf.contentStart, traf.end);
        if (!tfhd) continue;

        const flags = view.getUint32(tfhd.contentStart) & 0xffffff;
        if (view.getUint32(tfhd.contentStart + 4) !== trackId) continue;

        let at = tfhd.contentStart + 8;
        let base = top.start;
        if (flags & 0x000001) {
          base = Number(view.getBigUint64(at));
          at += 8;
        }
        if (flags & 0x000002) at += 4;
        let defaultDuration = defaults.duration || 0;
        if (flags & 0x000008) {
          defaultDuration = view.getUint32(at);
          at += 4;
        }
        let defaultSize = defaults.size || 0;
        if (flags & 0x000010) {
          defaultSize = view.getUint32(at);
          at += 4;
        }

        for (const trun of readBoxes(bytes, traf.contentStart, traf.end)) {
          if (trun.type !== 'trun') continue;

          const version = view.getUint8(trun.contentStart);
          const trunFlags = view.getUint32(trun.contentStart) & 0xffffff;
          const count = view.getUint32(trun.contentStart + 4);

          let cursor = trun.contentStart + 8;
          let offset = 0;
          if (trunFlags & 0x000001) {
            offset = view.getInt32(cursor);
            cursor += 4;
          }
          if (trunFlags & 0x000004) cursor += 4;

          let position = base + offset;
          for (let i = 0; i < count; i += 1) {
            let duration = defaultDuration;
            let size = defaultSize;
            let cto = 0;

            if (trunFlags & 0x000100) {
              duration = view.getUint32(cursor);
              cursor += 4;
            }
            if (trunFlags & 0x000200) {
              size = view.getUint32(cursor);
              cursor += 4;
            }
            if (trunFlags & 0x000400) cursor += 4;
            if (trunFlags & 0x000800) {
              cto = version === 0 ? view.getUint32(cursor) : view.getInt32(cursor);
              cursor += 4;
            }

            samples.push({ at: position, size, duration, cto });
            position += size;
          }
        }
      }
    }

    return samples;
  }

  /** Дорожка одного типа из потока: описание, кадры и их расположение. */
  function readTrack(input, handler) {
    const bytes = asBytes(input);
    if (bytes.length < HEADER) fail('битый контейнер');

    const view = viewOf(bytes);
    const top = readBoxes(bytes, 0, bytes.length);
    const moov = top.find((box) => box.type === 'moov');
    if (!moov) fail('в файле нет moov');

    const trak = findTrak(bytes, moov, handler);
    if (!trak) {
      fail(handler === 'soun' ? 'в потоке нет звуковой дорожки' : 'в потоке нет видеодорожки');
    }

    const mdhd = findBox(bytes, ['mdia', 'mdhd'], trak.contentStart, trak.end);
    const stbl = findBox(bytes, ['mdia', 'minf', 'stbl'], trak.contentStart, trak.end);
    const stsd = stbl && findBox(bytes, ['stsd'], stbl.contentStart, stbl.end);
    if (!mdhd || !stbl || !stsd) fail('битый контейнер');

    const tkhd = findBox(bytes, ['tkhd'], trak.contentStart, trak.end);
    const trackId = tkhd ? view.getUint32(tkhd.contentStart + (view.getUint8(tkhd.contentStart) === 1 ? 20 : 12)) : 1;

    const fragmented = top.some((box) => box.type === 'moof');
    const samples = fragmented
      ? fragmentSamples(bytes, view, trackId, readTrex(bytes, view, moov, trackId))
      : plainSamples(bytes, view, stbl);

    if (!samples.length) fail('в потоке нет кадров');

    for (const sample of samples) {
      if (sample.at < 0 || sample.at + sample.size > bytes.length) fail('битый контейнер');
    }

    const media = readMdhd(view, mdhd);
    const size = handler === 'vide' ? readSize(view, trak, bytes) : { width: 0, height: 0 };

    return {
      bytes,
      handler,
      timescale: media.timescale || 1000,
      stsd: bytes.slice(stsd.start, stsd.end),
      samples,
      width: size.width,
      height: size.height
    };
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

  /** Длительности кадров сжимаются в прогоны: так устроен stts. */
  function buildStts(samples) {
    const runs = [];
    for (const sample of samples) {
      const last = runs[runs.length - 1];
      if (last && last.delta === sample.duration) last.count += 1;
      else runs.push({ count: 1, delta: sample.duration });
    }
    const parts = [u32(0), u32(runs.length)];
    for (const run of runs) parts.push(u32(run.count), u32(run.delta));
    return boxOf('stts', parts);
  }

  function buildCtts(samples) {
    if (!samples.some((sample) => sample.cto)) return new Uint8Array(0);
    const runs = [];
    for (const sample of samples) {
      const last = runs[runs.length - 1];
      if (last && last.offset === sample.cto) last.count += 1;
      else runs.push({ count: 1, offset: sample.cto });
    }
    // Версия 1: смещения могут быть отрицательными.
    const parts = [u32(0x01000000), u32(runs.length)];
    for (const run of runs) {
      const cell = new Uint8Array(4);
      new DataView(cell.buffer).setInt32(0, run.offset);
      parts.push(u32(run.count), cell);
    }
    return boxOf('ctts', parts);
  }

  function buildStsz(samples) {
    const parts = [u32(0), u32(0), u32(samples.length)];
    for (const sample of samples) parts.push(u32(sample.size));
    return boxOf('stsz', parts);
  }

  function buildTrak(track, id, mediaDuration, movieDuration, chunkOffset) {
    const isVideo = track.handler === 'vide';

    const tkhd = boxOf('tkhd', [
      u32(0x00000007), u32(0), u32(0), u32(id), u32(0), u32(movieDuration),
      new Uint8Array(8), u16(0), u16(0), u16(isVideo ? 0 : 0x0100), u16(0),
      matrix(),
      u32((track.width || 0) * 65536), u32((track.height || 0) * 65536)
    ]);

    const mdhd = boxOf('mdhd', [
      u32(0), u32(0), u32(0), u32(track.timescale), u32(mediaDuration), u16(0x55c4), u16(0)
    ]);

    const hdlr = boxOf('hdlr', [
      u32(0), u32(0), chars(track.handler), new Uint8Array(12),
      chars(isVideo ? 'VideoHandler\0' : 'SoundHandler\0')
    ]);

    const header = isVideo
      ? boxOf('vmhd', [u32(0x00000001), u32(0), u32(0)])
      : boxOf('smhd', [u32(0), u32(0)]);

    const dinf = boxOf('dinf', [boxOf('dref', [u32(0), u32(1), boxOf('url ', [u32(0x00000001)])])]);

    const stbl = boxOf('stbl', [
      track.stsd,
      buildStts(track.samples),
      buildCtts(track.samples),
      boxOf('stsc', [u32(0), u32(1), u32(1), u32(track.samples.length), u32(1)]),
      buildStsz(track.samples),
      boxOf('stco', [u32(0), u32(1), u32(chunkOffset)])
    ]);

    return boxOf('trak', [tkhd, boxOf('mdia', [mdhd, hdlr, boxOf('minf', [header, dinf, stbl])])]);
  }

  function totalDuration(track) {
    let sum = 0;
    for (const sample of track.samples) sum += sample.duration;
    return sum;
  }

  function payloadSize(track) {
    let sum = 0;
    for (const sample of track.samples) sum += sample.size;
    return sum;
  }

  function writeSamples(target, at, track) {
    let cursor = at;
    for (const sample of track.samples) {
      target.set(track.bytes.subarray(sample.at, sample.at + sample.size), cursor);
      cursor += sample.size;
    }
    return cursor;
  }

  /**
   * Собирает видео и звук в один mp4. Каждая дорожка кладётся одним куском,
   * поэтому stsc и stco занимают по одной записи.
   */
  function mux(videoInput, audioInput) {
    const video = readTrack(videoInput, 'vide');
    const audio = readTrack(audioInput, 'soun');

    const videoMedia = totalDuration(video);
    const audioMedia = totalDuration(audio);
    const movieDuration = Math.round(
      Math.max(videoMedia / video.timescale, audioMedia / audio.timescale) * MOVIE_TIMESCALE
    );

    const mvhd = boxOf('mvhd', [
      u32(0), u32(0), u32(0), u32(MOVIE_TIMESCALE), u32(movieDuration),
      u32(0x00010000), u16(0x0100), u16(0), new Uint8Array(8),
      matrix(), new Uint8Array(24), u32(3)
    ]);

    // Смещения кадров известны только после сборки moov, а её размер зависит
    // от смещений. Собираем с нулями, замеряем, затем собираем ещё раз.
    const draft = boxOf('moov', [
      mvhd,
      buildTrak(video, 1, videoMedia, movieDuration, 0),
      buildTrak(audio, 2, audioMedia, movieDuration, 0)
    ]);

    const ftyp = boxOf('ftyp', [chars('isom'), u32(512), chars('isom'), chars('iso2'), chars('mp41')]);
    const videoAt = ftyp.length + draft.length + HEADER;
    const audioAt = videoAt + payloadSize(video);

    const moov = boxOf('moov', [
      mvhd,
      buildTrak(video, 1, videoMedia, movieDuration, videoAt),
      buildTrak(audio, 2, audioMedia, movieDuration, audioAt)
    ]);

    if (moov.length !== draft.length) fail('не сошёлся размер moov');

    const mdat = new Uint8Array(HEADER + payloadSize(video) + payloadSize(audio));
    new DataView(mdat.buffer).setUint32(0, mdat.length);
    mdat.set(chars('mdat'), 4);
    writeSamples(mdat, writeSamples(mdat, HEADER, video), audio);

    return join([ftyp, moov, mdat]);
  }

  return { readTrack, mux };
});
