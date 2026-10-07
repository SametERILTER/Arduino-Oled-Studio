const PRESET_ICONS = {};

function rasterizeSvgToBitmap(svgEl, targetSize = 16) {
  return new Promise((resolve) => {
    if (!svgEl) {
      resolve(null);
      return;
    }

    const svgClone = svgEl.cloneNode(true);
    svgClone.setAttribute('width', targetSize);
    svgClone.setAttribute('height', targetSize);
    if (!svgClone.getAttribute('viewBox')) {
      svgClone.setAttribute('viewBox', '0 0 24 24');
    }

    let svgStr = new XMLSerializer().serializeToString(svgClone);
    svgStr = svgStr.replace(/currentColor/g, '#ffffff');

    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, targetSize, targetSize);
      ctx.drawImage(img, 0, 0, targetSize, targetSize);

      const imgData = ctx.getImageData(0, 0, targetSize, targetSize).data;
      const bitData = new Array(targetSize * targetSize);
      const rawRgba = new Array(targetSize * targetSize * 4);

      for (let i = 0; i < targetSize * targetSize; i++) {
        const r = imgData[i * 4];
        const g = imgData[i * 4 + 1];
        const b = imgData[i * 4 + 2];
        const a = imgData[i * 4 + 3];

        rawRgba[i * 4] = r;
        rawRgba[i * 4 + 1] = g;
        rawRgba[i * 4 + 2] = b;
        rawRgba[i * 4 + 3] = a;

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        bitData[i] = (a >= 70 && lum >= 70) ? 1 : 0;
      }

      resolve({
        w: targetSize,
        h: targetSize,
        origW: targetSize,
        origH: targetSize,
        data: bitData,
        rawRgba: rawRgba
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

function initPresetIcons() {
  document.querySelectorAll('.preset-icon-btn').forEach(btn => {
    const key = btn.dataset.preset;
    const svg = btn.querySelector('svg');
    if (key && svg) {
      rasterizeSvgToBitmap(svg, 16).then(res => {
        if (res) {
          PRESET_ICONS[key] = {
            name: key,
            ...res
          };
        }
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPresetIcons);
} else {
  initPresetIcons();
}

async function addPresetIconToScreen(key, svg) {
  let preset = PRESET_ICONS[key];
  if (!preset && svg) {
    const res = await rasterizeSvgToBitmap(svg, 16);
    if (res) {
      PRESET_ICONS[key] = { name: key, ...res };
      preset = PRESET_ICONS[key];
    }
  }
  if (!preset) return;

  pushHistory();
  const presetName = (typeof t === 'function' ? t('preset_name_' + key) : null) || key;
  const newBitmap = {
    id: generateId(),
    type: 'bitmap',
    isIcon: true,
    subtype: 'icon',
    presetKey: key,
    name: presetName,
    x: Math.round((SCREEN_WIDTH - preset.w) / 2),
    y: Math.round((SCREEN_HEIGHT - preset.h) / 2),
    w: preset.w,
    h: preset.h,
    origW: preset.origW || preset.w,
    origH: preset.origH || preset.h,
    threshold: 128,
    inverted: false,
    ditherMode: 'threshold',
    rawRgba: preset.rawRgba ? [...preset.rawRgba] : null,
    data: [...preset.data],
    visible: true
  };

  state.objects.push(newBitmap);
  selectObject(newBitmap.id);
  setActiveTool('select');
  renderAll();
  updateArduinoCode();
}

document.querySelectorAll('.preset-icon-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.preset;
    const svg = btn.querySelector('svg');
    addPresetIconToScreen(key, svg);
  });
});

// --- ICONS MODAL & SEARCH FUNCTIONALITY ---
const btnOpenIconsModal = document.getElementById('btnOpenIconsModal');
const iconsModalOverlay = document.getElementById('iconsModalOverlay');
const btnCloseIconsModal = document.getElementById('btnCloseIconsModal');
const iconsModalGrid = document.getElementById('iconsModalGrid');
const iconsSearchInput = document.getElementById('iconsSearchInput');
const btnClearIconSearch = document.getElementById('btnClearIconSearch');
const iconsModalNoResults = document.getElementById('iconsModalNoResults');
const iconsModalCountBadge = document.getElementById('iconsModalCountBadge');

let iconsModalBuilt = false;

function buildIconsModalGrid() {
  if (iconsModalBuilt && iconsModalGrid && iconsModalGrid.children.length > 0) return;
  if (!iconsModalGrid) return;
  iconsModalGrid.innerHTML = '';

  const iconButtons = document.querySelectorAll('#presetIconsGrid .preset-icon-btn');
  iconButtons.forEach(btn => {
    const key = btn.dataset.preset;
    const svg = btn.querySelector('svg');
    if (!key || !svg) return;

    const localizedName = (typeof t === 'function' ? t('preset_name_' + key) : null) || btn.title || key;
    const card = document.createElement('div');
    card.className = 'modal-icon-card';
    card.dataset.preset = key;
    card.dataset.name = localizedName.toLowerCase();
    card.title = localizedName;

    const svgClone = svg.cloneNode(true);
    card.appendChild(svgClone);

    const span = document.createElement('span');
    span.className = 'modal-icon-label';
    span.textContent = localizedName;
    card.appendChild(span);

    card.addEventListener('click', async () => {
      await addPresetIconToScreen(key, svg);
      closeIconsModal();
    });

    iconsModalGrid.appendChild(card);
  });

  iconsModalBuilt = true;
  if (iconsModalCountBadge) {
    iconsModalCountBadge.textContent = `${iconButtons.length} İkon`;
  }
}

function openIconsModal() {
  buildIconsModalGrid();
  if (iconsModalOverlay) {
    iconsModalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  if (iconsSearchInput) {
    iconsSearchInput.value = '';
    filterIconsModal('');
    setTimeout(() => iconsSearchInput.focus(), 80);
  }
}

function closeIconsModal() {
  if (iconsModalOverlay) {
    iconsModalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function filterIconsModal(query) {
  const q = (query || '').trim().toLowerCase();
  if (btnClearIconSearch) {
    btnClearIconSearch.style.display = q ? 'block' : 'none';
  }

  let count = 0;
  if (!iconsModalGrid) return;
  const cards = iconsModalGrid.querySelectorAll('.modal-icon-card');
  cards.forEach(card => {
    const pKey = (card.dataset.preset || '').toLowerCase();
    const pName = (card.dataset.name || '').toLowerCase();
    const pTitle = (card.title || '').toLowerCase();
    const match = !q || pKey.includes(q) || pName.includes(q) || pTitle.includes(q);
    card.style.display = match ? 'flex' : 'none';
    if (match) count++;
  });

  if (iconsModalNoResults) {
    iconsModalNoResults.style.display = count === 0 ? 'flex' : 'none';
  }
  if (iconsModalCountBadge) {
    iconsModalCountBadge.textContent = q 
      ? (typeof t === 'function' ? `${count} / ${cards.length}` : `${count} / ${cards.length}`) 
      : `${cards.length} İkon`;
  }
}

window.openIconsModal = openIconsModal;
window.closeIconsModal = closeIconsModal;

if (btnOpenIconsModal) btnOpenIconsModal.addEventListener('click', openIconsModal);
if (btnCloseIconsModal) btnCloseIconsModal.addEventListener('click', closeIconsModal);
if (iconsModalOverlay) {
  iconsModalOverlay.addEventListener('click', (e) => {
    if (e.target === iconsModalOverlay) closeIconsModal();
  });
}
if (iconsSearchInput) {
  iconsSearchInput.addEventListener('input', (e) => {
    filterIconsModal(e.target.value);
  });
}
if (btnClearIconSearch) {
  btnClearIconSearch.addEventListener('click', () => {
    iconsSearchInput.value = '';
    filterIconsModal('');
    iconsSearchInput.focus();
  });
}


inputImageBitmap.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      let targetW = img.width;
      let targetH = img.height;
      if (targetW > SCREEN_WIDTH || targetH > SCREEN_HEIGHT) {
        const ratio = Math.min(SCREEN_WIDTH / targetW, SCREEN_HEIGHT / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      const c = document.createElement('canvas');
      c.width = targetW;
      c.height = targetH;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH).data;

      pushHistory();
      const newBitmap = {
        id: generateId(),
        type: 'bitmap',
        isIcon: false,
        subtype: 'image',
        name: file.name.substring(0, 12),
        x: Math.round((SCREEN_WIDTH - targetW) / 2),
        y: Math.round((SCREEN_HEIGHT - targetH) / 2),
        w: targetW,
        h: targetH,
        origW: targetW,
        origH: targetH,
        threshold: 128,
        inverted: false,
        ditherMode: 'threshold',
        alphaThreshold: 50,
        rawRgba: Array.from(imgData),
        data: [],
        visible: true
      };

      recomputeBitmapData(newBitmap);

      state.objects.push(newBitmap);
      selectObject(newBitmap.id);
      setActiveTool('select');
      renderAll();
      updateArduinoCode();
      inputImageBitmap.value = '';
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});
