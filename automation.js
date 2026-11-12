'use strict';
// Local image analysis and ZIP packaging. No network, models, or dependencies.
window.EntrequadrosEngine = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const flat = (w, y) => [{ x: 0, y }, { x: w, y }];
  function simplify(points, tolerance = 0.8) {
    if (points.length < 3) return points;
    const keep = new Set([0, points.length - 1]), pending = [[0, points.length - 1]];
    while (pending.length) {
      const [a, b] = pending.pop(), p = points[a], q = points[b];
      let max = tolerance, index = -1;
      for (let i = a + 1; i < b; i++) {
        const distance = Math.abs(points[i].y - (p.y + (q.y - p.y) * (points[i].x - p.x) / (q.x - p.x)));
        if (distance > max) { max = distance; index = i; }
      }
      if (index >= 0) { keep.add(index); pending.push([a, index], [index, b]); }
    }
    return [...keep].sort((a, b) => a - b).map(i => points[i]);
  }
  function trace(data, w, h, baseline, radius) {
    // Follow the dark outline above the separator. A bubble protruding upward
    // belongs to the next panel. Stay near the separator unless its ink detours.
    const top = Math.max(0, baseline - radius), bottom = Math.min(h - 1, baseline + 3);
    const rows = bottom - top + 1, back = new Int16Array(w * rows);
    let previous = new Float64Array(rows), current = new Float64Array(rows);
    const cost = (x, r) => {
      const y = top + r;
      let ink = 255;
      for (let dy = -1; dy <= 1; dy++) {
        const k = (clamp(y + dy, 0, h - 1) * w + x) * 4;
        ink = Math.min(ink, Math.max(data[k], data[k + 1], data[k + 2]));
      }
      return (ink / 255) ** 2 * 9 + Math.abs(y - baseline) * 0.018;
    };
    for (let r = 0; r < rows; r++) previous[r] = cost(0, r) + Math.abs(top + r - baseline) * 2;
    for (let x = 1; x < w; x++) {
      for (let r = 0; r < rows; r++) {
        let best = Infinity, from = r;
        for (let d = -4; d <= 4; d++) {
          const pr = r + d;
          if (pr < 0 || pr >= rows) continue;
          const value = previous[pr] + Math.abs(d) * 0.22;
          if (value < best) { best = value; from = pr; }
        }
        current[r] = best + cost(x, r); back[x * rows + r] = from;
      }
      [previous, current] = [current, previous];
    }
    let r = 0, best = Infinity;
    for (let i = 0; i < rows; i++) {
      const score = previous[i] + Math.abs(top + i - baseline) * 2;
      if (score < best) { best = score; r = i; }
    }
    const points = new Array(w);
    let dark = 0, excursions = 0;
    for (let x = w - 1; x >= 0; x--) {
      const y = top + r; points[x] = { x, y };
      const k = (y * w + x) * 4;
      if (Math.max(data[k], data[k + 1], data[k + 2]) < 120) dark++;
      if (y <= top + 2) excursions++;
      r = back[x * rows + r];
    }
    points.push({ x: w, y: points.at(-1).y });
    return { points: simplify(points), ink: dark / w, clipped: excursions > w * 0.05 };
  }
  function detectGrid(data, w, h, count, image) {
    // Recursively split at actual, nearly solid gutters. Horizontal splits
    // establish rows; vertical splits within a row establish reading order.
    const dark = new Uint8Array(w * h);
    for (let p = 0; p < dark.length; p++) { const i = p * 4; dark[p] = Math.max(data[i], data[i + 1], data[i + 2]) < 65 ? 1 : 0; }
    function bestSplit(rect) {
      let best = null;
      for (const axis of ['y', 'x']) {
        const length = axis === 'y' ? rect.height : rect.width;
        const across = axis === 'y' ? rect.width : rect.height;
        const margin = Math.max(8, Math.ceil(length * 0.12));
        let start = -1, total = 0;
        const close = end => {
          if (start < 0) return;
          const thickness = end - start;
          if (thickness >= Math.max(2, Math.ceil(length * 0.003))) {
            const position = Math.round((start + end) / 2);
            const score = thickness / length + total / thickness * 0.02 + (axis === 'y' ? 0.005 : 0);
            if (!best || score > best.score) best = { axis, position, score, coverage: total / thickness };
          }
          start = -1; total = 0;
        };
        for (let a = margin; a < length - margin; a++) {
          let ink = 0;
          for (let b = 0; b < across; b++) {
            const x = rect.x + (axis === 'x' ? a : b), y = rect.y + (axis === 'y' ? a : b);
            ink += dark[y * w + x];
          }
          const coverage = ink / across;
          if (coverage >= 0.965) { if (start < 0) start = a; total += coverage; }
          else close(a);
        }
        close(length - margin);
      }
      return best;
    }
    const tree = { rect: { x: 0, y: 0, width: w, height: h } }, leaves = [tree];
    let vertical = false;
    while (leaves.length < (count || 12)) {
      let winner = null;
      for (const node of leaves) {
        if (node.split === undefined) node.split = bestSplit(node.rect);
        if (node.split && (!winner || node.split.score > winner.split.score)) winner = node;
      }
      if (!winner) break;
      const { rect: r, split: s } = winner;
      let first, second;
      if (s.axis === 'y') {
        first = { x: r.x, y: r.y, width: r.width, height: s.position };
        second = { x: r.x, y: r.y + s.position, width: r.width, height: r.height - s.position };
      } else {
        vertical = true;
        first = { x: r.x, y: r.y, width: s.position, height: r.height };
        second = { x: r.x + s.position, y: r.y, width: r.width - s.position, height: r.height };
      }
      winner.children = [{ rect: first }, { rect: second }];
      leaves.splice(leaves.indexOf(winner), 1, ...winner.children);
    }
    if (!vertical) return null;
    const panels = [];
    function read(node) { if (node.children) node.children.forEach(read); else panels.push({ x: node.rect.x * image.width / w, y: node.rect.y * image.height / h, width: node.rect.width * image.width / w, height: node.rect.height * image.height / h }); }
    read(tree);
    panels.sort((a, b) => Math.abs(a.y - b.y) < Math.min(a.height, b.height) * 0.35 ? a.x - b.x : a.y - b.y);
    const extra = leaves.some(node => bestSplit(node.rect));
    const warnings = [];
    if (count && panels.length !== count) warnings.push(`Identifiquei ${panels.length} quadros em vez de ${count}. Confira a quantidade e os recortes.`);
    if (extra) warnings.push('Há outras divisões pretas possíveis. Confira a quantidade de quadros.');
    return { layout: 'mixed', panels, lines: [], separators: [], warnings, confident: (!count || panels.length === count) && !extra };
  }
  function detectFrames(data, w, h, image, count) {
    const dark = new Uint8Array(w * h), queue = new Int32Array(w * h), frames = [];
    for (let p = 0; p < dark.length; p++) { const i = p * 4; dark[p] = Math.max(data[i], data[i + 1], data[i + 2]) < 85 ? 1 : 0; }
    const isDark = (x, y) => { const i = (y * w + x) * 4; return Math.max(data[i], data[i + 1], data[i + 2]) < 110; };
    for (let seed = 0; seed < dark.length; seed++) {
      if (dark[seed] !== 1) continue;
      let head = 0, tail = 1, x1 = w, y1 = h, x2 = 0, y2 = 0; queue[0] = seed; dark[seed] = 2;
      while (head < tail) {
        const p = queue[head++], x = p % w, y = (p / w) | 0;
        x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h) continue;
          const q = p + dy * w + dx; if (dark[q] === 1) { dark[q] = 2; queue[tail++] = q; }
        }
      }
      const width = x2 - x1 + 1, height = y2 - y1 + 1;
      if (width < w * 0.20 || height < h * 0.07 || width * height < w * h * 0.025) continue;
      let top = 0, bottom = 0, left = 0, right = 0;
      for (let x = x1; x <= x2; x++) {
        let a = false, b = false;
        for (let d = 0; d < Math.min(4, height); d++) { a ||= isDark(x, y1 + d); b ||= isDark(x, y2 - d); }
        top += a; bottom += b;
      }
      for (let y = y1; y <= y2; y++) {
        let a = false, b = false;
        for (let d = 0; d < Math.min(4, width); d++) { a ||= isDark(x1 + d, y); b ||= isDark(x2 - d, y); }
        left += a; right += b;
      }
      if (Math.min(top / width, bottom / width, left / height, right / height) > 0.84) frames.push({ x: x1, y: y1, width, height });
    }
    if (frames.length < 2) return null;
    const independent = frames.filter(a => !frames.some(b => a !== b && b.x > a.x && b.y > a.y && b.x + b.width < a.x + a.width && b.y + b.height < a.y + a.height));
    independent.sort((a, b) => Math.abs(a.y - b.y) < Math.min(a.height, b.height) * 0.35 ? a.x - b.x : a.y - b.y);
    const stacked = independent.every((p, i) => !i || p.y >= independent[i - 1].y + independent[i - 1].height - 3);
    const panels = independent.map((r, i) => {
      const top = stacked && i === 0 ? 0 : r.y;
      const bottom = stacked && i === independent.length - 1 ? h : r.y + r.height;
      return { x: stacked ? 0 : r.x * image.width / w, y: top * image.height / h, width: stacked ? image.width : r.width * image.width / w, height: (bottom - top) * image.height / h };
    });
    const warnings = count && panels.length !== count ? [`Identifiquei ${panels.length} quadros com moldura em vez de ${count}. Use quantidade automática ou confira os recortes.`] : [];
    return { layout: 'framed', panels, frameBoxes: independent, lines: [], separators: [], warnings, confident: panels.length <= 12 && !warnings.length };
  }
  function detect(image, count = 0) {
    const sample = document.createElement('canvas');
    const ratio = Math.min(1, 1000 / image.width, 2200 / image.height);
    sample.width = Math.max(1, Math.round(image.width * ratio)); sample.height = Math.max(1, Math.round(image.height * ratio));
    const c = sample.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#fff'; c.fillRect(0, 0, sample.width, sample.height); c.drawImage(image, 0, 0, sample.width, sample.height);
    const w = sample.width, h = sample.height, data = c.getImageData(0, 0, w, h).data;
    const framed = detectFrames(data, w, h, image, count);
    if (framed) return framed;
    const grid = detectGrid(data, w, h, count, image);
    if (grid) return grid;
    const scores = new Float64Array(h);
    for (let y = 0; y < h; y++) {
      let dark = 0;
      for (let x = 0; x < w; x++) { const k = (y * w + x) * 4; if (Math.max(data[k], data[k + 1], data[k + 2]) < 100) dark++; }
      scores[y] = dark / w;
    }
    let start = 0, end = h - 1;
    while (start < h - 1 && scores[start] > 0.94) start++;
    while (end > start && scores[end] > 0.94) end--;
    const span = end - start, lines = [], separators = [], warnings = [];
    let automatic = null;
    if (!count) {
      automatic = []; let band = null;
      const finish = () => {
        if (!band) return;
        if (band.to - band.from + 1 <= Math.max(12, span * 0.045)) automatic.push(band.best);
        band = null;
      };
      for (let y = Math.ceil(start + span * 0.08); y < end - span * 0.08; y++) {
        if (scores[y] >= 0.65) {
          if (!band) band = { from: y, to: y, best: y };
          band.to = y; if (scores[y] > scores[band.best]) band.best = y;
        } else finish();
      }
      finish();
      automatic = automatic.filter((y, i, a) => !i || y - a[i - 1] > span * 0.06);
      if (!automatic.length || automatic.length > 11) return { layout: 'stacked', lines: [], separators: [], warnings: ['Não consegui identificar os quadros com confiança. Confira os recortes ou informe a quantidade.'], confident: false };
      count = automatic.length + 1;
    }
    const panelHeight = span / count;
    for (let i = 1; i < count; i++) {
      const expected = start + panelHeight * i;
      const from = Math.max(start + 12, Math.round(expected - panelHeight * 0.32));
      const to = Math.min(end - 12, Math.round(expected + panelHeight * 0.32));
      let yBest = -1, best = -Infinity;
      for (let y = from; !automatic && y <= to; y++) {
        // Strong long borders win; expected position breaks ties between lines.
        const score = scores[y] - Math.abs(y - expected) / panelHeight * 0.09;
        if (score > best) { best = score; yBest = y; }
      }
      if (automatic) yBest = automatic[i - 1];
      if (yBest < 0 || scores[yBest] < 0.65) {
        warnings.push(`Divisão ${i}: não encontrei uma linha preta longa o suficiente.`); continue;
      }
      const traced = trace(data, w, h, yBest, Math.round(Math.min(panelHeight * 0.20, h * 0.075)));
      if (traced.ink < 0.75 || traced.clipped) warnings.push(`Divisão ${i}: confira o contorno antes de exportar.`);
      lines.push(traced.points.map(p => ({ x: p.x * image.width / w, y: p.y * image.height / h })));
      separators.push({ y: Math.round(yBest * image.height / h), coverage: scores[yBest], ink: traced.ink });
    }
    return { layout: 'stacked', lines, separators, warnings, confident: lines.length === count - 1 && !warnings.length };
  }
  function composeGrid(image, panels, options, target, previewWidth) {
    if (!panels.length) throw new Error('Selecione os quadros antes de exportar.');
    const width = options.width, scale = width / image.width;
    const heights = panels.map(p => Math.round(p.height * scale)), baseHeight = heights.reduce((a, b) => a + b, 0);
    const gapCount = panels.length - 1;
    const gap = options.targetHeight ? (options.targetHeight - baseHeight) / Math.max(1, gapCount) : options.gap;
    if (gap < 0) throw new Error('A altura final é pequena para esta imagem. Aumente a altura ou diminua a largura.');
    const height = options.targetHeight || baseHeight + Math.round(gap * gapCount);
    if (height > 32000 || width * height > 60000000) throw new Error('A saída ficou grande demais. Diminua a largura, a altura ou os espaços (limite: 60 megapixels e 32.000 px de altura).');
    const gaps = options.referenceSpacing && options.targetHeight && gapCount === 2 ? [gap * 2 * 36 / 74, gap * 2 * 38 / 74] : panels.slice(1).map(() => gap);
    const ratio = previewWidth ? Math.min(1, previewWidth / width, 15000 / height) : 1;
    target.width = Math.max(1, Math.round(width * ratio)); target.height = Math.max(1, Math.round(height * ratio));
    const c = target.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, target.width, target.height); c.scale(ratio, ratio);
    let y = 0; const positions = [];
    panels.forEach((panel, i) => {
      const panelWidth = panel.width * scale, x = (width - panelWidth) / 2;
      c.drawImage(image, panel.x, panel.y, panel.width, panel.height, x, Math.round(y), panelWidth, heights[i]);
      positions.push({ x, y: Math.round(y), width: panelWidth, height: heights[i] }); y += heights[i] + (gaps[i] || 0);
    });
    return { width, height, gap, gaps, positions };
  }
  function compose(image, lines, options, target, previewWidth = null) {
    if (!Array.isArray(lines)) {
      if (lines.panels) return composeGrid(image, lines.panels, options, target, previewWidth);
      lines = lines.lines;
    }
    const width = options.width, scale = width / image.width;
    const baseHeight = Math.round(image.height * scale);
    const gap = options.targetHeight ? (options.targetHeight - baseHeight) / lines.length : options.gap;
    if (options.targetHeight && (!lines.length || gap < 0)) throw new Error('A altura final é pequena para esta imagem. Aumente a altura ou diminua a largura.');
    const height = options.targetHeight || baseHeight + Math.round(gap * lines.length);
    // The reference has a slightly shorter first interval (360:380), rather
    // than identical intervals. Keep that proportion when fitting 3 panels.
    const gaps = options.referenceSpacing && options.targetHeight && lines.length === 2 ? [gap * 2 * 36 / 74, gap * 2 * 38 / 74] : lines.map(() => gap);
    if (height > 32000 || width * height > 60000000) throw new Error('A saída ficou grande demais. Diminua a largura, a altura ou os espaços (limite: 60 megapixels e 32.000 px de altura).');
    const ratio = previewWidth ? Math.min(1, previewWidth / width, 15000 / height) : 1;
    target.width = Math.max(1, Math.round(width * ratio)); target.height = Math.max(1, Math.round(height * ratio));
    const c = target.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, target.width, target.height);
    const borders = [flat(image.width, 0), ...lines, flat(image.width, image.height)];
    let offset = 0;
    for (let i = 0; i < borders.length - 1; i++) {
      c.save(); c.scale(ratio, ratio); c.translate(0, Math.round(offset)); c.scale(scale, scale);
      c.beginPath(); borders[i].forEach((p, j) => j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
      [...borders[i + 1]].reverse().forEach(p => c.lineTo(p.x, p.y)); c.closePath(); c.clip(); c.drawImage(image, 0, 0); c.restore();
      offset += gaps[i] || 0;
    }
    return { width, height, gap, gaps };
  }
  const crcTable = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  function crc32(data) { let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
  async function zip(entries) {
    const parts = [], directories = []; let offset = 0;
    for (const entry of entries) {
      const name = new TextEncoder().encode(entry.name), bytes = new Uint8Array(await entry.blob.arrayBuffer()), crc = crc32(bytes);
      const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, name.length, true); header.set(name, 30);
      const central = new Uint8Array(46 + name.length), d = new DataView(central.buffer);
      d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true); d.setUint16(14, 0x21, true);
      d.setUint32(16, crc, true); d.setUint32(20, bytes.length, true); d.setUint32(24, bytes.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true); central.set(name, 46);
      parts.push(header, entry.blob); directories.push(central); offset += header.length + bytes.length;
    }
    const size = directories.reduce((n, a) => n + a.length, 0), footer = new Uint8Array(22), f = new DataView(footer.buffer);
    f.setUint32(0, 0x06054b50, true); f.setUint16(8, entries.length, true); f.setUint16(10, entries.length, true); f.setUint32(12, size, true); f.setUint32(16, offset, true);
    return new Blob([...parts, ...directories, footer], { type: 'application/zip' });
  }
  return { detect, compose, zip };
})();
