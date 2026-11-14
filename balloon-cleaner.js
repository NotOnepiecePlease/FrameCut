'use strict';
// Local detection of complete utterances in opaque and translucent balloons.
// No OCR, downloads, or remote processing. Original artwork is never overwritten.
window.BalloonCleaner = (() => {
  function analyze(image, options = {}) {
    const ratio = Math.min(1, 1400 / image.width, 2200 / image.height);
    const sample = document.createElement('canvas'); sample.width = Math.max(1, Math.round(image.width * ratio)); sample.height = Math.max(1, Math.round(image.height * ratio));
    const context = sample.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height), data = pixels.data;
    const w = sample.width, h = sample.height, length = w * h;
    const labels = new Int32Array(length), visited = new Uint8Array(length), queue = new Int32Array(length), light = new Uint8Array(length);
    const regions = [null], glyphs = [];
    for (let p = 0; p < length; p++) {
      const i = p * 4, low = Math.min(data[i], data[i + 1], data[i + 2]), high = Math.max(data[i], data[i + 1], data[i + 2]);
      light[p] = data[i + 3] > 220 && (options.closedBalloonsOnly ? low > 235 && high > 245 : low > 140 && high > 185) ? 1 : 0;
    }
    function flood(seed, test, mark, visit) {
      let head = 0, tail = 1; queue[0] = seed; mark(seed);
      while (head < tail) {
        const p = queue[head++], x = p % w, y = (p / w) | 0; visit(x, y);
        if (x && test(p - 1)) { mark(p - 1); queue[tail++] = p - 1; }
        if (x < w - 1 && test(p + 1)) { mark(p + 1); queue[tail++] = p + 1; }
        if (y && test(p - w)) { mark(p - w); queue[tail++] = p - w; }
        if (y < h - 1 && test(p + w)) { mark(p + w); queue[tail++] = p + w; }
      }
      return tail;
    }
    for (let seed = 0; seed < length; seed++) {
      if (!light[seed] || labels[seed]) continue;
      const id = regions.length, region = { id, x1: w, y1: h, x2: 0, y2: 0, area: 0, glyphs: [] };
      flood(seed, p => light[p] && !labels[p], p => { labels[p] = id; }, (x, y) => {
        region.area++; region.x1 = Math.min(region.x1, x); region.y1 = Math.min(region.y1, y); region.x2 = Math.max(region.x2, x); region.y2 = Math.max(region.y2, y);
      });
      region.width = region.x2 - region.x1 + 1; region.height = region.y2 - region.y1 + 1;
      region.eligible = region.area >= Math.max(250, 800 * ratio * ratio) && region.area < length * 0.28 && region.x1 > 0 && region.y1 > 0 && region.x2 < w - 1 && region.y2 < h - 1 && region.width > 35 * ratio && region.width / region.height > 0.25;
      if (options.closedBalloonsOnly) region.eligible = region.area >= length * 0.012 && region.area < length * 0.6 && region.width >= w * 0.12 && region.height >= h * 0.055 && region.x1 > 0 && region.y1 > 0 && region.x2 < w - 1 && region.y2 < h - 1;
      regions.push(region);
    }
    if (options.closedBalloonsOnly) {
      // Flood the complement as well: detached text is surrounded by one
      // balloon interior. Artwork connected to the outside cannot qualify.
      for (let seed = 0; seed < length; seed++) {
        if (light[seed] || visited[seed]) continue;
        let x1 = w, y1 = h, x2 = 0, y2 = 0;
        const neighbors = new Set();
        const size = flood(seed, p => !light[p] && !visited[p], p => { visited[p] = 1; }, (x, y) => {
          x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y);
          for (const p of [x ? y * w + x - 1 : -1, x < w - 1 ? y * w + x + 1 : -1, y ? (y - 1) * w + x : -1, y < h - 1 ? (y + 1) * w + x : -1]) {
            if (p >= 0 && regions[labels[p]]?.eligible) neighbors.add(labels[p]);
          }
        });
        if (neighbors.size !== 1) continue;
        const region = regions[[...neighbors][0]];
        if (x1 <= region.x1 || y1 <= region.y1 || x2 >= region.x2 || y2 >= region.y2) continue;
        // An enclosed white shape can also be a face, mask or decorated object.
        // Colored marks inside it are evidence of artwork, even if other marks
        // look like black letters. Preserve the whole region in that case.
        let colored = 0;
        for (let index = 0; index < size; index++) {
          const i = queue[index] * 4, high = Math.max(data[i], data[i + 1], data[i + 2]), low = Math.min(data[i], data[i + 1], data[i + 2]);
          if (high > 90 && high - low > 65) colored++;
        }
        if (colored >= 4 && colored / size > 0.08) region.coloredArtwork = true;
        const points = queue.slice(0, size).filter(p => Math.max(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) < 160);
        if (!points.length) continue;
        region.glyphs.push({ x1, y1, x2, y2, width: x2 - x1 + 1, height: y2 - y1 + 1, area: points.length, points });
      }
      for (const region of regions.slice(1)) {
        const letters = region.glyphs.filter(g => g.height >= 4 && g.area >= 4);
        if (!region.eligible || region.coloredArtwork || letters.length < 2) continue;
        const heights = letters.map(g => g.height).sort((a, b) => a - b);
        region.letters = letters; region.median = heights[(heights.length / 2) | 0]; region.rows = [];
        region.automatic = true; region.closedOnly = true;
      }
      return { sample, pixels, labels, regions, glyphs: [], blocks: [], ratio, w, h };
    }
    const strictGlyphs = [];
    for (const threshold of [135, 85]) {
    visited.fill(0);
    const destination = threshold === 135 ? glyphs : strictGlyphs;
    const dark = p => { const i = p * 4; return !visited[p] && data[i + 3] > 220 && Math.max(data[i], data[i + 1], data[i + 2]) < threshold; };
    for (let seed = 0; seed < length; seed++) {
      if (!dark(seed)) continue;
      let x1 = w, y1 = h, x2 = 0, y2 = 0, area = 0, solid = 0;
      const size = flood(seed, dark, p => { visited[p] = 1; }, (x, y) => { area++; const i = (y * w + x) * 4; if (Math.max(data[i], data[i + 1], data[i + 2]) < 25) solid++; x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); });
      const width = x2 - x1 + 1, height = y2 - y1 + 1;
      if (width < 1 || height < 1 || width > w * 0.16 || height > h * 0.075 || area < (threshold === 135 ? 1 : 2)) continue;
      const glyph = { id: destination.length, x1, y1, x2, y2, width, height, area, solid: solid / area, points: queue.slice(0, size), region: 0 };
      destination.push(glyph);
      const counts = new Map();
      for (let y = Math.max(0, y1 - 3); y <= Math.min(h - 1, y2 + 3); y++) for (let x = Math.max(0, x1 - 3); x <= Math.min(w - 1, x2 + 3); x++) {
        const id = labels[y * w + x]; if (id && regions[id].eligible) counts.set(id, (counts.get(id) || 0) + 1);
      }
      const winner = [...counts].sort((a, b) => b[1] - a[1])[0];
      if (winner) { glyph.region = winner[0]; if (threshold === 135) regions[winner[0]].glyphs.push(glyph); }
    }
    }
    for (const region of regions.slice(1)) {
      if (!region.eligible) continue;
      let letters = region.glyphs.filter(g => g.height >= 5 && g.width / g.height < 2.8 && g.height < region.height * 0.72);
      if (!letters.length) continue;
      const heights = letters.map(g => g.height).sort((a, b) => a - b), median = heights[(heights.length / 2) | 0];
      letters = letters.filter(g => g.height >= median * 0.5 && g.height <= median * 2.2);
      const rows = [];
      for (const letter of letters.sort((a, b) => a.y1 - b.y1)) {
        const center = (letter.y1 + letter.y2) / 2;
        let row = rows.find(r => Math.abs(r.y - center) < median * 0.58);
        if (!row) { row = { y: center, glyphs: [] }; rows.push(row); }
        row.glyphs.push(letter); row.y = row.glyphs.reduce((n, g) => n + (g.y1 + g.y2) / 2, 0) / row.glyphs.length;
      }
      const supportedRows = rows.filter(r => r.glyphs.length >= 2);
      letters = letters.filter(g => supportedRows.some(r => r.glyphs.includes(g)));
      region.letters = letters; region.median = median; region.rows = supportedRows;
      region.automatic = letters.length >= 5 && supportedRows.some(r => r.glyphs.length >= 3) && letters.length / supportedRows.length >= 2;
      if (region.automatic) {
        const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]; let samples = 0;
        for (let y = region.y1; y <= region.y2; y += 2) for (let x = region.x1; x <= region.x2; x += 2) if (labels[y * w + x] === region.id) {
          const i = (y * w + x) * 4; samples++; for (let k = 0; k < 3; k++) hist[k][data[i + k]]++;
        }
        const medianColor = hist.map(channel => { let sum = 0; for (let v = 0; v < 256; v++) { sum += channel[v]; if (sum >= samples / 2) return v; } return 255; });
        let consistent = 0;
        for (let y = region.y1; y <= region.y2; y += 2) for (let x = region.x1; x <= region.x2; x += 2) if (labels[y * w + x] === region.id) {
          const i = (y * w + x) * 4; if (medianColor.every((v, k) => Math.abs(v - data[i + k]) < 28)) consistent++;
        }
        region.automatic = Math.max(...medianColor) >= 240 && consistent / samples >= 0.60;
      }
    }
    const blocks = groupText(strictGlyphs);
    // A brightness threshold can divide a translucent balloon into several
    // regions. Never erase just the fragment associated with one such region.
    for (const block of blocks) for (const region of regions.slice(1)) if (region.automatic) {
      const inside = block.letters.filter(g => g.region === region.id).length;
      if (inside && inside < block.letters.length * 0.8) region.automatic = false;
    }
    return { sample, pixels, labels, regions, glyphs: strictGlyphs, blocks, ratio, w, h };
  }
  function groupText(glyphs) {
    const letters = glyphs.filter(g => g.height >= 4 && g.width / g.height < 2.8 && g.area / (g.width * g.height) > 0.10 && g.solid >= (g.height < 18 ? 0.40 : 0.62));
    function groups(items, adjacent) {
      const parent = items.map((_, i) => i);
      const root = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
      for (let i = 0; i < items.length; i++) for (let j = 0; j < i; j++) if (adjacent(items[i], items[j])) parent[root(i)] = root(j);
      const result = new Map(); items.forEach((item, i) => { const id = root(i); if (!result.has(id)) result.set(id, []); result.get(id).push(item); }); return [...result.values()];
    }
    function box(letters) {
      const heights = letters.map(g => g.height).sort((a, b) => a - b);
      return { letters, x1: Math.min(...letters.map(g => g.x1)), y1: Math.min(...letters.map(g => g.y1)), x2: Math.max(...letters.map(g => g.x2)), y2: Math.max(...letters.map(g => g.y2)), median: heights[(heights.length / 2) | 0] };
    }
    const rows = groups(letters, (a, b) => {
      const height = Math.max(a.height, b.height), gap = Math.max(a.x1, b.x1) - Math.min(a.x2 + 1, b.x2 + 1);
      return Math.min(a.height, b.height) / height > 0.45 && Math.abs((a.y1 + a.y2 - b.y1 - b.y2) / 2) < height * 0.45 && gap >= -Math.min(a.height, b.height) * 0.2 && gap < height * 0.95;
    }).filter(row => row.length >= 2).map(box);
    return groups(rows, (a, b) => {
      const gap = Math.max(a.y1, b.y1) - Math.min(a.y2 + 1, b.y2 + 1), center = Math.abs((a.x1 + a.x2 - b.x1 - b.x2) / 2);
      return Math.min(a.median, b.median) / Math.max(a.median, b.median) > 0.45 && gap >= 0 && gap < Math.max(a.median, b.median) * 1.7 && center < Math.max(a.x2 - a.x1, b.x2 - b.x1) * 0.65;
    }).map(rowGroup => ({ ...box(rowGroup.flatMap(r => r.letters)), rows: rowGroup })).filter(block => block.letters.length >= 5);
  }
  function fill(model, region, overlay) {
    const { w, h, labels, pixels } = model, data = pixels.data;
    const rowMin = new Int32Array(h).fill(w), rowMax = new Int32Array(h).fill(-1);
    if (!region.transparent) for (let y = region.y1; y <= region.y2; y++) for (let x = region.x1; x <= region.x2; x++) if (labels[y * w + x] === region.id) { rowMin[y] = Math.min(rowMin[y], x); rowMax[y] = Math.max(rowMax[y], x); }
    const letters = region.letters, median = region.median;
    // Include punctuation and small disconnected parts once a textual group is found.
    // Opaque balloons are processed as a whole, including every caption and
    // punctuation mark; a smaller font in a joined lobe must not be left behind.
    const glyphs = region.transparent || region.closedOnly ? region.glyphs : region.glyphs.filter(g => g.height <= Math.max(median * 2.3, ...letters.map(g => g.height)) && g.width <= median * 4 && region.rows.some(r => Math.abs((g.y1 + g.y2) / 2 - r.y) < Math.max(median * 0.80, g.height * 0.60)));
    if (!glyphs.length) return 0;
    const padding = Math.max(3, Math.ceil(median * 0.36));
    const x1 = Math.max(0, Math.min(...glyphs.map(g => g.x1)) - padding - 2), x2 = Math.min(w - 1, Math.max(...glyphs.map(g => g.x2)) + padding + 2);
    const y1 = Math.max(0, Math.min(...glyphs.map(g => g.y1)) - padding - 2), y2 = Math.min(h - 1, Math.max(...glyphs.map(g => g.y2)) + padding + 2);
    const pw = x2 - x1 + 1, ph = y2 - y1 + 1, size = pw * ph, mask = new Uint8Array(size), values = new Float32Array(size * 3), targets = [];
    if (region.transparent) {
      // On a translucent balloon, replace only actual ink plus its antialiasing.
      // Rectangular word fills would erase the underlying picture and logos.
      for (const g of glyphs) {
        const radius = Math.max(2, Math.min(4, Math.ceil(g.height * 0.035)));
        for (const point of g.points) {
          const gx = point % w, gy = (point / w) | 0;
          for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > radius * radius) continue;
            const x = gx + dx - x1, y = gy + dy - y1;
            if (x > 0 && x < pw - 1 && y > 0 && y < ph - 1) mask[y * pw + x] = 1;
          }
        }
      }
    } else for (const g of glyphs) for (let y = Math.max(y1 + 1, g.y1 - padding); y <= Math.min(y2 - 1, g.y2 + padding); y++) for (let x = Math.max(x1 + 1, g.x1 - padding); x <= Math.min(x2 - 1, g.x2 + padding); x++) {
      // Preserve the outer boundary, including its antialiasing and the tail.
      if (x <= rowMin[y] + 2 || x >= rowMax[y] - 2 || x <= rowMin[Math.max(0, y - 2)] || x >= rowMax[Math.max(0, y - 2)] || x <= rowMin[Math.min(h - 1, y + 2)] || x >= rowMax[Math.min(h - 1, y + 2)]) continue;
      mask[(y - y1) * pw + x - x1] = 1;
    }
    if (!region.transparent) for (const g of glyphs) for (const point of g.points) {
      const gx = point % w, gy = (point / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = gx + dx - x1, y = gy + dy - y1;
        if (x <= 0 || y <= 0 || x >= pw - 1 || y >= ph - 1) continue;
        if ((!dx && !dy) || labels[(gy + dy) * w + gx + dx] === region.id) mask[y * pw + x] = 1;
      }
    }
    let expected = 0, missed = 0;
    for (const g of glyphs) for (const point of g.points) {
      const x = point % w - x1, y = ((point / w) | 0) - y1; expected++;
      if (x < 0 || y < 0 || x >= pw || y >= ph || !mask[y * pw + x]) missed++;
    }
    // Commit atomically for this balloon/utterance. Never deliberately return
    // half-erased letters because a region boundary cut through the text.
    if (!expected || missed > Math.max(2, expected * 0.015)) return 0;
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const p = y * pw + x, src = ((y + y1) * w + x + x1) * 4;
      for (let k = 0; k < 3; k++) values[p * 3 + k] = data[src + k];
      if (mask[p]) targets.push(p);
    }
    if (region.closedOnly) {
      // A closed white balloon has a solid background. Use its median color
      // rather than interpolating large letters into visible grey smudges.
      const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]; let count = 0;
      for (let y = region.y1; y <= region.y2; y += 2) for (let x = region.x1; x <= region.x2; x += 2) if (labels[y * w + x] === region.id) {
        count++; for (let k = 0; k < 3; k++) hist[k][data[(y * w + x) * 4 + k]]++;
      }
      const color = hist.map(channel => { let sum = 0; for (let v = 0; v < 256; v++) { sum += channel[v]; if (sum >= count / 2) return v; } return 255; });
      for (const p of targets) {
        const x = p % pw + x1, y = ((p / pw) | 0) + y1, i = (y * w + x) * 4;
        for (let k = 0; k < 3; k++) overlay.data[i + k] = color[k]; overlay.data[i + 3] = 255;
      }
      return targets.length;
    }
    // Initialize from the nearest clean boundary, then solve a local harmonic
    // interpolation to continue gentle color changes through the erased glyphs.
    const filled = new Uint8Array(size), bfs = new Int32Array(size); let head = 0, tail = 0;
    // Do not use ink from the balloon's outline as a source color. Temporarily
    // extrapolate clean background through it for the interpolation only.
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const p = y * pw + x;
      const src = ((y + y1) * w + x + x1) * 4;
      const background = region.transparent ? Math.max(data[src], data[src + 1], data[src + 2]) > 100 : labels[(y + y1) * w + x + x1] === region.id;
      if (!mask[p] && background) { filled[p] = 1; bfs[tail++] = p; }
    }
    if (!tail) return 0;
    while (head < tail) {
      const p = bfs[head++], x = p % pw, y = (p / pw) | 0;
      const neighbors = [x ? p - 1 : -1, x < pw - 1 ? p + 1 : -1, y ? p - pw : -1, y < ph - 1 ? p + pw : -1];
      for (const q of neighbors) if (q >= 0 && !filled[q]) {
        filled[q] = 1; bfs[tail++] = q;
        for (let k = 0; k < 3; k++) values[q * 3 + k] = values[p * 3 + k];
      }
    }
    for (let iteration = 0; iteration < 220; iteration++) {
      let change = 0;
      for (const p of targets) for (let k = 0; k < 3; k++) {
        const i = p * 3 + k, average = (values[i - 3] + values[i + 3] + values[i - pw * 3] + values[i + pw * 3]) / 4;
        change = Math.max(change, Math.abs(values[i] - average)); values[i] = average;
      }
      if (iteration > 30 && change < 0.04) break;
    }
    for (const p of targets) {
      const x = p % pw + x1, y = ((p / pw) | 0) + y1, i = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) overlay.data[i + k] = Math.round(values[p * 3 + k]); overlay.data[i + 3] = 255;
    }
    return targets.length;
  }
  function clean(image, options = {}) {
    const model = analyze(image, options);
    let regions = model.regions.filter(r => r?.automatic);
    if (options.point) {
      const x = Math.max(0, Math.min(model.w - 1, Math.round(options.point.x * model.w / image.width))), y = Math.max(0, Math.min(model.h - 1, Math.round(options.point.y * model.h / image.height)));
      const region = model.regions[model.labels[y * model.w + x]];
      regions = region?.eligible && region.letters?.length ? [region] : [];
    } else {
      for (const block of model.blocks) {
        if (block.letters.filter(g => regions.some(r => r.id > 0 && r.id === g.region)).length >= block.letters.length * 0.8) continue;
        // Flat white text outside any closed balloon can be a credit or label.
        // Leave it untouched rather than treating every printed word as speech.
        let background = 0, white = 0;
        for (let y = block.y1; y <= block.y2; y += 3) for (let x = block.x1; x <= block.x2; x += 3) {
          const i = (y * model.w + x) * 4, color = model.pixels.data;
          if (Math.max(color[i], color[i + 1], color[i + 2]) < 100) continue;
          background++; if (Math.min(color[i], color[i + 1], color[i + 2]) > 245) white++;
        }
        if (!background || white / background > 0.97) continue;
        const rows = block.rows.map(r => ({ y: (r.y1 + r.y2) / 2, glyphs: r.letters }));
        const extra = model.glyphs.filter(g => g.height <= block.median * 2.3 && g.width <= block.median * 3 && g.x2 >= block.x1 - block.median * 0.6 && g.x1 <= block.x2 + block.median * 0.6 && rows.some(r => Math.abs((g.y1 + g.y2) / 2 - r.y) < block.median * 0.9));
        const glyphs = [...new Set([...block.letters, ...extra])];
        regions = regions.filter(r => r.transparent || !block.letters.some(g => g.region === r.id));
        regions.push({ ...block, id: 0, transparent: true, glyphs, rows, width: block.x2 - block.x1 + 1, height: block.y2 - block.y1 + 1 });
      }
    }
    const overlayCanvas = document.createElement('canvas'); overlayCanvas.width = model.w; overlayCanvas.height = model.h;
    const oc = overlayCanvas.getContext('2d'), overlay = oc.createImageData(model.w, model.h);
    let changed = 0; const completed = [], warnings = [];
    for (const region of regions) {
      const erased = fill(model, region, overlay);
      if (erased) { changed += erased; completed.push(region); }
      else warnings.push('Uma fala foi preservada porque a máscara não cobriu todas as letras com segurança. Confira a imagem.');
    }
    oc.putImageData(overlay, 0, 0);
    const result = document.createElement('canvas'); result.width = image.width; result.height = image.height;
    const c = result.getContext('2d'); c.drawImage(image, 0, 0); c.drawImage(overlayCanvas, 0, 0, image.width, image.height);
    return { canvas: result, balloons: completed.length, changed, warnings, reviewCount: warnings.length, regions: completed.map(r => ({ x: r.x1 / model.ratio, y: r.y1 / model.ratio, width: r.width / model.ratio, height: r.height / model.ratio, letters: r.letters.length, transparent: !!r.transparent })) };
  }
  return { clean };
})();
