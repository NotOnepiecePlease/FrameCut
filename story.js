'use strict';
// Independent images are already panels: preserve their full bounds and order.
window.createFrameCutStory = ({ options, status, decode, toBlob, download, restorePages, pagesBusy }) => {
  const $ = id => document.getElementById(id);
  let active = false, running = false, entries = [], output = null, dragging = null;
  const settingsIds = ['width', 'height', 'gap', 'fitHeight', 'emptyBalloons'];
  const saveSettings = () => settingsIds.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value]);
  const loadSettings = values => values.forEach(([id, value]) => { if ($(id).type === 'checkbox') $(id).checked = value; else $(id).value = value; });
  let pageSettings, storySettings = [['width', '608'], ['height', '1600'], ['gap', '100'], ['fitHeight', false], ['emptyBalloons', true]];
  const labels = {
    modeHelp: 'Cada página vira um PNG com os quadros recortados e espaçados.',
    layoutHelp: $('layoutHelp').textContent, processHelp: $('processHelp').textContent,
    queueTitle: 'Fila de imagens', processAll: '↻ Reprocessar lote',
    export: 'Baixar este PNG ↓'
  };
  const storyLabels = {
    modeHelp: 'Adicione um quadro por imagem. Juntos, eles viram uma única história vertical.',
    layoutHelp: 'Cada imagem fica inteira, sem detectar cortes. Os quadros usam a largura escolhida, mantendo suas proporções.',
    processHelp: 'Cole mais quadros com Ctrl + V. Arraste as miniaturas ou use as setas para mudar a ordem.',
    queueTitle: 'Ordem dos quadros', processAll: '▤ Montar história', export: 'Baixar história em PNG ↓'
  };
  function show() {
    if (!active) return;
    $('empty').hidden = Boolean(output); $('canvas').hidden = !output;
    $('panelCount').textContent = `${entries.length} quadro${entries.length === 1 ? '' : 's'} · uma história`;
    if (output) {
      const ratio = Math.min(1, 1400 / output.width, 15000 / output.height), canvas = $('canvas');
      canvas.width = Math.max(1, Math.round(output.width * ratio)); canvas.height = Math.max(1, Math.round(output.height * ratio));
      canvas.getContext('2d').drawImage(output, 0, 0, canvas.width, canvas.height);
    }
  }
  function invalidate() { output = null; show(); }
  function update() {
    if (!active) return;
    $('queue').replaceChildren();
    entries.forEach((entry, index) => {
      const row = document.createElement('div'); row.className = 'story-item'; row.draggable = !running;
      row.dataset.index = index;
      const thumb = document.createElement('img'); thumb.src = entry.thumbnail; thumb.alt = ''; thumb.draggable = false;
      const name = document.createElement('span'); name.textContent = `${index + 1}. ${entry.file.name}`; name.title = entry.file.name;
      const actions = document.createElement('div'); actions.className = 'story-actions';
      for (const [symbol, label, disabled, action] of [
        ['↑', 'Mover para cima', index === 0, () => move(index, index - 1)],
        ['↓', 'Mover para baixo', index === entries.length - 1, () => move(index, index + 1)],
        ['×', 'Remover quadro', false, async () => { entries.splice(index, 1); invalidate(); await build(); }]
      ]) {
        const button = document.createElement('button'); button.textContent = symbol; button.type = 'button';
        button.title = `${label} ${index + 1}`; button.setAttribute('aria-label', button.title); button.disabled = running || disabled;
        button.addEventListener('click', action); actions.append(button);
      }
      row.append(thumb, name, actions);
      row.addEventListener('dragstart', event => { dragging = entry; event.dataTransfer.setData('text/plain', String(index)); event.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragover', event => { if (dragging && !running) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } });
      row.addEventListener('drop', event => { if (!dragging || running) return; event.preventDefault(); const from = entries.indexOf(dragging); dragging = null; if (from >= 0) move(from, index); });
      row.addEventListener('dragend', () => { dragging = null; });
      $('queue').append(row);
    });
    $('queue').classList.add('story-queue');
    $('batchInfo').textContent = `${entries.length}/250 quadros${running ? ' · montando…' : ' · arraste para ordenar'}`;
    $('processAll').disabled = running || !entries.length;
    $('export').disabled = running || !entries.length;
    $('openFiles').disabled = running; $('clearStory').disabled = running || !entries.length;
    $('pagesMode').disabled = running; $('storyMode').disabled = running;
    $('editing').disabled = true; $('undo').disabled = true;
    for (const id of settingsIds) $(id).disabled = running || (id === 'height' && !$('fitHeight').checked) || (id === 'gap' && $('fitHeight').checked);
    show();
  }
  async function move(from, to) {
    if (running || from === to) return;
    const [entry] = entries.splice(from, 1); entries.splice(to, 0, entry);
    invalidate(); await build();
  }
  async function add(files) {
    if (running) return;
    const valid = [...files].filter(file => /^image\/(png|jpeg|webp)$/.test(file.type));
    if (!valid.length) { status('Copie uma imagem ou escolha arquivos PNG, JPG ou WebP.'); return; }
    if (entries.length + valid.length > 250) { status('Use até 250 quadros por história.'); return; }
    running = true; update();
    const errors = [];
    try {
      for (const file of valid) {
        try {
          const image = await decode(file), width = image.naturalWidth, height = image.naturalHeight;
          if (width * height > 24000000 || width > 16000 || height > 16000) throw new Error('limite de 24 megapixels e 16.000 px por lado');
          const thumbnail = document.createElement('canvas'), ratio = Math.min(64 / width, 128 / height);
          thumbnail.width = Math.max(1, Math.round(width * ratio)); thumbnail.height = Math.max(1, Math.round(height * ratio));
          thumbnail.getContext('2d').drawImage(image, 0, 0, thumbnail.width, thumbnail.height);
          entries.push({ file, width, height, thumbnail: thumbnail.toDataURL('image/png') });
        } catch (error) { errors.push(`${file.name}: ${error.message}`); }
      }
      invalidate();
    } finally { running = false; update(); }
    await build();
    if (errors.length) status(`Algumas imagens não entraram: ${errors.join('; ')}.`);
  }
  async function build() {
    if (running || !active) return false;
    invalidate();
    if (!entries.length) { update(); status('Cole os quadros com Ctrl + V ou escolha imagens para começar.'); return false; }
    running = true; update();
    let result;
    try {
      const settings = options(), heights = entries.map(entry => Math.max(1, Math.round(entry.height * settings.width / entry.width)));
      const base = heights.reduce((sum, height) => sum + height, 0), spaces = entries.length - 1;
      const gap = settings.targetHeight ? (settings.targetHeight - base) / Math.max(1, spaces) : settings.gap;
      if (gap < 0) throw new Error('A altura final é pequena para esta história. Aumente a altura, diminua a largura ou desmarque o ajuste por altura.');
      const height = settings.targetHeight || base + gap * spaces;
      if (height > 32000 || settings.width * height > 60000000) throw new Error('A história ficou grande demais. Reduza a largura ou os espaços (limite: 60 megapixels e 32.000 px de altura).');
      result = document.createElement('canvas'); result.width = settings.width; result.height = height;
      const context = result.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, result.width, result.height);
      let y = 0, balloons = 0, review = 0, unmatched = 0;
      for (let i = 0; i < entries.length; i++) {
        status(`Montando quadro ${i + 1} de ${entries.length}…`);
        await new Promise(resolve => setTimeout(resolve, 20));
        const entry = entries[i], clean = $('emptyBalloons').checked;
        const image = await decode(clean && entry.cleaned ? entry.cleaned : entry.file);
        let panel = image;
        if (clean && !entry.cleaned) {
          const raw = document.createElement('canvas'); raw.width = entry.width; raw.height = entry.height; raw.getContext('2d').drawImage(image, 0, 0);
          const cleanup = window.BalloonCleaner.clean(raw, { closedBalloonsOnly: true });
          entry.cleaned = await toBlob(cleanup.canvas); entry.balloons = cleanup.balloons; entry.review = cleanup.reviewCount || 0;
          // Bound optional cleanup caches; evicted frames can be cleaned again.
          let cacheBytes = entries.reduce((sum, item) => sum + (item.cleaned?.size || 0), 0);
          for (const cached of entries) {
            if (cacheBytes <= 100 * 1024 * 1024) break;
            if (cached.cleaned) { cacheBytes -= cached.cleaned.size; cached.cleaned = null; }
          }
          panel = cleanup.canvas;
          context.drawImage(panel, 0, Math.round(y), result.width, heights[i]);
          raw.width = raw.height = cleanup.canvas.width = cleanup.canvas.height = 1;
        } else context.drawImage(panel, 0, Math.round(y), result.width, heights[i]);
        if (clean) { balloons += entry.balloons; review += entry.review; if (!entry.balloons) unmatched++; }
        y += heights[i] + gap;
      }
      output = result;
      $('cleanupInfo').textContent = $('emptyBalloons').checked ? `${balloons} balões esvaziados.${review ? ` ${review} falas preservadas para revisão.` : ''}${unmatched ? ` ${unmatched} quadros sem balões identificados.` : ''} Na história, limpa balões brancos fechados. Confira os textos antes de baixar.` : 'Limpeza desligada. Os textos originais foram mantidos.';
      status(`História pronta: ${entries.length} quadros · ${output.width} × ${output.height} px. Confira a ordem e baixe o PNG.`);
      return true;
    } catch (error) { if (result) result.width = result.height = 1; status(error.message); return false; }
    finally { running = false; update(); }
  }
  async function exportStory() {
    if (running || (!output && !await build())) return;
    running = true; update();
    try { download(await toBlob(output), 'historia-preparada.png'); status(`PNG da história preparado: ${output.width} × ${output.height} px.`); }
    catch (error) { status(error.message); }
    finally { running = false; update(); }
  }
  async function switchMode(value) {
    if (running || pagesBusy() || active === value) return;
    if (value) { pageSettings = saveSettings(); loadSettings(storySettings); }
    else { storySettings = saveSettings(); loadSettings(pageSettings); }
    active = value;
    $('pagesMode').classList.toggle('selected', !active); $('pagesMode').setAttribute('aria-pressed', String(!active));
    $('storyMode').classList.toggle('selected', active); $('storyMode').setAttribute('aria-pressed', String(active));
    for (const [id, label] of Object.entries(active ? storyLabels : labels)) $(id).textContent = label;
    $('count').closest('label').hidden = active; $('downloadZip').hidden = active; $('clearStory').hidden = !active;
    $('demo').hidden = active; $('editTab').hidden = active; document.querySelector('.advanced').hidden = active;
    $('queue').classList.toggle('story-queue', active);
    $('fileInfo').textContent = active ? 'Adicione imagens na ordem da história. Cada nova colagem acrescenta um quadro.' : 'Escolha páginas ou cole imagens com Ctrl + V.';
    $('empty').querySelector('h2').textContent = active ? 'Um quadro de cada vez. Uma história inteira.' : 'Selecione. Confira. Baixe.';
    $('empty').querySelector('p').textContent = active ? 'Cole com Ctrl + V ou arraste as imagens. Organize os quadros na lista e monte sua história.' : 'Uma imagem ou o trabalho do dia inteiro. Quadros em faixas ou lado a lado, na ordem de leitura.';
    if (active) {
      $('previewTab').classList.add('selected'); $('previewTab').setAttribute('aria-pressed', 'true');
      update(); await build();
    } else restorePages();
  }
  $('pagesMode').addEventListener('click', () => switchMode(false));
  $('storyMode').addEventListener('click', () => switchMode(true));
  $('clearStory').addEventListener('click', () => { if (running) return; entries = []; invalidate(); update(); status('Nova história. Cole ou adicione os quadros.'); });
  return { get active() { return active; }, get busy() { return running; }, add, build, show, update, invalidate, export: exportStory };
};
