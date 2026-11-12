'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const source = document.createElement('canvas'), work = document.createElement('canvas');
  const wctx = work.getContext('2d', { willReadFrequently: true });
  const engine = window.EntrequadrosEngine;
  const cleaner = window.BalloonCleaner;
  let activeCleanup = null;
  let queue = [], activeIndex = -1, batchBusy = false, stopBatch = false, batchStamp = '', revision = 0, paintDirty = false;
  let cuts = [], panels = null, tool = 'cut', preview = false, gesture = null, history = [], loaded = false, fileName = 'tirinha', busy = false;
  const status = message => { $('status').textContent = message; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const number = (id, lo, hi) => clamp(Number($(id).value) || 0, lo, hi);
  const cloneCuts = () => cuts.map(line => line.map(p => ({ ...p })));
  const clonePanels = () => panels ? panels.map(p => ({ ...p })) : null;
  const geometry = () => panels ? { panels } : cuts;
  const panelCount = () => panels ? panels.length : cuts.length + 1;
  function remember(pixels = false) {
    activeCleanup = null;
    revision++; if (pixels) paintDirty = true;
    const approved = queue[activeIndex]?.approved || false;
    if (!pixels && queue[activeIndex]) queue[activeIndex].approved = true;
    history.push({ cuts: cloneCuts(), panels: clonePanels(), approved, pixels: pixels ? wctx.getImageData(0, 0, work.width, work.height) : null });
    // Limit full-image undo storage as well as the number of small geometry operations.
    while (history.length > 35 || (history.length > 1 && history.reduce((n, h) => n + (h.pixels?.data.byteLength || 0), 0) > 100 * 1024 * 1024)) history.shift();
    $('undo').disabled = false;
  }
  function yAt(line, x) {
    for (let i = 1; i < line.length; i++) if (x <= line[i].x) {
      const a = line[i - 1], b = line[i];
      return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    }
    return line.at(-1).y;
  }
  function borders() {
    return [[{ x: 0, y: 0 }, { x: work.width, y: 0 }], ...cuts, [{ x: 0, y: work.height }, { x: work.width, y: work.height }]];
  }
  function allowedY(index, x, y) {
    const top = index ? yAt(cuts[index - 1], x) + 3 : 3;
    const bottom = index < cuts.length - 1 ? yAt(cuts[index + 1], x) - 3 : work.height - 3;
    return clamp(y, top, bottom);
  }
  function validCuts() {
    const lines = borders();
    for (let i = 1; i < lines.length; i++) {
      const xs = [...lines[i - 1], ...lines[i]].map(p => p.x);
      if (xs.some(x => yAt(lines[i], x) - yAt(lines[i - 1], x) < 1)) return false;
    }
    return true;
  }
  function options() {
    return { width: number('width', 100, 12000), gap: number('gap', 0, 4000), targetHeight: $('fitHeight').checked ? number('height', 200, 32000) : null, referenceSpacing: true };
  }
  function cleanCurrent() {
    if (!activeCleanup) activeCleanup = cleaner.clean(work);
    return activeCleanup;
  }
  function compose(target, maxWidth = null) {
    const cleanup = $('emptyBalloons').checked ? cleanCurrent() : null;
    return engine.compose(cleanup?.canvas || work, geometry(), options(), target, maxWidth);
  }
  function render() {
    if (!loaded) return;
    if (queue[activeIndex]) { queue[activeIndex].lines = cloneCuts(); queue[activeIndex].panels = clonePanels(); }
    $('panelCount').textContent = `${panelCount()} quadro${panelCount() === 1 ? '' : 's'}${panels ? ' · recortes detectados' : ''}`;
    if (preview) {
      try {
        const info = compose(canvas, 1400);
        const cleanup = $('emptyBalloons').checked ? cleanCurrent() : null;
        $('cleanupInfo').textContent = cleanup ? (cleanup.reviewCount ? `${cleanup.balloons} falas limpas. ${cleanup.reviewCount} falas preservadas para revisão; a limpeza não foi aplicada parcialmente nelas.` : cleanup.balloons ? `${cleanup.balloons} balões identificados e esvaziados nesta imagem. Confira se algum texto ficou para trás.` : 'Nenhum balão identificado automaticamente. Confira a imagem e use a limpeza com um clique, se necessário.') : 'Limpeza automática desligada. O texto original será mantido na saída.';
        status(`Prévia: ${info.width} × ${info.height} px.${cleanup ? ` ${cleanup.balloons} balões esvaziados.` : ''} Sem as linhas de edição no PNG.`);
      }
      catch (error) { canvas.width = work.width; canvas.height = work.height; ctx.drawImage(work, 0, 0); status(error.message); }
      return;
    }
    activeCleanup = null;
    $('cleanupInfo').textContent = 'Você está vendo o original. A limpeza automática é aplicada ao resultado, sem alterar este original.';
    canvas.width = work.width; canvas.height = work.height; ctx.drawImage(work, 0, 0);
    const scale = work.width / Math.max(1, canvas.getBoundingClientRect().width);
    ctx.lineWidth = 1.7 * scale; ctx.font = `bold ${11 * scale}px Trebuchet MS`;
    cuts.forEach((line, i) => {
      ctx.strokeStyle = '#213f35'; ctx.setLineDash([7 * scale, 5 * scale]); ctx.beginPath();
      line.forEach((p, j) => j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
      line.forEach(p => { ctx.fillStyle = '#dfff73'; ctx.beginPath(); ctx.arc(p.x, p.y, 5 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = '#dfff73'; ctx.fillRect(9 * scale, line[0].y - 18 * scale, 61 * scale, 17 * scale);
      ctx.fillStyle = '#233e37'; ctx.fillText(`CORTE ${i + 1}`, 14 * scale, line[0].y - 6 * scale);
    });
    if (panels) panels.forEach((p, i) => {
      ctx.strokeStyle = '#233e37'; ctx.fillStyle = '#dfff73'; ctx.setLineDash([7 * scale, 4 * scale]); ctx.strokeRect(p.x, p.y, p.width, p.height); ctx.setLineDash([]);
      for (const x of [p.x, p.x + p.width]) for (const y of [p.y, p.y + p.height]) ctx.fillRect(x - 4 * scale, y - 4 * scale, 8 * scale, 8 * scale);
      ctx.fillRect(p.x + 7 * scale, p.y + 7 * scale, 78 * scale, 20 * scale); ctx.fillStyle = '#233e37'; ctx.fillText(`QUADRO ${i + 1}`, p.x + 12 * scale, p.y + 21 * scale);
    });
    if (gesture?.kind === 'shape' || gesture?.kind === 'panelshape') {
      const { start, end } = gesture; ctx.strokeStyle = '#d33769'; ctx.lineWidth = 2 * scale; ctx.setLineDash([5 * scale, 3 * scale]);
      ctx.beginPath();
      if (tool === 'ellipse') ctx.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(start.x - end.x) / 2, Math.abs(start.y - end.y) / 2, 0, 0, Math.PI * 2);
      else ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function selectTool(value) {
    tool = value;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    if (preview) setPreview(false);
    const tips = { cut: panels ? 'Arraste as bordas dos quadros para ajustar o recorte. Clique direito dentro de um quadro para removê-lo.' : 'Clique para dividir. Arraste uma linha ou um ponto para ajustar.', panel: 'Arraste um retângulo ao redor de cada quadro. A ordem é da esquerda para a direita, de cima para baixo.', point: 'Arraste uma bolinha existente para movê-la. Clique em um trecho livre da divisão para criar um ponto.', picker: 'Clique em uma parte limpa do balão para copiar a cor.', bubble: 'Clique no fundo claro do balão, perto do texto. Essa limpeza pode ser desfeita.', rectangle: 'Arraste sobre o texto. Mantenha a seleção dentro do balão.', ellipse: 'Arraste sobre o texto para cobri-lo com uma elipse.', brush: 'Pinte sobre o texto com a cor escolhida.' };
    status(tips[tool]);
  }
  function setPreview(value) {
    preview = value;
    $('editTab').classList.toggle('selected', !value); $('previewTab').classList.toggle('selected', value);
    $('editTab').setAttribute('aria-pressed', String(!value)); $('previewTab').setAttribute('aria-pressed', String(value));
    render();
  }
  function installImage(img, name) {
    activeCleanup = null;
    const width = img.naturalWidth || img.width, height = img.naturalHeight || img.height;
    if (width * height > 24000000 || width > 16000 || height > 16000) throw new Error('Use uma imagem de até 24 megapixels e 16.000 px por lado.');
    source.width = work.width = width; source.height = work.height = height;
    source.getContext('2d').drawImage(img, 0, 0); wctx.drawImage(source, 0, 0);
    cuts = []; panels = null; history = []; gesture = null; loaded = true; fileName = name.replace(/\.[^.]+$/, '');
    $('empty').hidden = true; canvas.hidden = false; $('editing').disabled = false; $('export').disabled = false; $('undo').disabled = true;
    $('fileInfo').textContent = `${name} · ${width} × ${height} px`;
    const entry = queue[activeIndex];
    const report = entry?.report || engine.detect(work, number('count', 0, 12));
    cuts = entry?.lines || report.lines;
    panels = entry?.panels || report.panels || null;
    if (entry) { entry.report = report; entry.lines = cloneCuts(); entry.panels = clonePanels(); }
    paintDirty = false;
    setPreview(true);
    if (!report.confident) status(`Revisão necessária: ${report.warnings.join(' ')}`);
  }
  function position(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: clamp(Math.round((event.clientX - rect.left) * work.width / rect.width), 0, work.width), y: clamp(Math.round((event.clientY - rect.top) * work.height / rect.height), 0, work.height) };
  }
  function nearest(point) {
    let result = null, distance = Infinity;
    cuts.forEach((line, index) => { const d = Math.abs(yAt(line, point.x) - point.y); if (d < distance) { distance = d; result = index; } });
    return { index: result, distance };
  }
  function paint(a, b) {
    wctx.strokeStyle = wctx.fillStyle = $('color').value; wctx.lineWidth = number('size', 2, 300); wctx.lineCap = 'round';
    wctx.beginPath(); wctx.moveTo(a.x, a.y); wctx.lineTo(b.x, b.y); wctx.stroke();
    wctx.beginPath(); wctx.arc(b.x, b.y, wctx.lineWidth / 2, 0, 2 * Math.PI); wctx.fill();
  }
  function sampleBorder(x, y, width, height) {
    const pixels = wctx.getImageData(x, y, width, height).data, colors = new Map();
    const add = (px, py) => { const k = (py * width + px) * 4; if (pixels[k + 3] < 200) return; const rgb = [pixels[k], pixels[k + 1], pixels[k + 2]]; const key = rgb.map(v => v >> 3).join(','); const group = colors.get(key) || { count: 0, rgb: [0, 0, 0] }; group.count++; rgb.forEach((v, i) => group.rgb[i] += v); colors.set(key, group); };
    for (let xx = 0; xx < width; xx++) { add(xx, 0); add(xx, height - 1); }
    for (let yy = 1; yy < height - 1; yy++) { add(0, yy); add(width - 1, yy); }
    const group = [...colors.values()].sort((a, b) => b.count - a.count)[0];
    return group ? '#' + group.rgb.map(v => Math.round(v / group.count).toString(16).padStart(2, '0')).join('') : $('color').value;
  }
  canvas.addEventListener('pointerdown', event => {
    if (!loaded || preview || batchBusy || event.button !== 0) return;
    event.preventDefault(); const p = position(event); canvas.setPointerCapture(event.pointerId);
    if (tool === 'panel') { gesture = { kind: 'panelshape', start: p, end: p }; render(); return; }
    if (panels && ['cut', 'point'].includes(tool)) {
      if (tool === 'point') { status('Este layout usa quadros retangulares. Selecione Ajustar divisões e arraste as bordas dos quadros.'); return; }
      const tolerance = 14 * work.width / canvas.getBoundingClientRect().width;
      const index = panels.findIndex(r => p.x >= r.x - tolerance && p.x <= r.x + r.width + tolerance && p.y >= r.y - tolerance && p.y <= r.y + r.height + tolerance && (Math.min(Math.abs(p.x - r.x), Math.abs(p.x - r.x - r.width)) < tolerance || Math.min(Math.abs(p.y - r.y), Math.abs(p.y - r.y - r.height)) < tolerance));
      if (index < 0) { status('Arraste uma borda do quadro ou use Selecionar quadro para acrescentar um recorte.'); return; }
      const r = panels[index]; remember();
      gesture = { kind: 'panelresize', index, original: { ...r }, left: Math.abs(p.x - r.x) < tolerance, right: Math.abs(p.x - r.x - r.width) < tolerance, top: Math.abs(p.y - r.y) < tolerance, bottom: Math.abs(p.y - r.y - r.height) < tolerance };
      return;
    }
    if (tool === 'bubble') {
      const result = cleaner.clean(work, { point: p });
      if (!result.balloons) { status('Não encontrei letras isoladas nesse ponto. Clique em uma parte clara do fundo do balão, perto do texto, ou use uma seleção.'); return; }
      remember(true); wctx.clearRect(0, 0, work.width, work.height); wctx.drawImage(result.canvas, 0, 0); render();
      status('Balão limpo. Confira o resultado; Desfazer restaura o texto.'); return;
    }
    if (tool === 'picker') {
      const data = wctx.getImageData(Math.min(work.width - 1, Math.floor(p.x)), Math.min(work.height - 1, Math.floor(p.y)), 1, 1).data;
      $('color').value = '#' + [...data].slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join(''); $('autoColor').checked = false;
      status('Cor captada. Escolha uma forma ou o pincel para cobrir o texto.'); return;
    }
    if (tool === 'cut' || tool === 'point') {
      const hit = nearest(p), tolerance = 16 * work.width / canvas.getBoundingClientRect().width;
      // Existing handles take precedence over both point insertion and Shift.
      // Select the closest one, rather than the first in a dense contour.
      const pointTolerance = (event.pointerType === 'touch' ? 14 : 9) * work.width / canvas.getBoundingClientRect().width;
      let handle = null;
      cuts.forEach((line, index) => line.forEach(point => {
        const distance = Math.hypot(point.x - p.x, point.y - p.y);
        if (distance <= pointTolerance && (!handle || distance < handle.distance)) handle = { point, index, distance };
      }));
      if (handle) {
        remember();
        gesture = { kind: 'point', index: handle.index, point: handle.point, start: p, origin: { ...handle.point } };
        status('Arraste para mover este ponto. Desfazer restaura a posição anterior.');
        return;
      }
      if (event.shiftKey || tool === 'point') {
        if (hit.index === null || hit.distance > tolerance * 3) { status('Clique mais perto de uma linha de divisão existente.'); return; }
        const line = cuts[hit.index];
        if (line.some(v => Math.abs(v.x - p.x) < 2)) { status('Arraste o ponto existente para ajustar o contorno.'); return; }
        remember(); const point = { x: p.x, y: yAt(line, p.x) }; line.push(point); line.sort((a, b) => a.x - b.x);
        gesture = { kind: 'point', index: hit.index, point, start: p, origin: { ...point } }; render(); return;
      }
      if (hit.index !== null && hit.distance < tolerance) {
        remember();
        gesture = { kind: 'line', index: hit.index, start: p, original: cloneCuts() };
      } else {
        if (cuts.length >= 24) { status('Limite de 25 quadros por imagem.'); return; }
        remember(); cuts.push([{ x: 0, y: p.y }, { x: work.width, y: p.y }]); cuts.sort((a, b) => a[0].y - b[0].y);
        if (!validCuts()) { const previous = history.pop(); cuts = previous.cuts; if (queue[activeIndex]) queue[activeIndex].approved = previous.approved; $('undo').disabled = !history.length; status('As divisões não podem se cruzar. Escolha outra posição.'); }
        render();
      }
      return;
    }
    if (tool === 'brush') { remember(true); gesture = { kind: 'brush', last: p }; paint(p, p); render(); return; }
    gesture = { kind: 'shape', start: p, end: p }; render();
  });
  canvas.addEventListener('pointermove', event => {
    if (!gesture) return; const p = position(event);
    if (gesture.kind === 'shape' || gesture.kind === 'panelshape') gesture.end = p;
    if (gesture.kind === 'panelresize') {
      const r = gesture.original;
      const left = gesture.left ? clamp(p.x, 0, r.x + r.width - 10) : r.x;
      const right = gesture.right ? clamp(p.x, left + 10, work.width) : r.x + r.width;
      const top = gesture.top ? clamp(p.y, 0, r.y + r.height - 10) : r.y;
      const bottom = gesture.bottom ? clamp(p.y, top + 10, work.height) : r.y + r.height;
      panels[gesture.index] = { x: left, y: top, width: right - left, height: bottom - top };
    }
    if (gesture.kind === 'brush') { paint(gesture.last, p); gesture.last = p; }
    if (gesture.kind === 'point') {
      const line = cuts[gesture.index], index = line.indexOf(gesture.point), previous = { ...gesture.point };
      if (index > 0 && index < line.length - 1) {
        const left = line[index - 1].x, right = line[index + 1].x, margin = Math.min(1, (right - left) / 4);
        gesture.point.x = clamp(gesture.origin.x + p.x - gesture.start.x, left + margin, right - margin);
      }
      gesture.point.y = allowedY(gesture.index, gesture.point.x, gesture.origin.y + p.y - gesture.start.y);
      if (!validCuts()) Object.assign(gesture.point, previous);
    }
    if (gesture.kind === 'line') {
      const prev = cuts[gesture.index];
      cuts[gesture.index] = gesture.original[gesture.index].map(v => ({ x: v.x, y: allowedY(gesture.index, v.x, v.y + p.y - gesture.start.y) }));
      if (!validCuts()) cuts[gesture.index] = prev;
    }
    render();
  });
  function finishGesture(event) {
    if (!gesture) return;
    if (gesture.kind === 'panelshape' && event.type !== 'pointercancel') {
      const a = gesture.start, b = gesture.end, width = Math.abs(a.x - b.x), height = Math.abs(a.y - b.y);
      if (width > 10 && height > 10) {
        remember();
        if (!panels) { panels = []; cuts = []; }
        panels.push({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width, height });
        panels.sort((a, b) => Math.abs(a.y - b.y) < Math.min(a.height, b.height) * 0.35 ? a.x - b.x : a.y - b.y);
      }
    }
    if (gesture.kind === 'shape' && event.type !== 'pointercancel') {
      const a = gesture.start, b = gesture.end;
      const x = Math.floor(Math.min(a.x, b.x)), y = Math.floor(Math.min(a.y, b.y));
      const width = Math.min(work.width - x, Math.ceil(Math.abs(a.x - b.x))), height = Math.min(work.height - y, Math.ceil(Math.abs(a.y - b.y)));
      if (width > 2 && height > 2) {
        remember(true); const color = $('autoColor').checked ? sampleBorder(x, y, width, height) : $('color').value;
        wctx.fillStyle = color;
        if (tool === 'ellipse') { wctx.beginPath(); wctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI); wctx.fill(); }
        else wctx.fillRect(x, y, width, height);
        status('Texto coberto. Use Desfazer se precisar ajustar a seleção ou a cor.');
      }
    }
    gesture = null; render();
  }
  canvas.addEventListener('pointerup', finishGesture); canvas.addEventListener('pointercancel', finishGesture);
  canvas.addEventListener('contextmenu', event => {
    event.preventDefault(); if (!loaded || preview || batchBusy || !['cut', 'point', 'panel'].includes(tool)) return;
    if (panels) {
      const p = position(event), index = panels.findIndex(r => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height);
      if (index >= 0) { remember(); panels.splice(index, 1); render(); status('Quadro removido.'); } return;
    }
    const hit = nearest(position(event)); if (hit.index !== null && hit.distance < 24 * work.width / canvas.getBoundingClientRect().width) { remember(); cuts.splice(hit.index, 1); render(); status('Divisão removida.'); }
  });
  $('undo').addEventListener('click', () => {
    const state = history.pop(); if (!state) return;
    activeCleanup = null; revision++; cuts = state.cuts; panels = state.panels; if (state.pixels) { wctx.putImageData(state.pixels, 0, 0); paintDirty = true; } gesture = null;
    if (queue[activeIndex]) queue[activeIndex].approved = state.approved;
    $('undo').disabled = !history.length; render(); status('Última alteração desfeita.');
  });
  $('reset').addEventListener('click', () => {
    if (!confirm('Restaurar a imagem original e remover todos os cortes e preenchimentos?')) return;
    remember(true); cuts = []; panels = null; wctx.clearRect(0, 0, work.width, work.height); wctx.drawImage(source, 0, 0); render(); status('Imagem original restaurada. Você pode desfazer esta ação.');
  });
  $('export').addEventListener('click', async () => {
    if (!loaded || busy || batchBusy) return;
    if (queue[activeIndex]?.report && ((!queue[activeIndex].report.confident && !queue[activeIndex].approved) || (number('count', 0, 12) && panelCount() !== number('count', 0, 12)))) { setPreview(false); status('Confira e ajuste os cortes em Ajustes manuais antes de baixar esta imagem.'); document.querySelector('.advanced').open = true; return; }
    busy = true; $('export').disabled = true;
    try {
      const output = document.createElement('canvas'); const info = compose(output);
      const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('O navegador não conseguiu gerar o PNG. Reduza a largura de saída.');
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `${fileName}-preparada.png`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      status(`PNG preparado: ${info.width} × ${info.height} px. Confira os downloads do navegador.`);
    } catch (error) { status(error.message); }
    finally { busy = false; $('export').disabled = false; }
  });
  function updateQueue() {
    $('queue').replaceChildren();
    queue.forEach((entry, index) => {
      const button = document.createElement('button'); button.className = 'queue-item' + (index === activeIndex ? ' current' : '');
      const name = document.createElement('span'), badge = document.createElement('small'); name.textContent = entry.file.name; badge.textContent = (entry.state || 'Na fila') + (entry.cleaning ? ` · ${entry.cleaning.balloons} balões${entry.cleaning.reviewCount ? ' · revisar texto' : ''}` : '');
      button.append(name, badge); button.title = entry.error || entry.report?.warnings.join(' ') || entry.cleaning?.warnings?.join(' ') || (entry.cleaning && !entry.cleaning.balloons ? 'Nenhum balão identificado. Confira se a imagem tem texto para limpar.' : entry.file.name); button.disabled = batchBusy;
      button.addEventListener('click', () => selectEntry(index)); $('queue').append(button);
    });
    $('downloadZip').disabled = batchBusy || !queue.some(e => e.blob);
    $('processAll').disabled = batchBusy || !queue.length;
    $('openFiles').disabled = batchBusy; $('demo').disabled = batchBusy; $('editing').disabled = !loaded || batchBusy;
    $('export').disabled = !loaded || batchBusy;
    for (const id of ['width', 'count', 'fitHeight', 'height', 'gap', 'emptyBalloons']) $(id).disabled = batchBusy || (id === 'height' && !$('fitHeight').checked) || (id === 'gap' && $('fitHeight').checked);
    $('cancelBatch').hidden = !batchBusy;
    const done = queue.filter(e => e.blob).length, review = queue.filter(e => e.state === 'Revisar' || e.state === 'Erro').length;
    $('batchInfo').textContent = queue.length ? `${done}/${queue.length} prontas${review ? ` · ${review} para revisar` : ''}${batchBusy ? ' · processando…' : ''}` : 'Nenhuma imagem carregada.';
  }
  const toBlob = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar o PNG.')), 'image/png'));
  async function decode(file) {
    const url = URL.createObjectURL(file);
    try { const image = new Image(); image.src = url; await image.decode(); return image; }
    finally { URL.revokeObjectURL(url); }
  }
  async function selectEntry(index) {
    if (batchBusy || busy || index === activeIndex) return;
    busy = true;
    try {
      if (paintDirty && queue[activeIndex]) queue[activeIndex].editBlob = await toBlob(work);
      const entry = queue[index], image = await decode(entry.editBlob || entry.file);
      activeIndex = index; installImage(image, entry.file.name);
      if (entry.editBlob) { const original = await decode(entry.file); source.getContext('2d').clearRect(0, 0, source.width, source.height); source.getContext('2d').drawImage(original, 0, 0); }
      updateQueue();
    } catch (error) { status(error.message); }
    finally { busy = false; }
  }
  function stamp() { return JSON.stringify([options(), number('count', 0, 12), $('emptyBalloons').checked, revision]); }
  async function processAll() {
    if (batchBusy || !queue.length) return;
    batchBusy = true; stopBatch = false; updateQueue();
    const settings = options(), started = performance.now(); let bytes = 0;
    queue.forEach(entry => { entry.blob = null; entry.cleaning = null; entry.state = 'Na fila'; });
    try {
      for (let index = 0; index < queue.length; index++) {
        if (stopBatch) break;
        const entry = queue[index]; entry.state = 'Processando'; entry.blob = null; updateQueue();
        // Yield between images so progress and the stop button remain responsive.
        await new Promise(resolve => setTimeout(resolve, 20));
        try {
          let imageCanvas;
          if (index === activeIndex) imageCanvas = work;
          else {
            const image = await decode(entry.editBlob || entry.file);
            const w = image.naturalWidth, h = image.naturalHeight;
            if (w * h > 24000000 || w > 16000 || h > 16000) throw new Error('Imagem acima do limite de 24 megapixels ou 16.000 px por lado.');
            imageCanvas = document.createElement('canvas'); imageCanvas.width = w; imageCanvas.height = h; imageCanvas.getContext('2d').drawImage(image, 0, 0);
          }
          if (!entry.report) { entry.report = engine.detect(imageCanvas, number('count', 0, 12)); entry.lines = entry.report.lines; entry.panels = entry.report.panels || null; }
          const lines = index === activeIndex ? geometry() : entry.panels ? { panels: entry.panels } : entry.lines;
          const actualCount = Array.isArray(lines) ? lines.length + 1 : lines.panels.length;
          if ((!entry.report.confident && !entry.approved) || (number('count', 0, 12) && actualCount !== number('count', 0, 12))) { entry.state = 'Revisar'; continue; }
          const cleanup = $('emptyBalloons').checked ? (index === activeIndex ? cleanCurrent() : cleaner.clean(imageCanvas)) : null;
          if (cleanup) entry.cleaning = { balloons: cleanup.balloons, changed: cleanup.changed, reviewCount: cleanup.reviewCount, warnings: cleanup.warnings };
          const output = document.createElement('canvas'); entry.info = engine.compose(cleanup?.canvas || imageCanvas, lines, settings, output);
          entry.blob = await toBlob(output); bytes += entry.blob.size;
          if (bytes > 300 * 1024 * 1024) { entry.blob = null; stopBatch = true; throw new Error('O lote ultrapassou 300 MB. Divida as imagens em lotes menores.'); }
          entry.state = 'Pronta'; entry.error = '';
        } catch (error) { entry.state = 'Erro'; entry.error = error.message; }
        updateQueue();
      }
      batchStamp = stamp();
      const done = queue.filter(e => e.blob).length;
      const cleaned = queue.reduce((n, e) => n + (e.cleaning?.balloons || 0), 0), unmatched = queue.filter(e => e.blob && e.cleaning?.balloons === 0).length;
      const preserved = queue.reduce((n, e) => n + (e.cleaning?.reviewCount || 0), 0);
      status(`${done}/${queue.length} imagens prontas em ${((performance.now() - started) / 1000).toFixed(1)} s.${$('emptyBalloons').checked ? ` ${cleaned} balões esvaziados.${preserved ? ` ${preserved} falas preservadas para revisão.` : ''}${unmatched ? ` ${unmatched} imagens sem balões identificados: confira os textos.` : ''}` : ''}${done < queue.length ? ' Abra os itens sinalizados para conferir os cortes ou o erro.' : ' Confira os resultados e baixe o ZIP.'}`);
    } finally { batchBusy = false; updateQueue(); }
  }
  async function enqueueFiles(files) {
    if (batchBusy || busy) return;
    const valid = [...files].filter(file => /^image\/(png|jpeg|webp)$/.test(file.type));
    if (!valid.length) { status('Escolha imagens PNG, JPG ou WebP.'); return; }
    if (valid.length > 250) { status('Selecione até 250 imagens por lote.'); return; }
    queue = valid.map(file => ({ file, state: 'Na fila' })); activeIndex = -1; revision = 0; batchStamp = ''; paintDirty = false;
    await selectEntry(0); await processAll(); $('file').value = '';
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  $('downloadZip').addEventListener('click', async () => {
    if (batchBusy) return;
    if (stamp() !== batchStamp) await processAll();
    const ready = queue.filter(e => e.blob); if (!ready.length) return;
    batchBusy = true; updateQueue(); status('Montando ZIP…');
    try {
      const entries = ready.map((entry, index) => ({ name: `${String(index + 1).padStart(3, '0')}-${entry.file.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_')}-preparada.png`, blob: entry.blob }));
      const skipped = queue.filter(e => !e.blob);
      if (skipped.length) entries.push({ name: 'REVISAR.txt', blob: new Blob([skipped.map(e => `${e.file.name}: ${e.error || e.report?.warnings.join(' ') || 'Processamento interrompido'}`).join('\n')], { type: 'text/plain;charset=utf-8' }) });
      const cleanupReview = ready.filter(e => e.cleaning?.reviewCount);
      if (cleanupReview.length) entries.push({ name: 'CONFERIR-LIMPEZA.txt', blob: new Blob([cleanupReview.map(e => `${e.file.name}: ${e.cleaning.warnings.join(' ')}`).join('\n')], { type: 'text/plain;charset=utf-8' }) });
      download(await engine.zip(entries), 'entrequadros-lote.zip'); status(`ZIP com ${ready.length} imagens.${skipped.length ? ` ${skipped.length} pendências listadas em REVISAR.txt.` : ''}`);
    } catch (error) { status(error.message); }
    finally { batchBusy = false; updateQueue(); }
  });
  $('openFiles').addEventListener('click', () => $('file').click());
  $('processAll').addEventListener('click', processAll);
  $('cancelBatch').addEventListener('click', () => { stopBatch = true; status('O processamento vai parar após a imagem atual.'); });
  $('detect').addEventListener('click', () => {
    if (!loaded || batchBusy) return;
    remember(); const report = engine.detect(work, number('count', 0, 12)); cuts = report.lines; panels = report.panels || null;
    if (queue[activeIndex]) { queue[activeIndex].report = report; queue[activeIndex].approved = false; }
    render(); status(report.confident ? 'Divisões detectadas. Confira o resultado automático.' : report.warnings.join(' '));
  });
  $('file').addEventListener('change', event => enqueueFiles(event.target.files));
  for (const type of ['dragenter', 'dragover']) $('stage').addEventListener(type, event => { event.preventDefault(); $('stage').classList.add('dragover'); });
  $('stage').addEventListener('dragleave', () => $('stage').classList.remove('dragover'));
  $('stage').addEventListener('drop', event => { event.preventDefault(); $('stage').classList.remove('dragover'); enqueueFiles(event.dataTransfer.files); });
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => selectTool(b.dataset.tool)));
  $('editTab').addEventListener('click', () => setPreview(false)); $('previewTab').addEventListener('click', () => setPreview(true));
  for (const id of ['gap', 'width', 'height', 'count', 'fitHeight', 'emptyBalloons']) $(id).addEventListener('change', () => {
    if (id === 'count') {
      $('count').value = number('count', 0, 12);
      queue.forEach(entry => { entry.report = null; entry.lines = null; entry.panels = null; entry.blob = null; entry.approved = false; });
      if (loaded) { const report = engine.detect(work, number('count', 0, 12)); cuts = report.lines; panels = report.panels || null; if (queue[activeIndex]) queue[activeIndex].report = report; }
    }
    updateQueue(); render();
    status('Padrão atualizado. Use Reprocessar lote ou Baixar lote para aplicar a todas as imagens.');
  });
  $('color').addEventListener('input', () => { $('autoColor').checked = false; });
  document.addEventListener('keydown', event => {
    if (/INPUT|TEXTAREA/.test(event.target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); $('undo').click(); }
  });
  window.addEventListener('resize', () => { if (!gesture) render(); });
  $('demo').addEventListener('click', () => {
    if (busy || batchBusy) return;
    const sample = document.createElement('canvas'); sample.width = 800; sample.height = 1100;
    const c = sample.getContext('2d');
    const colors = ['#d4e9e7', '#f1d7df', '#f3e9b5'];
    for (let i = 0; i < 3; i++) {
      const y = i * 366; c.fillStyle = colors[i]; c.fillRect(0, y, 800, 366);
      c.strokeStyle = '#233e37'; c.lineWidth = 6; c.strokeRect(3, y + 3, 794, 360);
      c.fillStyle = '#587b63'; c.beginPath(); c.arc(160 + i * 110, y + 245, 77, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fffef9'; c.beginPath(); c.ellipse(480, y + 126, 240, 85, 0, 0, Math.PI * 2); c.fill(); c.lineWidth = 3; c.stroke();
      c.fillStyle = '#233e37'; c.font = '25px Georgia'; c.textAlign = 'center'; c.fillText(['Every story needs…', '…a little room…', '…to breathe.'][i], 480, y + 135);
      c.fillStyle = '#dfff73'; c.beginPath(); c.arc(140 + i * 110, y + 225, 10, 0, 7); c.arc(180 + i * 110, y + 225, 10, 0, 7); c.fill();
    }
    toBlob(sample).then(blob => enqueueFiles([new File([blob], 'exemplo.png', { type: 'image/png' })]));
  });
})();
